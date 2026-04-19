'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, Mic, AlertCircle } from 'lucide-react';
import type { MeetingExcerpt } from './ExternalInputCard';

export interface PickedVerbatim {
  id: string;
  verbatim: string;
  sourceLabel: string;
  dateLabel?: string;
}

interface Props {
  excerpts: MeetingExcerpt[] | undefined;
  loading?: boolean;
  onChange: (picked: PickedVerbatim[]) => void;
}

export default function MeetingVerbatimPicker({ excerpts, loading, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, MeetingExcerpt[]>();
    for (const e of excerpts ?? []) {
      const arr = map.get(e.sourceLabel) ?? [];
      arr.push(e);
      map.set(e.sourceLabel, arr);
    }
    return Array.from(map.entries());
  }, [excerpts]);

  useEffect(() => {
    const picked: PickedVerbatim[] = (excerpts ?? [])
      .filter((e) => selected.has(e.excerptId))
      .map((e) => ({
        id: e.excerptId,
        verbatim: e.text,
        sourceLabel: e.sourceLabel,
        dateLabel: e.dateLabel,
      }));
    onChange(picked);
  }, [selected, excerpts, onChange]);

  const total = excerpts?.length ?? 0;
  const pickedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(groupItems: MeetingExcerpt[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of groupItems) next.add(it.excerptId);
      return next;
    });
  }

  function clearGroup(groupItems: MeetingExcerpt[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of groupItems) next.delete(it.excerptId);
      return next;
    });
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <Mic className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Meeting Verbatims</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading
                ? 'Loading meeting excerpts...'
                : total === 0
                ? 'No meeting transcripts or structured notes found for this contact.'
                : `${total} excerpt${total === 1 ? '' : 's'} available — ${pickedCount} selected to cite verbatim in the deck.`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-4">
          {total === 0 ? (
            <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/40 rounded p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Add a meeting record (transcript or structured notes) on this contact to surface verbatims here. Selected quotes will be cited inline (e.g. <span className="font-mono text-emerald-400">[E3]</span>) and listed on the final &ldquo;Where These Findings Come From&rdquo; slide.
              </p>
            </div>
          ) : (
            groups.map(([label, items]) => {
              const groupSelected = items.filter((i) => selected.has(i.excerptId)).length;
              return (
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">{label}</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">{groupSelected}/{items.length}</span>
                      <button
                        type="button"
                        onClick={() => selectAllInGroup(items)}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => clearGroup(items)}
                        className="text-gray-400 hover:text-gray-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item) => {
                      const isSel = selected.has(item.excerptId);
                      return (
                        <li key={item.excerptId}>
                          <label
                            className={`flex items-start gap-2 text-xs p-2 rounded border cursor-pointer transition-colors ${
                              isSel
                                ? 'bg-emerald-900/20 border-emerald-700 text-emerald-100'
                                : 'bg-gray-800/40 border-gray-800 text-gray-300 hover:bg-gray-800/70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggle(item.excerptId)}
                              className="mt-0.5 accent-emerald-500"
                            />
                            <span className="whitespace-pre-wrap leading-relaxed">&ldquo;{item.text}&rdquo;</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
