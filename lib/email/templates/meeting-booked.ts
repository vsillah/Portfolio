export interface MeetingBookedEmailInput {
  clientName: string
  meetingType?: string
  meetingDate?: string
  meetingTime?: string
  calendlyLink?: string
  senderDisplayName: string
}

export function buildMeetingBookedEmail(input: MeetingBookedEmailInput): {
  subject: string
  html: string
  text: string
} {
  const dateInfo = input.meetingDate
    ? `<p>Date: <strong>${input.meetingDate}</strong>${input.meetingTime ? ` at <strong>${input.meetingTime}</strong>` : ''}</p>`
    : ''

  const linkInfo = input.calendlyLink
    ? `<p>You can manage your booking here: <a href="${input.calendlyLink}">${input.calendlyLink}</a></p>`
    : ''

  const subject = `Meeting Confirmed${input.meetingType ? `: ${input.meetingType}` : ''}`

  const text = [
    `Hi ${input.clientName},`,
    '',
    `Your meeting${input.meetingType ? ` (${input.meetingType})` : ''} has been confirmed!`,
    input.meetingDate ? `Date: ${input.meetingDate}${input.meetingTime ? ` at ${input.meetingTime}` : ''}` : '',
    '',
    input.calendlyLink ? `Manage your booking: ${input.calendlyLink}` : '',
    '',
    'Looking forward to speaking with you!',
    '',
    'Best regards,',
    input.senderDisplayName,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
      <h2>Meeting Confirmed!</h2>
      <p>Hi ${input.clientName},</p>
      <p>Your meeting${input.meetingType ? ` (<strong>${input.meetingType}</strong>)` : ''} has been confirmed.</p>
      ${dateInfo}
      ${linkInfo}
      <p>Looking forward to speaking with you!</p>
      <p>Best regards,<br/>${input.senderDisplayName}</p>
    `

  return { subject, html, text }
}
