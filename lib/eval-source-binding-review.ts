/** Public-safe, review-only identities. No source records or provider clients are loaded here. */
import { createHash } from 'node:crypto'

export const EVAL_REVIEW_BASE = 'cad70c5ea24c5a73045221a63aeadaecf95ed6b8'
export const EVAL_MANIFEST_SHA256 = '3621b225d2c6ec3fa3615fa804cb0e193dff40aec0a6f06574cb138dfaaf3b8a'
export const EVAL_SNAPSHOT_SHA256 = '5cfa70848ef119c305669b66b329ec79f9537f81dd99a5f64e4871acdfc2610b'
export const EVAL_REPORT_SHA256 = '8a499145a74e2963d81fb252aa79f502e3917cb12f1a119568483c7e74e9e9ed'

export type EvalFamily = 'chatbot' | 'llm-judge' | 'agent' | 'video-script'
export type SourceApproval = {
  family: EvalFamily
  subjectId: string
  version: string
  evidenceSha256: string
  receiptId: string
  approved: boolean
  model?: string
  promptSha256?: string
  rubricDimensionsSha256?: string
  runSetSha256?: string
  templateId?: string
  libraryVersion?: string
  scriptSha256?: string
  scriptTemplateEvaluationReceipt?: string
}

type PacketDefinition = {
  family: EvalFamily; title: string; owner: string; subjectId: string; version: string
  evidenceSha256: string; observation: string; threshold: string; blockers: string[]
  audit: Record<string, string>; required: Partial<SourceApproval>
}

const definitions: PacketDefinition[] = [
  {
    family: 'chatbot', title: 'Chatbot', owner: 'Model Ops',
    subjectId: '652ca11b-d582-46d1-8f1e-13e625a152f9', version: 'v3',
    evidenceSha256: '72691ca013623586b6dbfaa84ff744e5d2d406e6cb2c89a87a4c96ded10f422e',
    observation: '6 historical human evaluations · 0 good / 6 bad',
    threshold: 'Per-record human good/bad review; no aggregate pass threshold.',
    blockers: ['All six evaluated sessions have a null prompt_version.', 'No attributable approval binds this source to active prompt v3.'],
    audit: { promptKey: 'chatbot', promptSha256: 'e3ae8fe5d03627f1dd2448b332225fb6bd834cc96633851c27cd9d638854fad0', evaluatedPromptVersion: 'null for all six sessions' },
    required: { promptSha256: 'e3ae8fe5d03627f1dd2448b332225fb6bd834cc96633851c27cd9d638854fad0' },
  },
  {
    family: 'llm-judge', title: 'LLM judge', owner: 'Model Ops',
    subjectId: 'af9a7ca8-568e-4163-9ae9-a08a7b36ff8d', version: 'database v1 / runtime v1',
    evidenceSha256: '70eda246ba5bc99870dbf211ae7c992697ea6e5865a905dcfc985feca2afb26e',
    observation: 'Current model: 4 evaluations · 0 good / 4 bad · 4 aligned / 0 misaligned',
    threshold: 'Per-record good/bad review; human alignment is separate.',
    blockers: ['Canonical prompt, model, and source approval is missing.', 'Seven-record mixed-model history cannot stand in for the current-model four.'],
    audit: { promptSha256: '6d96679d361c40e0fa97b55287987042c9424b583376c0aaa70b75a111582742', model: 'claude-sonnet-4-20250514', mixedModelCount: '7', mixedModelEvidenceSha256: '73f377361c97ffcf0acc8b228b22624005562248068bc7f40247023642c00e40' },
    required: { model: 'claude-sonnet-4-20250514', promptSha256: '6d96679d361c40e0fa97b55287987042c9424b583376c0aaa70b75a111582742' },
  },
  {
    family: 'agent', title: 'Agent', owner: 'Model Ops',
    subjectId: '501c281f-928f-4ff7-884f-f68d44b18819', version: '2026-05-11T14:18:35.610443Z',
    evidenceSha256: '305eddc76422bcdd3aeedfe8b601273ad90386fda56aeb437c02a719c7f4a476',
    observation: '5 evaluations · average 76.8 · 2 passed / 3 failed',
    threshold: 'Exactly 82 from the persisted chief-of-staff-synthesis-quality rubric.',
    blockers: ['Rubric and run-source approval for this exact cohort is missing.', 'Approval f6d722a6-1592-4eca-9714-1f67a4288f06 covers deployment research and is unrelated.'],
    audit: { rubricKey: 'chief-of-staff-synthesis-quality', workflow: 'agent_war_room_standup', judge: 'deterministic-agent-eval-v1', dimensionsSha256: 'd81b3c75e6a75f72ebeabd4cca846c4bc64358f770ada80d334756b318c55f1f', runSetSha256: 'e9afc7b763a8bd69c63d99ce8b69386444b9acf27bbd12574a646a4177b6efb7', threshold: '82' },
    required: { rubricDimensionsSha256: 'd81b3c75e6a75f72ebeabd4cca846c4bc64358f770ada80d334756b318c55f1f', runSetSha256: 'e9afc7b763a8bd69c63d99ce8b69386444b9acf27bbd12574a646a4177b6efb7' },
  },
  {
    family: 'video-script', title: 'Video script', owner: 'Video content owner',
    subjectId: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb', version: 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a',
    evidenceSha256: '982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0',
    observation: '0 persisted video_script_evaluations · no populated video_ideas_queue candidate',
    threshold: 'Existing video-script zero-blocker rule; no baseline score invented.',
    blockers: ['Approved record lacks exact template ID/key and library-version binding.', 'No script-template evaluation receipt or eligible queue candidate exists.', 'Framework approval does not equal template approval.'],
    audit: { templateCandidate: 'amadutown-long-form-product-proof-v1', frameworkLibrary: 'youtube-creation-framework-library-v2', sourceReceipt: 'dark-castle-review-packet:source:b7384cb6b3ce6a08ce5f:approved', frameworkReceipt: 'dark-castle-review-packet:framework:dc30eae3d2e4d2f0ee91:approved', evidenceReceipt: 'youtube-description-evidence-reconciliation:fnv1a:07f944bb', scriptSha256: '982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0' },
    required: { templateId: 'amadutown-long-form-product-proof-v1', libraryVersion: 'youtube-creation-framework-library-v2', scriptSha256: '982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0' },
  },
]

export function buildEvalSourceBindingPackets(input: { baseCommit: string; manifestSha256: string; snapshotSha256: string; reportSha256: string; approvals?: SourceApproval[] }) {
  return definitions.map(definition => {
    const identity = [definition.family, definition.subjectId, definition.version, definition.evidenceSha256, EVAL_REPORT_SHA256].join(':')
    const key = createHash('sha256').update(identity).digest('hex')
    const blockers = [...definition.blockers]
    if (input.baseCommit !== EVAL_REVIEW_BASE || input.manifestSha256 !== EVAL_MANIFEST_SHA256 || input.snapshotSha256 !== EVAL_SNAPSHOT_SHA256 || input.reportSha256 !== EVAL_REPORT_SHA256) blockers.unshift('Canonical revision or evidence digest mismatch; refresh the packet from the owning source.')
    const approvals = input.approvals?.filter(item => item.family === definition.family) ?? []
    if (approvals.length > 1) blockers.push('Multiple approval candidates require owner reconciliation.')
    const approval = approvals[0]
    if (approval) {
      if (!approval.approved || !approval.receiptId || approval.subjectId !== definition.subjectId || approval.version !== definition.version || approval.evidenceSha256 !== definition.evidenceSha256 || Object.entries(definition.required).some(([key, value]) => approval[key as keyof SourceApproval] !== value)) blockers.push('Approval does not match the exact family, subject, version, evidence, and required source fields.')
      if (definition.family === 'agent' && approval.receiptId === 'f6d722a6-1592-4eca-9714-1f67a4288f06') blockers.push('Deployment-research approval is unrelated to this rubric and run set.')
      if (definition.family === 'video-script' && (!approval.scriptTemplateEvaluationReceipt || approval.scriptTemplateEvaluationReceipt === definition.audit.frameworkReceipt)) blockers.push('A distinct script-template evaluation receipt is required.')
    }
    return { ...definition, key, state: 'blocked' as const, blockers, approvalPresent: Boolean(approval), baseCommit: EVAL_REVIEW_BASE, manifestSha256: EVAL_MANIFEST_SHA256, snapshotSha256: EVAL_SNAPSHOT_SHA256, reportSha256: EVAL_REPORT_SHA256, next: 'Owner verifies the missing source binding; Integration Captain reviews a new packet before any separate run authorization.', sideEffects: 'None. Review only.' }
  })
}

export const evalSourceBindingPackets = buildEvalSourceBindingPackets({ baseCommit: EVAL_REVIEW_BASE, manifestSha256: EVAL_MANIFEST_SHA256, snapshotSha256: EVAL_SNAPSHOT_SHA256, reportSha256: EVAL_REPORT_SHA256 })
