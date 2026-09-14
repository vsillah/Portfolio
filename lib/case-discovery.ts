/** Internal sales-session packet. Never pass this envelope to client documents. */
export const DISCOVERY_FIELDS = [
  ['question', 'Question to solve'],
  ['context', 'Understanding to replay'],
  ['measurement', 'Success measure and baseline'],
  ['timeframe', 'Timeframe'],
  ['definitions', 'Definitions to clarify'],
  ['buckets', 'Investigation buckets'],
  ['evidence', 'Evidence and sources'],
  ['missingEvidence', 'Missing evidence'],
  ['rootCauses', 'Root causes or hypotheses'],
  ['options', 'Options and implications'],
  ['nextStep', 'Next step, owner and date'],
] as const;
export type DiscoveryField = typeof DISCOVERY_FIELDS[number][0];
export const FRAMEWORKS = {
  custom: { label: 'Custom', prompt: 'Choose distinct buckets that together cover the question.' },
  market: { label: 'Market', prompt: 'Compare market size, segments, competition and routes to market.' },
  customer: { label: 'Customer needs', prompt: 'Compare needs, current alternatives, access, price and satisfaction.' },
  profitability: { label: 'Profitability', prompt: 'Separate revenue drivers from fixed and variable costs; identify the baseline.' },
  capabilities: { label: 'Capabilities', prompt: 'Check people, processes, technology and delivery constraints.' },
  change: { label: '7S / change', prompt: 'Check strategy, structure, systems, shared values, skills, staff and leadership style.' },
  alternatives: { label: 'Strategic alternatives', prompt: 'Compare options and the conditions each requires to succeed.' },
  risks: { label: 'Risks', prompt: 'Record likelihood, impact, mitigation and an accountable owner.' },
} as const;
export type DiscoveryPacket = Record<DiscoveryField, string> & { version: 1; framework: keyof typeof FRAMEWORKS; aligned: boolean };
export function emptyDiscovery(): DiscoveryPacket {
  return { version: 1, framework: 'custom', aligned: false, ...Object.fromEntries(DISCOVERY_FIELDS.map(([key]) => [key, ''])) } as DiscoveryPacket;
}
const MARKER = '\n\n[Portfolio internal discovery v1]\n';
export function readDiscovery(notes: string): { plainNotes: string; packet: DiscoveryPacket } {
  const index = notes.lastIndexOf(MARKER);
  if (index < 0) return { plainNotes: notes, packet: emptyDiscovery() };
  try {
    const value = JSON.parse(notes.slice(index + MARKER.length));
    if (!value || value.version !== 1 || typeof value.aligned !== 'boolean' || !Object.hasOwn(FRAMEWORKS, value.framework) || DISCOVERY_FIELDS.some(([key]) => typeof value[key] !== 'string')) throw new Error('Invalid packet');
    const packet = emptyDiscovery();
    for (const [key] of DISCOVERY_FIELDS) packet[key] = value[key];
    packet.framework = value.framework;
    packet.aligned = value.aligned;
    return { plainNotes: notes.slice(0, index), packet };
  } catch {
    // Preserve malformed, future-version and legacy text instead of discarding it.
    return { plainNotes: notes, packet: emptyDiscovery() };
  }
}
export function writeDiscovery(plainNotes: string, packet: DiscoveryPacket): string {
  return plainNotes + MARKER + JSON.stringify(packet);
}
export function discoveryGaps(packet: DiscoveryPacket): string[] {
  return [!packet.question.trim() && 'Define the question', !packet.measurement.trim() && 'Clarify success', !packet.timeframe.trim() && 'Agree on timing', !packet.evidence.trim() && 'Record evidence', !packet.nextStep.trim() && 'Choose a next step', !packet.aligned && 'Confirm the approach'].filter(Boolean) as string[];
}
