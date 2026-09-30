import { COMMENT_CLASSIFICATIONS, type CommentClassification } from '../comment-inbox-policy'
import { JEV_MODEL, URGENCY_LEVELS, type Transport } from './jev'
// A deliberately limited text heuristic, not Jev inference. Never reads expected labels.
export const mockTransport: Transport = async ({ state }) => {
  const text = state.text.toLowerCase().replace(/\s+/g, ' ')
  let intent: CommentClassification = 'low_risk_acknowledgement'
  if (/buy followers|crypto|airdrop/.test(text)) intent = 'spam'
  else if (/confidential|private|legal advice|financial advice/.test(text)) intent = 'sensitive_privacy_legal_financial'
  else if (/hire|pricing|need help/.test(text)) intent = 'buying_lead_intent'
  else if (/collaborat|sponsor/.test(text)) intent = 'partnership_intent'
  else if (/terrible|wrong|disagree/.test(text)) intent = 'criticism_negative'
  else if (/misleading|guarantees|equals five|february 30/.test(text)) intent = 'misinformation_unsupported_claim'
  else if (/parent comment/.test(text)) intent = 'provider_manual_ambiguity'
  else if (/thing from before/.test(text)) intent = 'low_confidence'
  else if (/\?|bypass approval|stop contacting/.test(text)) intent = 'substantive_question'
  const risk = /confidential|private|advice|terrible|wrong|misleading|guarantees|equals five|february 30|bypass|stop contacting/.test(text) || intent === 'spam'
  const urgency = /immediately|expose|reveal|do it now/.test(text) ? 2 : ['spam', 'low_risk_acknowledgement'].includes(intent) ? 0 : 1
  return { status: 200, body: { model: JEV_MODEL, answers: {
    intent: { type: 'choice', choice: intent, confidence: 1,
      probabilities: Object.fromEntries(COMMENT_CLASSIFICATIONS.map(c => [c, Number(c === intent)])) },
    urgency: { type: 'score', score: urgency, confidence: 1,
      probabilities: Object.fromEntries([0, 1, 2].map(n => [String(n), Number(n === urgency)])),
      legend: Object.fromEntries(URGENCY_LEVELS.map((s, i) => [String(i), s])) },
    spam: { type: 'noul', noul: Number(intent === 'spam') }, replyRisk: { type: 'noul', noul: Number(risk) },
    humanReview: { type: 'noul', noul: Number(intent !== 'low_risk_acknowledgement' || risk) },
  }, usage: { input_tokens: 0, output_tokens: 0 } } }
}
