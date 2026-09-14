import { describe, expect, it } from 'vitest';
import { discoveryGaps, emptyDiscovery, readDiscovery, writeDiscovery } from './case-discovery';

describe('internal discovery note envelope', () => {
  it('round trips multiline notes and evidence without duplicating the packet', () => {
    const packet = { ...emptyDiscovery(), question: 'Reduce wait time?', evidence: 'Source: interview\nBaseline: 3 days', framework: 'capabilities' as const };
    const saved = writeDiscovery('Existing notes\nKeep exactly.\n', packet);
    const parsed = readDiscovery(saved);
    expect(parsed).toEqual({ plainNotes: 'Existing notes\nKeep exactly.\n', packet });
    expect(writeDiscovery(parsed.plainNotes, parsed.packet)).toBe(saved);
    expect(readDiscovery(writeDiscovery('Revised notes', parsed.packet)).packet.evidence).toBe(packet.evidence);
  });
  it.each(['ordinary call notes', 'text\n\n[Portfolio internal discovery v1]\n{bad', 'text\n\n[Portfolio internal discovery v1]\n{"version":2}', 'text\n\n[Portfolio internal discovery v1]\nnull'])('preserves legacy or malformed notes: %s', notes => {
    expect(readDiscovery(notes)).toEqual({ plainNotes: notes, packet: emptyDiscovery() });
  });
  it('rejects invalid fields and prototype framework keys without dropping text', () => {
    for (const patch of [{ framework: '__proto__' }, { aligned: 'yes' }, { evidence: [] }]) {
      const notes = '\n\n[Portfolio internal discovery v1]\n' + JSON.stringify({ ...emptyDiscovery(), ...patch });
      expect(readDiscovery(notes).plainNotes).toBe(notes);
    }
  });
  it('reports actual missing inputs and alignment, including whitespace', () => {
    expect(discoveryGaps(emptyDiscovery())).toHaveLength(6);
    expect(discoveryGaps({ ...emptyDiscovery(), question: 'q', measurement: 'm', timeframe: 't', evidence: 'e', nextStep: 'n', aligned: true })).toEqual([]);
    expect(discoveryGaps({ ...emptyDiscovery(), question: '   ' })).toContain('Define the question');
  });
});
