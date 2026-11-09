import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'
import { chooseQuoteQuestions, deriveQuoteContext, projectQuoteOffers, quoteQuestions, QUOTE_QUESTION_SET_VERSION,
  QUOTE_RULES_VERSION, type QuoteAnswers, type QuoteOffer } from '@/lib/accelerated-quote-refinement'

export class QuoteContextError extends Error { constructor(message: string, public status = 409) { super(message) } }
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = (message: string) => { throw new QuoteContextError(message) }

export async function loadQuoteContext(userId: string, orderId: number) {
  const orderResult = await supabaseAdmin.from('orders')
    .select('id,user_id,status,accelerated_quote_recommendation_id,accelerated_quote_reviewed_at,order_items(id,service_id,product_id,accelerated_recommendation_id,accelerated_reviewed_at)')
    .eq('id', orderId).eq('user_id', userId).maybeSingle()
  if (orderResult.error) fail('Quote order is temporarily unavailable.')
  const order = orderResult.data
  if (!order || order.status !== 'quote_pending' || !order.accelerated_quote_recommendation_id || !order.accelerated_quote_reviewed_at)
    fail('This quote request is no longer pending. Open your dashboard.')
  const recResult = await supabaseAdmin.from('accelerated_member_recommendations')
    .select('id,user_id,intake_id,audit_id,offer_kind,offer_id,title,review_status,reviewed_at,approved_offer_updated_at,approved_price,approved_is_quote_based')
    .eq('id', order!.accelerated_quote_recommendation_id).eq('user_id', userId).maybeSingle()
  if (recResult.error || !recResult.data || recResult.data.review_status !== 'approved' ||
    recResult.data.reviewed_at !== order!.accelerated_quote_reviewed_at ||
    recResult.data.offer_kind !== 'service' || recResult.data.approved_is_quote_based !== true)
    fail('The reviewed service has changed. Ask for a new review.')
  const rec = recResult.data!
  const intake = await supabaseAdmin.from('accelerated_decision_file_intakes')
    .select('id,worksheet_id,content_version,payload_sha256,answers,review_status,linked_audit_id,learner_name')
    .eq('id', rec.intake_id).maybeSingle()
  if (intake.error || !intake.data || ![DECISION_FILE_VERSION, AGENTIFIED_VERSION].includes(intake.data.content_version))
    fail('The reviewed workshop file is unavailable. Ask for a new review.')
  const workshop = intake.data!.content_version === AGENTIFIED_VERSION ? 'agentified' : 'accelerated'
  const items = order!.order_items as Array<{ service_id: string | null; product_id: number | null; accelerated_recommendation_id: string | null; accelerated_reviewed_at: string | null }> | null
  if (!items || items.length !== 1 || String(items[0].service_id) !== rec.offer_id || items[0].product_id !== null ||
    items[0].accelerated_recommendation_id !== rec.id || items[0].accelerated_reviewed_at !== rec.reviewed_at)
    fail('The quote order no longer matches the reviewed service.')
  const [owner, worksheet, audit, services, products, recs, latest, contact] = await Promise.all([
    supabaseAdmin.from('accelerated_decision_file_owners').select('intake_id,user_id').eq('intake_id', rec.intake_id).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('accelerated_member_worksheets').select('worksheet_id,content_version,answers').eq('user_id', userId).eq('content_version', intake.data!.content_version).maybeSingle(),
    supabaseAdmin.from('diagnostic_audits').select('id,user_id,status').eq('id', rec.audit_id).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('services').select('id,title,description,price,is_quote_based,service_type,delivery_method,duration_hours,duration_description,min_participants,max_participants,image_url,image_variants,video_url,video_thumbnail_url,presentation_url,is_featured,topics,updated_at').eq('is_active', true).order('id'),
    supabaseAdmin.from('products').select('id,title,description,price,type,image_url,image_variants,is_featured,updated_at').eq('is_active', true).order('id'),
    supabaseAdmin.from('accelerated_member_recommendations').select('id,offer_kind,offer_id,review_status').eq('user_id', userId).eq('intake_id', rec.intake_id).eq('review_status', 'approved').order('id'),
    supabaseAdmin.from('accelerated_quote_refinements').select('id,revision,answers,payload_sha256,context_package').eq('order_id', orderId).order('revision', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('accelerated_quote_contact_links').select('contact_submission_id,refinement_id').eq('order_id', orderId).maybeSingle(),
  ])
  if ([owner,worksheet,audit,services,products,recs,latest,contact].some((result) => result.error)) fail('Quote context is temporarily unavailable.')
  if (!owner.data || !worksheet.data || !audit.data ||
    intake.data!.review_status !== 'linked' || intake.data!.linked_audit_id !== audit.data.id ||
    audit.data.status !== 'completed' || worksheet.data.content_version !== intake.data!.content_version ||
    intake.data!.worksheet_id !== worksheet.data.worksheet_id ||
    sha(intake.data!.answers) !== sha(worksheet.data.answers)) fail('Your workshop file changed. Ask for a new review before continuing.')
  const activeServices = (services.data ?? []) as Array<Record<string, unknown>>
  const reviewed = new Map<string, string>((recs.data ?? []).map((r: {offer_kind:string;offer_id:string;id:string}) => [`${r.offer_kind}:${r.offer_id}`, r.id]))
  const offers: QuoteOffer[] = [
    ...activeServices.map((s): QuoteOffer => ({ kind: 'service', id: String(s.id), title: String(s.title), price: s.price === null ? null : Number(s.price),
      quoteBased: s.is_quote_based === true || s.price === null, serviceType: String(s.service_type ?? ''),
      deliveryMethod: String(s.delivery_method ?? ''), topics: Array.isArray(s.topics) ? s.topics.filter((v): v is string => typeof v === 'string') : [],
      reviewedRecommendationId: reviewed.get(`service:${s.id}`) ?? null,
      catalog: { id: String(s.id), title: String(s.title), description: typeof s.description === 'string' ? s.description : null,
        service_type: String(s.service_type ?? ''), delivery_method: String(s.delivery_method ?? 'virtual'),
        duration_hours: s.duration_hours === null ? null : Number(s.duration_hours), duration_description: typeof s.duration_description === 'string' ? s.duration_description : null,
        price: s.price === null ? null : Number(s.price), is_quote_based: s.is_quote_based === true,
        min_participants: Number(s.min_participants ?? 1), max_participants: s.max_participants === null ? null : Number(s.max_participants),
        image_url: typeof s.image_url === 'string' ? s.image_url : null, image_variants: s.image_variants as Record<string, string | null> | null,
        video_url: typeof s.video_url === 'string' ? s.video_url : null, video_thumbnail_url: typeof s.video_thumbnail_url === 'string' ? s.video_thumbnail_url : null,
        presentation_url: typeof s.presentation_url === 'string' ? s.presentation_url : null, is_featured: s.is_featured === true } })),
    ...(products.data ?? []).map((p: Record<string, unknown>): QuoteOffer => ({ kind: 'product', id: String(p.id), title: String(p.title), price: p.price === null ? null : Number(p.price),
      quoteBased: false, productType: String(p.type ?? ''), reviewedRecommendationId: reviewed.get(`product:${p.id}`) ?? null,
      catalog: { id: Number(p.id), title: String(p.title), description: typeof p.description === 'string' ? p.description : null,
        type: String(p.type ?? ''), price: p.price === null ? null : Number(p.price), image_url: typeof p.image_url === 'string' ? p.image_url : null,
        image_variants: p.image_variants as Record<string, string | null> | null, is_featured: p.is_featured === true } })),
  ]
  const reviewedOffer = activeServices.find((s) => String(s.id) === rec.offer_id)
  if (!reviewedOffer || reviewedOffer.updated_at !== rec.approved_offer_updated_at ||
    Number(reviewedOffer.price ?? 0) !== Number(rec.approved_price ?? 0) ||
    (reviewedOffer.is_quote_based === true || reviewedOffer.price === null) !== rec.approved_is_quote_based)
    fail('The approved service changed. Ask for a new review.')
  const derived = deriveQuoteContext(intake.data!.answers as Record<string, string>, workshop)
  const questions = chooseQuoteQuestions(derived, offers)
  const catalogSha = sha({ services: services.data, products: products.data, reviewed: recs.data })
  const savedPackage = latest.data?.context_package as Record<string, unknown> | undefined
  if (!contact.data && savedPackage && (savedPackage.catalogSha256 !== catalogSha ||
    savedPackage.worksheetSha256 !== sha(worksheet.data.answers) ||
    savedPackage.rulesVersion !== QUOTE_RULES_VERSION || savedPackage.questionSetVersion !== QUOTE_QUESTION_SET_VERSION))
    fail('Quote context changed. Return to your dashboard and ask for a new review.')
  return { workshop, order: order!, rec, intake: intake.data!, derived, questions, offers, catalogSha,
    latest: latest.data, submitted: !!contact.data, worksheetSha: sha(worksheet.data.answers), rulesVersion: QUOTE_RULES_VERSION,
    questionSetVersion: QUOTE_QUESTION_SET_VERSION }
}

export function buildRefinement(context: Awaited<ReturnType<typeof loadQuoteContext>>, answers: QuoteAnswers, requestedOfferId?: string | null) {
  const allowed = new Set(context.questions)
  for (const [key, value] of Object.entries(answers)) {
    if (!allowed.has(key as typeof context.questions[number]) || typeof value !== 'string' ||
      !quoteQuestions.some((q) => q.id === key && q.options.some((o) => o[0] === value)))
      throw new QuoteContextError('A quote answer is invalid. Reload and try again.', 400)
  }
  const projection = projectQuoteOffers(context.offers, context.derived, answers, context.questions)
  const requestedOffer = requestedOfferId ? context.offers.find((offer) => offer.kind === 'service' && offer.id === requestedOfferId && offer.quoteBased) : null
  if (requestedOfferId && (!requestedOffer || (requestedOfferId !== context.rec.offer_id && projection.excluded.some((offer) => offer.kind === 'service' && offer.id === requestedOfferId))))
    throw new QuoteContextError('That quote service no longer fits. Reload and choose an active option.', 409)
  const packageData = {
    intakeId: context.intake.id, intakePayloadSha256: context.intake.payload_sha256,
    worksheetId: context.intake.worksheet_id, worksheetSha256: context.worksheetSha,
    auditId: context.rec.audit_id, recommendationId: context.rec.id, reviewedAt: context.rec.reviewed_at,
    questionSetVersion: context.questionSetVersion, rulesVersion: context.rulesVersion,
    catalogSha256: context.catalogSha, sourceFields: context.derived.sourceFields,
    derivedFacts: context.derived.facts, questions: context.questions, answers,
    requestedOffer: requestedOffer ? { kind: 'service', id: requestedOffer.id, title: requestedOffer.title } :
      { kind: 'service', id: context.rec.offer_id, title: context.rec.title },
    projection: { status: projection.status, needsOperatorReview: projection.needsOperatorReview,
      remaining: projection.remaining.map((o) => ({ kind: o.kind, id: o.id, title: o.title, fit: o.fit, reasons: o.reasons, evidence: o.evidence })),
      excluded: projection.excluded.map((o) => ({ kind: o.kind, id: o.id, title: o.title, reasons: o.reasons, evidence: o.evidence })) },
  }
  return { projection, packageData, payloadSha256: sha(packageData) }
}
