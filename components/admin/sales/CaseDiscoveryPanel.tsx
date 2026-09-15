'use client';

import { useState } from 'react';
import { DISCOVERY_FIELDS, FRAMEWORKS, discoveryGaps, readDiscovery, writeDiscovery, type DiscoveryPacket, type DiscoveryField } from '@/lib/case-discovery';

type Props = {
  notes: string;
  onChange: (notes: string) => void;
  onSave: () => Promise<boolean>;
  onReviewProposal: () => void;
  saving: boolean;
  savedNotes: string;
  proposalBlocked?: boolean;
};
const GROUPS: { title: string; fields: DiscoveryField[]; prompt: string }[] = [
  { title: 'Frame the question', fields: ['question', 'context', 'measurement', 'timeframe', 'definitions'], prompt: 'Thank them for their time. Replay the situation and ask what needs correcting. Clarify how success will be measured and by when.' },
  { title: 'Investigate', fields: ['buckets', 'evidence', 'missingEvidence'], prompt: 'Explain your approach and invite their input. Keep buckets distinct and check that they cover the problem. Separate observed facts from assumptions.' },
  { title: 'Recap and decide', fields: ['rootCauses', 'options', 'nextStep'], prompt: 'Recap the objective, likely causes and options. Discuss the implications, then agree on an owner and date for the next step.' },
];

export function DiscoveryProposalReview({ notes }: { notes: string }) {
  const { packet } = readDiscovery(notes);
  if (!DISCOVERY_FIELDS.some(([key]) => packet[key].trim())) return null;
  const gaps = discoveryGaps(packet);
  return <details className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200">
    <summary className="cursor-pointer font-medium">Discovery review · Internal only</summary>
    <p className="mt-3 text-gray-400">Use these findings to review scope, outcomes and line items. These notes are excluded from the proposal and client dashboard.</p>
    {gaps.length > 0 && <p className="mt-2 text-amber-300">Follow up: {gaps.join(' · ')}</p>}
    <dl className="mt-3 space-y-3">
      {DISCOVERY_FIELDS.map(([key, label]) => packet[key].trim() && <div key={key}><dt className="text-gray-400">{label}</dt><dd className="whitespace-pre-wrap break-words">{packet[key]}</dd></div>)}
    </dl>
  </details>;
}

export function CaseDiscoveryPanel({ notes, onChange, onSave, onReviewProposal, saving, savedNotes, proposalBlocked }: Props) {
  const { plainNotes, packet } = readDiscovery(notes);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const dirty = notes !== savedNotes;
  const gaps = discoveryGaps(packet);
  const change = (patch: Partial<DiscoveryPacket>) => {
    setMessage('');
    onChange(writeDiscovery(plainNotes, { ...packet, ...patch }));
  };
  const save = async (review: boolean) => {
    setMessage('');
    setFailed(false);
    try {
      if (!await onSave()) throw new Error('Save failed');
      setMessage('Discovery and call notes saved.');
      if (review) onReviewProposal();
    } catch {
      setFailed(true);
      setMessage('Could not save. Your edits are still here. Check your session and retry.');
    }
  };
  return <section aria-label="Case discovery" className="min-w-0 rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-200">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium text-white">Case discovery</h3>
      <span className="text-xs text-gray-400">Internal only{dirty ? ' · Unsaved' : ''}</span>
    </div>
    <p className="mt-2 text-gray-400">Frame the problem. Gather evidence. Agree on the next step.</p>
    <div className="mt-3 space-y-2">
      {GROUPS.map((group, index) => <details key={group.title} className="rounded-lg border border-gray-800 p-3">
        <summary className="cursor-pointer font-medium">{index + 1}. {group.title}</summary>
        <details className="mt-3 text-gray-400"><summary className="cursor-pointer text-xs">Call prompts</summary><p className="mt-2">{group.prompt}</p></details>
        {index === 1 && <div className="mt-3 space-y-2">
          <label className="block">Framework<select aria-label="Framework" disabled={saving} value={packet.framework} onChange={e => change({ framework: e.target.value as DiscoveryPacket['framework'] })} className="mt-1 w-full rounded border border-gray-700 bg-gray-800 p-2">{Object.entries(FRAMEWORKS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <p className="text-xs text-gray-400">{FRAMEWORKS[packet.framework].prompt}</p>
          <label className="flex items-start gap-2"><input type="checkbox" disabled={saving} checked={packet.aligned} onChange={e => change({ aligned: e.target.checked })} className="mt-1" /> Client confirmed the approach</label>
        </div>}
        {group.fields.map(key => <label key={key} className="mt-3 block">{DISCOVERY_FIELDS.find(([field]) => field === key)![1]}<textarea aria-label={DISCOVERY_FIELDS.find(([field]) => field === key)![1]} disabled={saving} rows={2} maxLength={6000} value={packet[key]} onChange={e => change({ [key]: e.target.value })} className="mt-1 block w-full min-w-0 rounded border border-gray-700 bg-gray-800 p-2 text-white" /></label>)}
      </details>)}
    </div>
    <details className="mt-3"><summary className="cursor-pointer text-gray-400">{gaps.length ? `${gaps.length} follow-ups before proposal review` : 'Core questions covered'}</summary><ul className="mt-2 list-disc space-y-1 pl-5">{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>{packet.missingEvidence.trim() && <p className="mt-2 whitespace-pre-wrap break-words">Missing evidence: {packet.missingEvidence}</p>}</details>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={saving} onClick={() => save(false)} className="rounded-lg border border-gray-600 px-3 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save discovery'}</button>
      <button type="button" disabled={saving || proposalBlocked} onClick={() => save(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Save and review proposal</button>
    </div>
    {proposalBlocked && <p className="mt-2 text-xs text-amber-300">Select an offer or resolve the saved proposal loading error to continue.</p>}
    {message && <p role={failed ? 'alert' : 'status'} className="mt-2">{message}</p>}
  </section>;
}
