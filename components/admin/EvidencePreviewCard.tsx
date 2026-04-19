'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';

export type EvidenceKind =
  | 'audit_response'
  | 'meeting_quote'
  | 'tech_stack'
  | 'value_formula'
  | 'benchmark'
  | 'pain_point_excerpt';

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  sourceLabel: string;
  verbatim: string;
  meta?: Record<string, string | number | undefined>;
}

interface EvidencePreviewResponse {
  items: EvidenceItem[];
  counts: Record<EvidenceKind, number>;
  meetingsAvailable: number;
}

const KIND_LABELS: Record<EvidenceKind, string> = {
  audit_response: 'Audit responses',
  meeting_quote: 'Meeting quotes',
  tech_stack: 'Tech stack',
  value_formula: 'Value formulas',
  benchmark: 'Benchmarks',
  pain_point_excerpt: 'Pain point excerpts',
};

const KIND_COLORS: Record<EvidenceKind, string> = {
  audit_response: 'bg-blue-900/30 text-blue-200 border-blue-800',
  meeting_quote: 'bg-amber-900/30 text-amber-200 border-amber-800',
  tech_stack: 'bg-cyan-900/30 text-cyan-200 border-cyan-800',
  value_formula: 'bg-emerald-900/30 text-emerald-200 border-emerald-800',
  benchmark: 'bg-purple-900/30 text-purple-200 border-purple-800',
  pain_point_excerpt: 'bg-rose-900/30 text-rose-200 border-rose-800',
};

interface Props {
  contactId: string;
  auditId?: string;
  valueReportId?: string;
  getToken: () => Promise<string | null>;
}

export default function EvidencePreviewCard({ contactId, auditId, valueReportId, getToken }: Props) {
  const [data, setData] = useState<EvidencePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setData(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) return;
        const params = new URLSearchParams({ contactSubmissionId: contactId });
        if (auditId) params.set('auditId', auditId);
        if (valueReportId) params.set('valueReportId', valueReportId);
        const res = await fetch(`/api/admin/gamma-reports/evidence-preview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load evidence preview.');
          return;
        }
        const json = (await res.json()) as EvidencePreviewResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError('Could not load evidence preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [contactId, auditId, valueReportId, getToken]);

  const totalCount = data?.items.length ?? 0;
  const meetingCount = data?.counts.meeting_quote ?? 0;
  const meetingsAvailable = data?.meetingsAvailable ?? 0;

  const grouped = useMemo(() => {
    const map: Partial<Record<EvidenceKind, EvidenceItem[]>> = {};
    if (!data) return map;
    for (const item of data.items) {
      if (!map[item.kind]) map[item.kind] = [];
      map[item.kind]!.push(item);
    }
    return map;
  }, [data]);

  if (!contactId) {
    return null;
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <BookOpen className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Evidence Preview</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading source citations...
                </span>
              ) : totalCount === 0 ? (
                'No source evidence found yet — report will rely on AI inference only.'
              ) : (
                `${totalCount} citable source${totalCount === 1 ? '' : 's'} will be referenced inline and listed on the final "Where These Findings Come From" slide.`
              )}
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
        <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-3">
          {error && (
            <div className="text-xs text-rose-300 bg-rose-900/30 border border-rose-800 rounded p-2">
              {error}
            </div>
          )}

          {meetingsAvailable === 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-900/20 border border-amber-800 rounded p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No meeting transcripts found for this contact.</p>
                <p className="text-amber-300/80 mt-1">
                  The report can still cite audit responses, tech stack, and value formulas, but recommendations will not be backed by verbatim discovery quotes. Add a meeting record (transcript or structured notes) to strengthen attribution.
                </p>
              </div>
            </div>
          )}

          {data && data.items.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABELS) as EvidenceKind[]).map((kind) => {
                  const count = data.counts[kind] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={kind}
                      className={`text-xs px-2 py-1 rounded border ${KIND_COLORS[kind]}`}
                    >
                      {KIND_LABELS[kind]}: {count}
                    </span>
                  );
                })}
              </div>

              <div className="space-y-3">
                {(Object.keys(KIND_LABELS) as EvidenceKind[]).map((kind) => {
                  const items = grouped[kind];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={kind} className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        {KIND_LABELS[kind]}
                      </h4>
                      <ul className="space-y-1.5">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="text-xs text-gray-300 bg-gray-800/50 border border-gray-800 rounded p-2"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-emerald-400 font-semibold">
                                [{item.id}]
                              </span>
                              <span className="text-gray-400">{item.sourceLabel}</span>
                            </div>
                            <p className="text-gray-300 line-clamp-3 whitespace-pre-wrap">
                              &ldquo;{item.verbatim}&rdquo;
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!loading && !error && data && data.items.length === 0 && meetingsAvailable > 0 && (
            <p className="text-xs text-gray-500">
              Meetings exist but produced no extractable evidence in this context.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
