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

  it('keeps one exact approval blocked and rejects a declined, blank, or duplicate candidate', () => {
    const chatbot = evalSourceBindingPackets[0]
    const video = evalSourceBindingPackets[3]
    const exact: SourceApproval = {
      family: 'chatbot', subjectId: chatbot.subjectId, version: chatbot.version, evidenceSha256: chatbot.evidenceSha256,
      receiptId: 'receipt-1', approved: true, promptSha256: chatbot.audit.promptSha256,
    }
    const matched = buildEvalSourceBindingPackets({ ...input(), approvals: [exact] })
    expect(matched[0].approvalPresent).toBe(true)
    expect(matched[0].state).toBe('blocked')
    expect(matched[0].blockers).toEqual(chatbot.blockers)
    expect(matched[1].approvalPresent).toBe(false)

    const declined = buildEvalSourceBindingPackets({ ...input(), approvals: [{ ...exact, approved: false }] })
    expect(declined[0].approvalPresent).toBe(true)
    expect(declined[0].blockers).toContain('Approval does not match the exact family, subject, version, evidence, and required source fields.')

    const blankReceipt = buildEvalSourceBindingPackets({ ...input(), approvals: [{ ...exact, receiptId: '' }] })
    expect(blankReceipt[0].blockers).toContain('Approval does not match the exact family, subject, version, evidence, and required source fields.')

    const duplicate = buildEvalSourceBindingPackets({ ...input(), approvals: [exact, { ...exact, receiptId: 'receipt-2' }] })
    expect(duplicate[0].blockers).toContain('Multiple approval candidates require owner reconciliation.')
    expect(duplicate[0].blockers).not.toContain('Approval does not match the exact family, subject, version, evidence, and required source fields.')
    expect(duplicate[0].state).toBe('blocked')

    const distinct: SourceApproval = {
      family: 'video-script', subjectId: video.subjectId, version: video.version, evidenceSha256: video.evidenceSha256,
      receiptId: 'script-template-receipt-1', approved: true, templateId: video.audit.templateCandidate,
      libraryVersion: video.audit.frameworkLibrary, scriptSha256: video.audit.scriptSha256,
      scriptTemplateEvaluationReceipt: 'script-template-evaluation:distinct',
    }
    const videoPackets = buildEvalSourceBindingPackets({ ...input(), approvals: [distinct] })
    expect(videoPackets[3].blockers).toEqual(video.blockers)
    const missingReceipt = buildEvalSourceBindingPackets({ ...input(), approvals: [{ ...distinct, scriptTemplateEvaluationReceipt: undefined }] })
    expect(missingReceipt[3].blockers).toContain('A distinct script-template evaluation receipt is required.')
  })
})
