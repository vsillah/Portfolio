import type { OrderConfirmationEmailInput } from '@/lib/email/templates/order-confirmation'
import type { ShipmentEmailInput } from '@/lib/email/templates/shipment'
import type { MeetingBookedEmailInput } from '@/lib/email/templates/meeting-booked'
import type { ChatTranscriptEmailInput } from '@/lib/email/templates/chat-transcript'
import type { ProposalEmailDraftInput } from '@/lib/email/templates/proposal'

export function sampleOrderConfirmationInput(): OrderConfirmationEmailInput {
  const orderDate = new Date().toISOString()
  return {
    clientName: 'Juliana',
    orderId: 1042,
    orderDate,
    items: [
      { name: 'Business Growth Blueprint', quantity: 1, unitPrice: 497, lineTotal: 497 },
      { name: 'ATAS Classic Tee — Black / L', quantity: 2, unitPrice: 29.99, lineTotal: 59.98 },
    ],
    subtotal: 556.98,
    discountAmount: 50,
    shippingCost: 8.99,
    tax: 0,
    totalAmount: 515.97,
    purchasesUrl: 'https://example.com/purchases',
  }
}

export function sampleShipmentInput(): ShipmentEmailInput {
  return {
    clientName: 'Juliana',
    orderId: 1042,
    trackingUrl: 'https://example.com/track',
    trackingNumber: null,
    carrier: 'USPS',
    purchasesUrl: 'https://example.com/purchases',
  }
}

export function sampleMeetingBookedInput(senderDisplayName: string): MeetingBookedEmailInput {
  return {
    clientName: 'Juliana',
    meetingType: 'Discovery Call',
    meetingDate: 'March 15, 2026',
    meetingTime: '2:00 PM',
    calendlyLink: undefined,
    senderDisplayName,
  }
}

export function sampleChatTranscriptInput(senderDisplayName: string): ChatTranscriptEmailInput {
  return {
    clientName: 'Juliana',
    sessionDate: 'March 10, 2026',
    senderDisplayName,
    transcript: `User: What services do you offer?\nAssistant: We focus on advisory, diagnostics, and implementation for growing teams.`,
  }
}

export function sampleProposalInput(): ProposalEmailDraftInput {
  return {
    clientName: 'Jordan Lee',
    clientEmail: 'jordan@example.com',
    clientCompany: 'Acme Co',
    bundleName: 'Growth Sprint',
    totalAmount: 12500,
    proposalLink: 'https://example.com/proposal/ABC123',
    accessCode: 'ABC123',
  }
}
