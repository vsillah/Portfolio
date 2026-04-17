export interface ChatTranscriptEmailInput {
  clientName: string
  transcript: string
  sessionDate: string
  senderDisplayName: string
}

export function buildChatTranscriptEmail(input: ChatTranscriptEmailInput): {
  subject: string
  html: string
  text: string
} {
  const transcriptHtml = input.transcript
    .split('\n')
    .map((line) => {
      if (line.startsWith('User:')) return `<p style="color: #d4a843;"><strong>${line}</strong></p>`
      if (line.startsWith('Assistant:')) return `<p style="color: #94a3b8;">${line}</p>`
      return `<p>${line}</p>`
    })
    .join('')

  const subject = `Your Chat Summary — ${input.sessionDate}`

  const text = [
    `Hi ${input.clientName},`,
    '',
    `Here's a summary of your chat session on ${input.sessionDate}:`,
    '',
    input.transcript,
    '',
    'If you have any follow-up questions, feel free to start a new chat or reply to this email.',
    '',
    'Best regards,',
    input.senderDisplayName,
  ].join('\n')

  const html = `
      <h2>Chat Summary</h2>
      <p>Hi ${input.clientName},</p>
      <p>Here's a summary of your chat session on <strong>${input.sessionDate}</strong>:</p>
      <div style="background: #0f1729; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${transcriptHtml}
      </div>
      <p>If you have any follow-up questions, feel free to start a new chat or reply to this email.</p>
      <p>Best regards,<br/>${input.senderDisplayName}</p>
    `

  return { subject, html, text }
}
