export interface ProposalEmailDraftInput {
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  bundleName: string;
  totalAmount: number;
  proposalLink: string;
  accessCode?: string;
}

export interface ProposalEmailDraft {
  to: string;
  subject: string;
  body: string;
}

export function generateProposalEmailDraft(input: ProposalEmailDraftInput): ProposalEmailDraft {
  const firstName = input.clientName.split(' ')[0] || input.clientName;
  const companyLine = input.clientCompany ? ` for ${input.clientCompany}` : '';
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(input.totalAmount);

  const accessCodeBlock = input.accessCode
    ? `\n\nYour access code: ${input.accessCode}\n(Enter this code on the proposal page to view the full details.)`
    : '';

  const subject = `Your Proposal${companyLine} — ${input.bundleName}`;

  const body = `Hi ${firstName},

Thank you for taking the time to discuss your goals with us. As promised, I've put together a custom proposal${companyLine} based on our conversation.

Here's your proposal link:
${input.proposalLink}${accessCodeBlock}

Investment: ${amountFormatted}

Inside you'll find the full breakdown of what's included, expected outcomes, and next steps. Take your time reviewing it — if you have any questions or want to adjust anything, just reply to this email.

Looking forward to working together.

Best,
Vambah Sillah
AmaduTown Advisory Solutions`;

  return { to: input.clientEmail, subject, body };
}
