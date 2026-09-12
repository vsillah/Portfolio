import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import SlackReceiptStatus from './SlackReceiptStatus'

it('shows a saved decision beside blocked card delivery, with details and the exact review link', () => {
  render(<SlackReceiptStatus run={{ kind: 'slack_action_receipt', metadata: { state: 'delivery_blocked',
    envelope: { value: { action: 'warm_gmail_send.approve', contactId: 42, expectedReplyText: 'Private envelope' } } },
    outcome: { canonical: { actionStatus: 'completed', text: 'Approval intent saved; Gmail send remains disabled.' },
      delivery: 'failed', deliveryError: 'Verify Slack history scopes and conversation membership.' } }} />)
  expect(screen.getByText('Decision recorded')).toBeInTheDocument()
  expect(screen.getByText('Slack update blocked')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Review decision' })).toHaveAttribute('href',
    '/admin/outreach?tab=leads&filter=warm&id=42&contactId=42#warm-gmail-operating-loop')
  fireEvent.click(screen.getByText('Receipt details'))
  expect(screen.getByText('Verify Slack history scopes and conversation membership.')).toBeVisible()
  expect(screen.queryByText('Private envelope')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /retry|send/i })).not.toBeInTheDocument()
})
