import { describe, expect, it } from 'vitest'
import { buildEvalSourceBindingPackets, evalSourceBindingPackets, EVAL_MANIFEST_SHA256, EVAL_REPORT_SHA256, EVAL_REVIEW_BASE, EVAL_SNAPSHOT_SHA256, type SourceApproval } from './eval-source-binding-review'

const input = () => ({ baseCommit: EVAL_REVIEW_BASE, manifestSha256: EVAL_MANIFEST_SHA256, snapshotSha256: EVAL_SNAPSHOT_SHA256, reportSha256: EVAL_REPORT_SHA256 })

describe('eval source binding review packets', () => {
  it('keeps four stable, blocked, review-only identities with the exact cohort facts', () => {
    expect(evalSourceBindingPackets).toHaveLength(4)
    expect(new Set(evalSourceBindingPackets.map(packet => packet.key)).size).toBe(4)
    expect(evalSourceBindingPackets.every(packet => packet.state === 'blocked' && packet.sideEffects === 'None. Review only.')).toBe(true)
    expect(evalSourceBindingPackets.find(packet => packet.family === 'agent')).toMatchObject({ threshold: expect.stringContaining('82'), observation: expect.stringContaining('76.8') })
    expect(evalSourceBindingPackets.find(packet => packet.family === 'llm-judge')).toMatchObject({ observation: expect.stringContaining('4 evaluations'), audit: { mixedModelCount: '7', mixedModelEvidenceSha256: '73f377361c97ffcf0acc8b228b22624005562248068bc7f40247023642c00e40' } })
  })
  it('fails closed when report, manifest, snapshot, or base revision changes', () => {
    for (const field of ['baseCommit', 'manifestSha256', 'snapshotSha256', 'reportSha256'] as const) {
      const packets = buildEvalSourceBindingPackets({ ...input(), [field]: 'stale' })
      expect(packets.every(packet => packet.blockers[0].startsWith('Canonical revision'))).toBe(true)
    }
  })
  it('rejects unrelated agent approval and a framework receipt in place of script-template evaluation', () => {
    const agent = evalSourceBindingPackets[2]
    const video = evalSourceBindingPackets[3]
    const approvals: SourceApproval[] = [
      { family: 'agent', subjectId: agent.subjectId, version: agent.version, evidenceSha256: agent.evidenceSha256, receiptId: 'f6d722a6-1592-4eca-9714-1f67a4288f06', approved: true },
      { family: 'video-script', subjectId: video.subjectId, version: video.version, evidenceSha256: video.evidenceSha256, receiptId: video.audit.frameworkReceipt, approved: true, templateId: video.audit.templateCandidate, libraryVersion: video.audit.frameworkLibrary, scriptSha256: video.audit.scriptSha256, scriptTemplateEvaluationReceipt: video.audit.frameworkReceipt },
    ]
    const packets = buildEvalSourceBindingPackets({ ...input(), approvals })
    expect(packets[2].blockers).toContain('Deployment-research approval is unrelated to this rubric and run set.')
    expect(packets[3].blockers).toContain('A distinct script-template evaluation receipt is required.')
    expect(packets.every(packet => packet.state === 'blocked')).toBe(true)
  })
  it('rejects null and mismatched prompt/model bindings', () => {
    const chatbot = evalSourceBindingPackets[0]
    const judge = evalSourceBindingPackets[1]
    const approvals: SourceApproval[] = [
      { family: 'chatbot', subjectId: chatbot.subjectId, version: '', evidenceSha256: chatbot.evidenceSha256, receiptId: 'receipt', approved: true },
      { family: 'llm-judge', subjectId: judge.subjectId, version: judge.version, evidenceSha256: judge.audit.mixedModelEvidenceSha256, receiptId: 'receipt', approved: true, model: 'other-model' },
    ]
    const packets = buildEvalSourceBindingPackets({ ...input(), approvals })
    expect(packets[0].blockers).toContain('Approval does not match the exact family, subject, version, evidence, and required source fields.')
    expect(packets[1].blockers).toContain('Approval does not match the exact family, subject, version, evidence, and required source fields.')
  })
})
