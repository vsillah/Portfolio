'use client'

import Image from 'next/image'
import type { SocialContentItem } from '@/lib/social-content'
import {
  validatePractitionerContentQuality,
  type DeterministicVisualSpec,
} from '@/lib/social-practitioner-content'

const RATIO_CLASSES: Record<DeterministicVisualSpec['aspect_ratio'], string> = {
  '1.91:1': 'aspect-[1.91/1]',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
}

function DeterministicCandidate({ spec }: { spec: DeterministicVisualSpec }) {
  const isLandscape = spec.aspect_ratio === '1.91:1'
  const argumentStages = [
    { number: '01', label: 'Context', value: spec.argument_map.context },
    { number: '02', label: 'Constraint', value: spec.argument_map.constraint },
    { number: '03', label: 'Decision mechanism', value: spec.argument_map.decision_mechanism },
  ]
  return (
    <div
      aria-label="Deterministic AmaduTown visual candidate"
      className={`relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#d4af37]/60 bg-[#121e31] text-[#eaecee] shadow-2xl ${isLandscape ? 'min-h-[34rem] sm:min-h-0 sm:aspect-[1.91/1]' : RATIO_CLASSES[spec.aspect_ratio]}`}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="practitioner-card-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#121e31" />
            <stop offset="1" stopColor="#24364a" />
          </linearGradient>
          <pattern id="practitioner-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#eaecee" strokeOpacity="0.045" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="900" fill="url(#practitioner-card-bg)" />
        <rect width="1200" height="900" fill="url(#practitioner-grid)" />
        <circle cx="1090" cy="90" r="240" fill="#d4af37" fillOpacity="0.09" />
        <path d="M0 775 C300 690 590 875 1200 680 L1200 900 L0 900 Z" fill="#d4af37" fillOpacity="0.08" />
      </svg>

      <div className={`relative z-10 flex h-full flex-col ${isLandscape ? 'p-[4%]' : 'p-[6%]'}`}>
        <div className="flex items-start justify-between gap-4">
          <p className="font-sans text-[clamp(0.62rem,1.35vw,0.95rem)] font-bold uppercase tracking-[0.24em] text-[#f5d060]">
            {spec.eyebrow}
          </p>
          <Image
            src="/amadutown-logo-upscaled.png"
            alt="AmaduTown"
            width={72}
            height={96}
            className={`h-auto object-contain ${isLandscape ? 'w-[clamp(1.8rem,4vw,3.2rem)]' : 'w-[clamp(2.3rem,6vw,4.5rem)]'}`}
          />
        </div>

        <h3 className={`${isLandscape ? 'mt-2 text-[clamp(1.05rem,2.5vw,1.75rem)] sm:mt-[1%]' : 'mt-[5%] text-[clamp(1.15rem,4.2vw,3.2rem)]'} max-w-[92%] font-sans font-black leading-[1.04] tracking-[-0.035em] text-white`}>
          {spec.headline}
        </h3>

        <div className={`${isLandscape ? 'mt-4 sm:mt-[2%]' : 'mt-[5%]'} grid gap-2 sm:grid-cols-3`}>
          {argumentStages.map((stage) => (
            <div key={stage.label} className="rounded-xl border border-white/15 bg-white/[0.07] p-3 backdrop-blur-sm sm:p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[0.62rem] font-black tracking-[0.18em] text-[#f5d060]">{stage.number}</span>
                <span className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-white/60">{stage.label}</span>
              </div>
              <p className="mt-1.5 font-sans text-[clamp(0.72rem,1.25vw,0.88rem)] font-semibold leading-snug text-white/95">{stage.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] p-3 sm:p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-emerald-200">04 · Bounded result</p>
              <span className="rounded-full border border-emerald-200/25 px-2 py-0.5 text-[0.55rem] font-bold text-emerald-100">{spec.result_label}</span>
            </div>
            <p className="mt-1.5 text-[clamp(0.72rem,1.2vw,0.86rem)] font-semibold leading-snug text-white/95">{spec.argument_map.result_boundary}</p>
          </div>
          <div className="rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 p-3 sm:p-2.5">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-[#f5d060]">05 · Practical takeaway</p>
            <p className="mt-1.5 text-[clamp(0.72rem,1.2vw,0.86rem)] font-semibold leading-snug text-white">{spec.argument_map.practical_takeaway}</p>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function PractitionerContentReview({
  item,
  finishedCopy,
}: {
  item: SocialContentItem
  finishedCopy: string
}) {
  const gate = validatePractitionerContentQuality({
    ...item,
    post_text: finishedCopy,
  })
  if (!gate.required) return null

  const record = gate.record
  const packet = record?.evidence_packet
  const experiment = record?.engagement_experiment
  const application = record?.framework_application
  const visual = record?.deterministic_visual
  const passed = gate.status === 'passed'

  return (
    <section aria-label="Practitioner evidence and visual review" className="scroll-mt-64 rounded-xl border border-radiant-gold/30 bg-imperial-navy/25 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="admin-console-eyebrow text-radiant-gold">Practitioner evidence</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-100">Copy and candidate, reviewed together</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
            Human QA opens only after specificity, privacy, applied framework, voice calibration, performance trace, copy completeness, and visual coverage all pass.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${passed ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
          {passed ? 'Ready for Human QA' : 'Blocked before Human QA'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-3">
          <div className="rounded-lg border border-silicon-slate/75 bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${gate.specificity_result === 'specific' ? 'border-emerald-500/35 text-emerald-200' : 'border-amber-500/40 text-amber-200'}`}>
                Specificity: {gate.specificity_result}
              </span>
              <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                {packet?.observable_result.status === 'observed' ? 'Observed result' : 'Metric pending'}
              </span>
              <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                {experiment?.causal_claim_boundary === 'correlational_only' ? 'Correlation only' : 'Causal boundary missing'}
              </span>
              <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                Framework: {application?.status || 'missing'}
              </span>
              <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                Voice: {application?.voice_calibration.status || 'missing'}
              </span>
              <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                Performance: {application?.performance_calibration.status?.replace('_', ' ') || 'missing'}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Situation</dt><dd className="mt-1 leading-6 text-gray-200">{packet?.situation || 'Missing'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Constraint</dt><dd className="mt-1 leading-6 text-gray-200">{packet?.operational_constraint || 'Missing'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Practitioner detail</dt><dd className="mt-1 leading-6 text-gray-200">{packet?.practitioner_only_detail || 'Missing'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Decision and result</dt><dd className="mt-1 leading-6 text-gray-200">{packet?.decision_intervention || 'Missing'}{packet?.observable_result.summary ? ` ${packet.observable_result.summary}` : ''}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Disclosure boundary</dt><dd className="mt-1 leading-6 text-gray-200">{packet?.disclosure_boundary.summary || 'Missing'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Applied framework</dt><dd className="mt-1 leading-6 text-gray-200">{application?.selected_framework.framework_type?.replace(/_/g, ' ') || 'Missing'} · {application?.selected_framework.approved_pattern_id || 'No approved pattern receipt'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Voice and learning trace</dt><dd className="mt-1 leading-6 text-gray-200">{application?.voice_calibration.reference_ids.join(', ') || 'Voice reference missing'} · {application?.performance_calibration.status === 'bounded_fallback' ? application.performance_calibration.fallback_reason : application?.performance_calibration.reference_ids.join(', ') || 'Performance reference missing'}</dd></div>
            </dl>
          </div>

          <div className="rounded-lg border border-silicon-slate/75 bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Finished copy</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-100">{finishedCopy || 'Finished copy is missing.'}</p>
          </div>

          {!passed && (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-100">Resolve before Human QA</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-50/85">
                {gate.findings.slice(0, 8).map((finding) => <li key={finding.code}>- {finding.message}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {visual ? <DeterministicCandidate spec={visual} /> : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-amber-500/40 bg-background/40 p-6 text-center text-sm text-amber-100">
              Deterministic candidate is missing.
            </div>
          )}
          <div className="rounded-lg border border-silicon-slate/75 bg-background/40 p-4 text-sm leading-6 text-gray-300">
            <p><span className="font-semibold text-gray-100">Visual rationale:</span> {visual?.visual_rationale || 'Missing'}</p>
            <p className="mt-1"><span className="font-semibold text-gray-100">Rendering:</span> HTML/SVG typography, fixed grid, AmaduTown colors, logo-safe area, and {visual?.aspect_ratio || 'pending'} aspect ratio.</p>
            <p className="mt-1"><span className="font-semibold text-gray-100">Art direction receipt:</span> {visual?.art_direction_receipt.provider || 'missing'} · {visual?.art_direction_receipt.status || 'missing'} · {visual?.art_direction_receipt.receipt_id || 'no receipt'}</p>
            <p className="mt-1"><span className="font-semibold text-gray-100">Candidate lifecycle:</span> {visual?.candidate.status || 'missing'} · {visual?.candidate.candidate_id || 'no candidate id'}</p>
          </div>

          {item.image_url && (
            <details className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-red-100">Legacy generated candidate remains unapproved</summary>
              <p className="mt-2 text-xs leading-5 text-red-50/80">This prior image is comparison evidence only. It cannot satisfy the deterministic visual gate or advance to Human QA.</p>
              <div className="relative mt-3 aspect-video overflow-hidden rounded-lg border border-red-400/25 bg-black/30">
                <Image src={item.image_url} alt="Unapproved legacy visual candidate" fill unoptimized className="object-contain" />
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
