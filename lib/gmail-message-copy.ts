/** A single recipient and plaintext part; mailbox edits cannot add headers or attachments. */
export function validateGmailMessageHeaders(to: string, subject: string) {
  if (!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(to) || /[\r\n,;<>\s]/.test(to)) {
    throw new Error('Use one valid recipient email address without additional headers or recipients.')
  }
  if (/[\r\n]/.test(subject)) throw new Error('Save a single-line subject before reviewing this message.')
}
function mimeEncodedSubject(subject: string) {
  const chunks: string[] = []
  let chunk = ''
  for (const character of subject) {
    if (Buffer.byteLength(chunk + character, 'utf8') > 42) { chunks.push(chunk); chunk = '' }
    chunk += character
  }
  chunks.push(chunk)
  return chunks.map(value => `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`).join('\r\n ')
}
export function buildPlaintextRfc2822(to: string, subject: string, body: string): string {
  validateGmailMessageHeaders(to, subject)
  const wrapped = Buffer.from(body, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? ''
  return [`To: ${to}`, `Subject: ${mimeEncodedSubject(subject)}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrapped].join('\r\n')
}
export function rfc2822ToGmailRaw(rfc: string): string { return Buffer.from(rfc, 'utf8').toString('base64url') }
