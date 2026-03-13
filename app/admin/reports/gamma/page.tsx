'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  FileText,
  BarChart3,
  Loader2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Video,
} from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportType = 'value_quantification' | 'implementation_strategy' | 'audit_summary' | 'prospect_overview';

interface Contact {
  id: number;
  name: string;
  company: string | null;
  email: string;
}

interface GammaReport {
  id: string;
  report_type: ReportType;
  title: string | null;
  gamma_url: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  contact_submissions: Contact | null;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string; slides: number }[] = [
  {
    value: 'value_quantification',
    label: 'Value Quantification',
    description: '"Cost of Standing Still" — pain points mapped to dollar values with ROI, payback, and phased roadmap.',
    slides: 16,
  },
  {
    value: 'implementation_strategy',
    label: 'Implementation Strategy',
    description: 'Current state assessment, 3-track plan (DIY / Platform / ATAS), investment comparison, phased approach.',
    slides: 19,
  },
  {
    value: 'audit_summary',
    label: 'Audit Summary',
    description: 'Diagnostic audit results across all 6 categories with key insights and recommended actions.',
    slides: 10,
  },
  {
    value: 'prospect_overview',
    label: 'Prospect Overview',
    description: 'Lighter deck for prospects without a full audit — industry benchmarks and relevant services.',
    slides: 8,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GammaReportsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <GammaReportsContent />
    </ProtectedRoute>
  );
}

function GammaReportsContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();

  // Form state
  const [reportType, setReportType] = useState<ReportType>(
    (searchParams.get('type') as ReportType) || 'value_quantification'
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>(searchParams.get('contactId') || '');
  const [contactSearch, setContactSearch] = useState('');
  const [auditId, setAuditId] = useState<string>(searchParams.get('auditId') || '');
  const [audits, setAudits] = useState<{ id: number; created_at: string; status: string }[]>([]);
  const [valueReportId, setValueReportId] = useState<string>(searchParams.get('valueReportId') || '');
  const [valueReports, setValueReports] = useState<{ id: string; title: string }[]>([]);

  // External inputs
  const [thirdPartyFindings, setThirdPartyFindings] = useState('');
  const [competitorPlatform, setCompetitorPlatform] = useState('');
  const [siteCrawlData, setSiteCrawlData] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ gammaUrl: string; reportId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Companion video
  const [generatingCompanion, setGeneratingCompanion] = useState(false);
  const [companionError, setCompanionError] = useState<string | null>(null);
  const [companionJobId, setCompanionJobId] = useState<string | null>(null);
  const [companionReportId, setCompanionReportId] = useState<string | null>(null);

  // History
  const [reports, setReports] = useState<GammaReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const getToken = useCallback(async () => {
    const s = session || (await getCurrentSession());
    return s?.access_token || '';
  }, [session]);

  // Fetch contacts
  useEffect(() => {
    async function load() {
      const token = await getToken();
      const res = await fetch('/api/admin/contact-submissions?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || data || []);
      }
    }
    load();
  }, [getToken]);

  // Fetch audits when contact changes
  useEffect(() => {
    if (!contactId) {
      setAudits([]);
      setAuditId('');
      return;
    }
    async function load() {
      const token = await getToken();
      const res = await fetch(`/api/chat/diagnostic?contactId=${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const auditList = Array.isArray(data) ? data : data.audits || [];
        setAudits(auditList);
        if (auditList.length === 1) setAuditId(String(auditList[0].id));
      }
    }
    load();
  }, [contactId, getToken]);

  // Fetch value reports when contact changes
  useEffect(() => {
    if (!contactId) {
      setValueReports([]);
      setValueReportId('');
      return;
    }
    async function load() {
      const token = await getToken();
      const res = await fetch(`/api/admin/value-evidence/reports?contactId=${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const reportList = Array.isArray(data) ? data : data.reports || [];
        setValueReports(reportList);
        if (reportList.length === 1) setValueReportId(reportList[0].id);
      }
    }
    load();
  }, [contactId, getToken]);

  // Fetch report history
  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    const token = await getToken();
    const res = await fetch('/api/admin/gamma-reports?limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports || []);
    }
    setLoadingReports(false);
  }, [getToken]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Generate report
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        reportType,
        externalInputs: {
          thirdPartyFindings: thirdPartyFindings || undefined,
          competitorPlatform: competitorPlatform || undefined,
          siteCrawlData: siteCrawlData || undefined,
          customInstructions: customInstructions || undefined,
        },
      };

      if (contactId) body.contactSubmissionId = parseInt(contactId, 10);
      if (auditId) body.diagnosticAuditId = parseInt(auditId, 10);
      if (valueReportId) body.valueReportId = valueReportId;

      const res = await fetch('/api/admin/gamma-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details || 'Generation failed');
        return;
      }

      setResult({
        gammaUrl: data.gammaUrl,
        reportId: data.reportId,
        title: data.title,
      });
      fetchReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyUrl() {
    if (result?.gammaUrl) {
      navigator.clipboard.writeText(result.gammaUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleGenerateCompanionVideo(reportId: string) {
    setCompanionError(null);
    setCompanionJobId(null);
    setCompanionReportId(reportId);
    setGeneratingCompanion(true);
    try {
      const session = await getCurrentSession();
      if (!session) {
        setCompanionError('Please sign in again.');
        return;
      }
      const res = await fetch('/api/admin/video-generation/companion-from-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ gammaReportId: reportId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompanionError(data.error || 'Failed to start companion video.');
        return;
      }
      setCompanionJobId(data.jobId);
    } catch (err) {
      setCompanionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGeneratingCompanion(false);
    }
  }

  const filteredContacts = contactSearch
    ? contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.company?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(contactSearch.toLowerCase())
      )
    : contacts;

  const selectedType = REPORT_TYPES.find((t) => t.value === reportType)!;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Gamma Reports' },
          ]}
        />

        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Gamma Report Generator
          </h1>
          <p className="text-gray-400 mt-1">
            Generate professional Gamma presentations from audit data, value evidence, and service content.
          </p>
        </div>

        {/* Report Type Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">Report Template</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setReportType(type.value)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  reportType === type.value
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{type.label}</span>
                  <span className="text-xs text-gray-500">{type.slides} slides</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Context Pickers */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Context</h2>

          {/* Contact Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contact / Prospect</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="mt-2 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— No contact selected —</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''} — {c.email}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Picker */}
          {audits.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Diagnostic Audit</label>
              <select
                value={auditId}
                onChange={(e) => setAuditId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— No audit selected —</option>
                {audits.map((a) => (
                  <option key={a.id} value={a.id}>
                    Audit #{a.id} — {a.status} — {new Date(a.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Value Report Picker */}
          {valueReports.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Value Report</label>
              <select
                value={valueReportId}
                onChange={(e) => setValueReportId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— No value report selected —</option>
                {valueReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* External Inputs */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">External Inputs</h2>
          <p className="text-sm text-gray-400">
            Paste third-party findings, competitor info, or site data to enrich the report.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Third-Party Audit Findings
            </label>
            <textarea
              value={thirdPartyFindings}
              onChange={(e) => setThirdPartyFindings(e.target.value)}
              placeholder="Paste consulting recommendations, audit findings, or assessment results..."
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Competitor / Platform Info
            </label>
            <textarea
              value={competitorPlatform}
              onChange={(e) => setCompetitorPlatform(e.target.value)}
              placeholder="Platform capabilities, pricing, limitations (e.g. Firespring features, Squarespace plans)..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Site Crawl Data
            </label>
            <textarea
              value={siteCrawlData}
              onChange={(e) => setSiteCrawlData(e.target.value)}
              placeholder="Page count, navigation structure, bounce rates, key metrics from site audit..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Custom Instructions
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Additional context, focus areas, or specific requests for the presentation..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating {selectedType.label}...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate {selectedType.label}
              </>
            )}
          </button>
          {generating && (
            <span className="text-sm text-gray-400">
              This may take 30–60 seconds while Gamma creates your presentation...
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-medium">Generation Failed</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-emerald-300">Presentation Generated</h3>
            </div>
            <p className="text-white font-medium">{result.title}</p>
            <div className="flex items-center gap-3">
              <a
                href={result.gammaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Gamma
              </a>
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Re-generate
              </button>
              <button
                onClick={() => result?.reportId && handleGenerateCompanionVideo(result.reportId)}
                disabled={generatingCompanion}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {generatingCompanion && companionReportId === result?.reportId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Generate companion video
              </button>
            </div>
            {companionError && companionReportId === result?.reportId && (
              <p className="text-sm text-red-400 mt-2">{companionError}</p>
            )}
            {companionJobId && companionReportId === result?.reportId && (
              <p className="text-sm text-emerald-400 mt-2">
                Video job started.{' '}
                <Link href={`/admin/content/video-generation?jobId=${companionJobId}`} className="underline hover:no-underline">
                  View in Video Generation
                </Link>
              </p>
            )}
          </div>
        )}

        {companionJobId && companionReportId && companionReportId !== result?.reportId && (
          <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 flex items-center gap-3">
            <Video className="w-5 h-5 text-amber-400" />
            <p className="text-amber-200 text-sm">
              Companion video job started.{' '}
              <Link href={`/admin/content/video-generation?jobId=${companionJobId}`} className="underline hover:no-underline text-amber-300">
                View in Video Generation
              </Link>
            </p>
          </div>
        )}
        {companionError && companionReportId !== result?.reportId && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-400 text-sm">{companionError}</p>
          </div>
        )}

        {/* Report History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-400" />
              Report History
            </h2>
            <button
              onClick={fetchReports}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {loadingReports ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No reports generated yet. Create your first one above.
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Link</th>
                    <th className="text-left px-4 py-3 font-medium">Video</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white">
                        {report.title || 'Untitled'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs">
                          {REPORT_TYPES.find((t) => t.value === report.report_type)?.label || report.report_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {report.contact_submissions?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {report.gamma_url ? (
                          <a
                            href={report.gamma_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                          >
                            Open <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleGenerateCompanionVideo(report.id)}
                          disabled={generatingCompanion}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-sm disabled:opacity-50"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Companion video
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1 text-emerald-400 text-xs">
          <CheckCircle className="w-3.5 h-3.5" /> Completed
        </span>
      );
    case 'generating':
      return (
        <span className="flex items-center gap-1 text-yellow-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" /> Failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-gray-400 text-xs">
          <Clock className="w-3.5 h-3.5" /> {status}
        </span>
      );
  }
}
