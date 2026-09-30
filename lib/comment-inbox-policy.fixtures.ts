// Existing labeled policy cases, shared with the offline shadow benchmark.
// Synthetic text only; confidence and provider context are part of each case.
export const COMMENT_POLICY_CLASSIFICATION_FIXTURES = [
  ['low_risk_acknowledgement', 'Appreciate this. Great point.', 0.92, undefined],
  ['substantive_question', 'How would this work for a nonprofit team?', 0.92, undefined],
  ['buying_lead_intent', 'Can you build this for my organization? What would it cost?', 0.92, undefined],
  ['partnership_intent', 'Would you be open to a partnership or collaboration?', 0.92, undefined],
  ['criticism_negative', 'This is wrong and misleading.', 0.92, undefined],
  ['misinformation_unsupported_claim', 'Source? This claim is not true.', 0.92, undefined],
  ['sensitive_privacy_legal_financial', 'Can you give financial advice if I share private account details?', 0.92, undefined],
  ['spam', 'Buy followers now and click my link.', 0.92, undefined],
  ['low_confidence', 'Could be a real reply, maybe.', 0.3, undefined],
  ['provider_manual_ambiguity', 'Looks manually imported from another tool.', 0.92, { provider: 'manual' }],
] as const
