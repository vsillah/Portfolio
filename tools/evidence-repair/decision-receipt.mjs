import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { captureDecisionReceipt } from './decision-receipt-runtime.mjs'

export { EXCLUSIONS, receiptHash, captureDecisionReceipt, verifyDecisionReceipt, reconciliationEligibility } from './decision-receipt-runtime.mjs'

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const fail = (reason) => { throw new Error(`decision receipt: ${reason}`) }
const caseHash = (caseId) => createHash('sha256').update(caseId).digest('hex')

// Local review archive only. The case key is hashed so case IDs cannot become paths.
// Exclusive creation is the only write path; a collision is accepted only if exact.
export function appendDecisionReceipt(directory, input, readSource) {
  if (!nonempty(directory)) fail('archive directory')
  const candidate = captureDecisionReceipt(input, [], readSource).receipt
  const path = join(directory, `${caseHash(candidate.case_id)}.json`)
  mkdirSync(directory, { recursive: true })
  try {
    writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    return { status: 'captured', path, receipt: candidate }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let prior
    try { prior = JSON.parse(readFileSync(path, 'utf8')) } catch { fail('existing receipt unreadable') }
    const replay = captureDecisionReceipt(input, [prior], readSource)
    return { ...replay, path }
  }
}
