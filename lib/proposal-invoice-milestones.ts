/** Customer copy is derived from signatures and recorded receipts, never URL query/status alone. */
export function invoiceMilestoneNextStep(
  signed: boolean,
  receipts: number,
  deliveryAccepted: boolean,
  amount: string,
) {
  if (!signed)
    return "Review and sign the proposal and agreement first. No deposit has been recorded.";
  if (receipts === 0)
    return `Both documents are signed. Pay the separate ${amount} initial invoice when it is issued. No deposit has been recorded; kickoff is agreed after payment.`;
  if (receipts === 1 && !deliveryAccepted)
    return `Initial payment recorded. The final ${amount} invoice is due only after you accept delivery.`;
  if (receipts === 1)
    return `Delivery accepted. Pay the separate ${amount} final invoice when it is issued. Final payment has not been recorded.`;
  return "Both milestone payments are recorded. No further payment is due.";
}
