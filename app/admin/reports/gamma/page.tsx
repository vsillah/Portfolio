'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
  Info,
  Palette,
  Settings,
  Square,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import ExternalInputCard, { type ReportContextPreview } from '@/components/admin/ExternalInputCard';
import AssetPicker, { type AssetPickerItem } from '@/components/admin/AssetPicker';
import { ExtractionStatusChip } from '@/components/admin/ExtractionStatusChip';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';

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

interface GammaReportCompanionVideo {
  job_id: string;
  heygen_status: string | null;
  /** HeyGen share page (preferred) or CDN URL when generation completed */
  watch_url: string | null;
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
  companion_video?: GammaReportCompanionVideo | null;
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
  const [audits, setAudits] = useState<
    { id: string | number; created_at: string; status: string; audit_type?: string | null }[]
  >([]);
  const [valueReportId, setValueReportId] = useState<string>(searchParams.get('valueReportId') || '');
  const [valueReports, setValueReports] = useState<{ id: string; title: string }[]>([]);

  // External inputs (smart cards)
  const [assembledFindings, setAssembledFindings] = useState<string | undefined>();
  const [assembledCompetitor, setAssembledCompetitor] = useState<string | undefined>();
  const [assembledSiteData, setAssembledSiteData] = useState<string | undefined>();
  const [customInstructions, setCustomInstructions] = useState('');
  const [previewData, setPreviewData] = useState<ReportContextPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  // Avatar & Voice (from heygen-config DB)
  const [configAvatars, setConfigAvatars] = useState<AssetPickerItem[]>([]);
  const [configVoices, setConfigVoices] = useState<AssetPickerItem[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [triggerAllLoading, setTriggerAllLoading] = useState(false);

  // Theme
  const [themes, setThemes] = useState<{ id: string; name: string }[]>([]);
  const [defaultThemeId, setDefaultThemeId] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [loadingThemes, setLoadingThemes] = useState(true);

  // History
  const [reports, setReports] = useState<GammaReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [externalExpandAllKey, setExternalExpandAllKey] = useState(0);
  const [externalCollapseAllKey, setExternalCollapseAllKey] = useState(0);

  const getToken = useCallback(async () => {
    const s = session || (await getCurrentSession());
    return s?.access_token || '';
  }, [session]);

  // Fetch avatars & voices from heygen-config (DB-managed)
  const fetchHeyGenConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setConfigLoading(true);
    try {
      const res = await fetch('/api/admin/video-generation/heygen-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.avatars)) setConfigAvatars(data.avatars);
        if (Array.isArray(data.voices)) setConfigVoices(data.voices);
        const defAvatar = data.defaults?.avatarId as string | null | undefined;
        const defVoice = data.defaults?.voiceId as string | null | undefined;
        setSelectedAvatarId((prev) => prev ?? defAvatar ?? null);
        setSelectedVoiceId((prev) => prev ?? defVoice ?? null);
      }
    } catch { /* non-critical */ }
    setConfigLoading(false);
  }, [getToken]);

  const heygenWorkflow = useWorkflowStatus(
    { apiBase: '/api/admin/video-generation/workflow-status', workflowId: 'vgen_heygen' },
    () => { void fetchHeyGenConfig() },
  );

  const driveWorkflow = useWorkflowStatus({
    apiBase: '/api/admin/video-generation/workflow-status',
    workflowId: 'vgen_drive',
  });

  const eitherRunning =
    heygenWorkflow.state === 'running' || heygenWorkflow.state === 'stale' ||
    driveWorkflow.state === 'running' || driveWorkflow.state === 'stale';

  const triggerHeyGenSync = async () => {
    heygenWorkflow.onTriggerStarted();
    setConfigMessage(null);
    try {
      const token = await getToken();
      if (!token) {
        heygenWorkflow.refetch();
        return;
      }
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      await fetchHeyGenConfig();
    } catch {
      setConfigMessage('Sync failed — check network or try again.');
    } finally {
      heygenWorkflow.refetch();
    }
  };

  const syncDrive = async (force = false) => {
    driveWorkflow.onTriggerStarted();
    try {
      const token = await getToken();
      if (!token) {
        driveWorkflow.refetch();
        return;
      }
      await fetch('/api/admin/video-generation/sync-drive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
    } catch {
      /* chip + refetch reflect failure */
    } finally {
      driveWorkflow.refetch();
    }
  };

  const handleSyncAll = async () => {
    setTriggerAllLoading(true);
    heygenWorkflow.onTriggerStarted();
    driveWorkflow.onTriggerStarted();
    try {
      const token = await getToken();
      if (!token) {
        heygenWorkflow.refetch();
        driveWorkflow.refetch();
        return;
      }
      const [heyOutcome] = await Promise.allSettled([
        (async () => {
          const res = await fetch('/api/admin/video-generation/heygen-config', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync' }),
          });
          return { res };
        })(),
        fetch('/api/admin/video-generation/sync-drive', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: false }),
        }).then((res) => ({ res })),
      ]);
      if (heyOutcome.status === 'fulfilled' && heyOutcome.value.res.ok) {
        await fetchHeyGenConfig();
      }
    } finally {
      heygenWorkflow.refetch();
      driveWorkflow.refetch();
      setTriggerAllLoading(false);
    }
  };

  const handleCancelAll = () => {
    if (heygenWorkflow.currentRun && (heygenWorkflow.state === 'running' || heygenWorkflow.state === 'stale')) {
      heygenWorkflow.markRunFailed(heygenWorkflow.currentRun.id, 'Cancelled by user');
    }
    if (driveWorkflow.currentRun && (driveWorkflow.state === 'running' || driveWorkflow.state === 'stale')) {
      driveWorkflow.markRunFailed(driveWorkflow.currentRun.id, 'Cancelled by user');
    }
  };

  useEffect(() => {
    if (!session) return;
    fetchHeyGenConfig();
  }, [session, fetchHeyGenConfig]);

  const resolveHeyGenName = useCallback(async (assetType: 'avatar' | 'voice', assetId: string): Promise<{ name: string | null; error: string | null }> => {
    const token = await getToken();
    if (!token) return { name: null, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_name', assetType, assetId }),
      });
      const data = await res.json().catch(() => ({}));
      return { name: data.name ?? null, error: data.error ?? null };
    } catch { return { name: null, error: 'Network error' }; }
  }, [getToken]);

  const toggleFavoriteAvatar = useCallback(async (assetId: string, fav: boolean) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_favorite', assetType: 'avatar', assetId, favorite: fav }),
      });
      setConfigAvatars(prev => prev.map(a => a.asset_id === assetId ? { ...a, is_favorite: fav } : a));
    } catch { /* non-critical */ }
  }, [getToken]);

  const addManualAvatar = useCallback(async (id: string, name: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_manual', assetType: 'avatar', assetId: id, assetName: name }),
      });
      await fetchHeyGenConfig();
    } catch { /* non-critical */ }
  }, [getToken, fetchHeyGenConfig]);

  const setDefaultAvatar = useCallback(async (assetId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_default', assetType: 'avatar', assetId }),
      });
      setConfigAvatars(prev => prev.map(a => ({ ...a, is_default: a.asset_id === assetId })));
    } catch { /* non-critical */ }
  }, [getToken]);

  const toggleFavoriteVoice = useCallback(async (assetId: string, fav: boolean) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_favorite', assetType: 'voice', assetId, favorite: fav }),
      });
      setConfigVoices(prev => prev.map(v => v.asset_id === assetId ? { ...v, is_favorite: fav } : v));
    } catch { /* non-critical */ }
  }, [getToken]);

  const setDefaultVoice = useCallback(async (assetId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/video-generation/heygen-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_default', assetType: 'voice', assetId }),
      });
      setConfigVoices(prev => prev.map(v => ({ ...v, is_default: v.asset_id === assetId })));
    } catch { /* non-critical */ }
  }, [getToken]);

  // Fetch themes
  useEffect(() => {
    if (!session) return;
    async function load() {
      const token = await getToken();
      if (!token) return;
      setLoadingThemes(true);
      try {
        const res = await fetch('/api/admin/gamma-reports/themes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.themes) ? data.themes : [];
          setThemes(list.map((t: { id: string; name?: string }) => ({ id: t.id, name: t.name || t.id })));
          const dflt = data.defaultThemeId || '';
          setDefaultThemeId(dflt);
          setSelectedTheme(dflt);
        }
      } catch { /* non-critical */ }
      setLoadingThemes(false);
    }
    load();
  }, [session, getToken]);

  // Fetch contacts
  useEffect(() => {
    if (!session) return;
    async function load() {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/admin/contact-submissions?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.submissions ?? data.contacts ?? (Array.isArray(data) ? data : []);
        setContacts(Array.isArray(list) ? list : []);
      }
    }
    load();
  }, [session, getToken]);

  // Fetch audits when contact changes
  useEffect(() => {
    if (!contactId) {
      setAudits([]);
      setAuditId('');
      return;
    }
    async function load() {
      const token = await getToken();
      const qs = new URLSearchParams({ contact_submission_id: contactId });
      const res = await fetch(`/api/admin/diagnostic-audits/by-contact?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const auditList = Array.isArray(data.audits) ? data.audits : [];
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

  // Fetch report context preview for ExternalInputCards
  useEffect(() => {
    if (!contactId) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingPreview(true);
      try {
        const token = await getToken();
        const params = new URLSearchParams({ contactId });
        if (auditId) params.set('auditId', auditId);
        const res = await fetch(`/api/admin/value-evidence/report-context-preview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPreviewData(data);
        }
      } catch {
        // preview is non-critical; cards show empty state
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [contactId, auditId, getToken]);

  // Fetch report history — waits for session to avoid 401 on initial mount
  const fetchReports = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingReports(true);
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
    if (session) fetchReports();
  }, [session, fetchReports]);

  // Generate report
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      let token = await getToken();
      if (!token) {
        setError('Session expired. Please sign in again.');
        return;
      }
      const body: Record<string, unknown> = {
        reportType,
        externalInputs: {
          thirdPartyFindings: assembledFindings || undefined,
          competitorPlatform: assembledCompetitor || undefined,
          siteCrawlData: assembledSiteData || undefined,
          customInstructions: customInstructions || undefined,
        },
        externalInputSources: {
          thirdPartyFindings: assembledFindings ? 'provided' : 'none',
          competitorPlatform: assembledCompetitor ? 'provided' : 'none',
          siteCrawlData: assembledSiteData ? 'provided' : 'none',
        },
      };

      if (contactId) body.contactSubmissionId = parseInt(contactId, 10);
      // diagnostic_audits.id is UUID — do not parseInt
      if (auditId) body.diagnosticAuditId = auditId;
      if (valueReportId) body.valueReportId = valueReportId;
      if (selectedTheme) body.theme = selectedTheme;

      const bodyJson = JSON.stringify(body);
      const postGamma = (t: string) =>
        fetch('/api/admin/gamma-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
          },
          body: bodyJson,
        });

      let res = await postGamma(token);
      if (res.status === 401) {
        await supabase.auth.refreshSession();
        const fresh = await getCurrentSession();
        if (fresh?.access_token) {
          token = fresh.access_token;
          res = await postGamma(token);
        }
      }

      const data = await res.json();

      if (!res.ok) {
        // Prefer API `details` (e.g. Gamma error message); generic `error` alone hides it (502 uses both).
        const raw =
          typeof data.details === 'string' && data.details.trim()
            ? data.details.trim()
            : typeof data.error === 'string'
              ? data.error
              : 'Generation failed';
        const detail =
          res.status === 401 || raw === 'Authentication required'
            ? 'Session expired. Please refresh the page or sign in again.'
            : raw;
        setError(detail);
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
        body: JSON.stringify({
          gammaReportId: reportId,
          avatarId: selectedAvatarId ?? undefined,
          voiceId: selectedVoiceId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompanionError(data.error || 'Failed to start companion video.');
        return;
      }
      setCompanionJobId(data.jobId);
      void fetchReports();
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
                {audits.map((a) => {
                  const idStr = String(a.id);
                  const idShort = idStr.length > 8 ? `${idStr.slice(0, 8)}…` : idStr;
                  return (
                  <option key={idStr} value={idStr}>
                    {a.audit_type ? `${a.audit_type} · ` : ''}
                    {idShort} — {a.status} — {new Date(a.created_at).toLocaleDateString()}
                  </option>
                  );
                })}
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

        {/* Theme Selector */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Theme</span>
            {selectedTheme === defaultThemeId && defaultThemeId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-800">default</span>
            )}
          </div>
          {loadingThemes ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading themes...
            </div>
          ) : themes.length === 0 ? (
            <p className="text-xs text-gray-500">No themes available. Reports will use workspace default.</p>
          ) : (
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
            >
              <option value="">Workspace default</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.id === defaultThemeId ? ' (AmaduTown)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* HeyGen Configuration — same title as Video Generation */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <Settings className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-300">HeyGen Configuration</span>
            {!configLoading && (
              <span className="text-[10px] text-gray-400">
                {selectedAvatarId && (
                  <>
                    Avatar:{' '}
                    <span className="text-gray-300">
                      {configAvatars.find((a) => a.asset_id === selectedAvatarId)?.asset_name ?? 'Unknown'}
                    </span>
                  </>
                )}
                {selectedAvatarId && selectedVoiceId && ' · '}
                {selectedVoiceId && (
                  <>
                    Voice:{' '}
                    <span className="text-gray-300">
                      {configVoices.find((v) => v.asset_id === selectedVoiceId)?.asset_name ?? 'Unknown'}
                    </span>
                  </>
                )}
                {!selectedAvatarId && !selectedVoiceId && (
                  <span className="text-amber-400/80">No selection — defaults from Video Generation will apply</span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {eitherRunning ? (
              <button
                type="button"
                onClick={handleCancelAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
              >
                <Square className="w-4 h-4" />
                Cancel Pipeline
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { void handleSyncAll(); }}
                disabled={triggerAllLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all"
              >
                {triggerAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Run Full Pipeline
              </button>
            )}
            <ExtractionStatusChip
              label="HeyGen"
              pipelinePhase={{ current: 1, total: 2 }}
              state={heygenWorkflow.state}
              currentRun={heygenWorkflow.currentRun}
              recentRuns={heygenWorkflow.recentRuns}
              elapsedMs={heygenWorkflow.elapsedMs}
              isDrawerOpen={heygenWorkflow.isDrawerOpen}
              isHistoryOpen={heygenWorkflow.isHistoryOpen}
              toggleDrawer={heygenWorkflow.toggleDrawer}
              toggleHistory={heygenWorkflow.toggleHistory}
              markRunFailed={heygenWorkflow.markRunFailed}
              onRetry={triggerHeyGenSync}
            />
            <ExtractionStatusChip
              label="Drive"
              pipelinePhase={{ current: 2, total: 2 }}
              state={driveWorkflow.state}
              currentRun={driveWorkflow.currentRun}
              recentRuns={driveWorkflow.recentRuns}
              elapsedMs={driveWorkflow.elapsedMs}
              isDrawerOpen={driveWorkflow.isDrawerOpen}
              isHistoryOpen={driveWorkflow.isHistoryOpen}
              toggleDrawer={driveWorkflow.toggleDrawer}
              toggleHistory={driveWorkflow.toggleHistory}
              markRunFailed={driveWorkflow.markRunFailed}
              onRetry={() => { void syncDrive(false); }}
              drawerFooterAction={{
                label: 'Force resync all (re-scan entire folder)',
                onClick: () => { void syncDrive(true); },
                disabled: driveWorkflow.state === 'running' || driveWorkflow.state === 'stale',
              }}
            />
            {configMessage && <span className="text-[10px] text-red-400/90">{configMessage}</span>}
            {configLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
          </div>
          {configLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading HeyGen config...
            </div>
          ) : (
            <>
              {configAvatars.length > 0 ? (
                <AssetPicker
                  label="Avatar"
                  items={configAvatars}
                  selectedId={selectedAvatarId}
                  onSelect={(id) => setSelectedAvatarId(id)}
                  onToggleFavorite={(id, fav) => toggleFavoriteAvatar(id, fav)}
                  onAddManual={async (id, name) => { await addManualAvatar(id, name) }}
                  onSetDefault={(id) => setDefaultAvatar(id)}
                  onResolveName={(id) => resolveHeyGenName('avatar', id)}
                />
              ) : (
                <p className="text-xs text-gray-500">
                  No avatars in the database yet. Use the <strong className="text-gray-400">HeyGen</strong> status chip above (or <strong className="text-gray-400">Run Full Pipeline</strong>) to sync from your HeyGen account.
                </p>
              )}
              {configVoices.length > 0 ? (
                <AssetPicker
                  label="Voice"
                  items={configVoices}
                  selectedId={selectedVoiceId}
                  onSelect={(id) => setSelectedVoiceId(id)}
                  onToggleFavorite={(id, fav) => toggleFavoriteVoice(id, fav)}
                  onSetDefault={(id) => setDefaultVoice(id)}
                />
              ) : (
                <p className="text-xs text-gray-500">
                  No voices in the database yet. Use the <strong className="text-gray-400">HeyGen</strong> chip above (or <strong className="text-gray-400">Run Full Pipeline</strong>) to sync voices from your HeyGen account.
                </p>
              )}
            </>
          )}
        </div>

        {/* External Inputs — smart cards (collapsed by default); sits above custom instructions + Data Sources */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">External Inputs</h2>
              <p className="text-sm text-gray-400 mt-1">
                Include database data and/or upload files to enrich the report. Expand a section to select sources.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setExternalExpandAllKey((k) => k + 1)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={() => setExternalCollapseAllKey((k) => k + 1)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                Collapse all
              </button>
            </div>
          </div>

          <ExternalInputCard
            title="Audit Findings"
            slot="thirdPartyFindings"
            previewData={previewData}
            loading={loadingPreview}
            onChange={setAssembledFindings}
            getToken={getToken}
            expandAllSignal={externalExpandAllKey}
            collapseAllSignal={externalCollapseAllKey}
          />

          <ExternalInputCard
            title="Competitor / Platform Info"
            slot="competitorPlatform"
            previewData={previewData}
            loading={loadingPreview}
            onChange={setAssembledCompetitor}
            getToken={getToken}
            expandAllSignal={externalExpandAllKey}
            collapseAllSignal={externalCollapseAllKey}
          />

          <ExternalInputCard
            title="Site / Tech Data"
            slot="siteCrawlData"
            previewData={previewData}
            loading={loadingPreview}
            onChange={setAssembledSiteData}
            getToken={getToken}
            expandAllSignal={externalExpandAllKey}
            collapseAllSignal={externalCollapseAllKey}
          />
        </div>

        {/* Custom instructions — directly above Data Sources */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <label className="block text-sm font-semibold text-white mb-2">
            Custom Instructions
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Optional notes for this run (tone, slide focus, exclusions). External Inputs above supply structured data from the database or files.
          </p>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Additional context, focus areas, or specific requests for the presentation..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-y"
          />
        </div>

        {/* Data Completeness / Data Sources */}
        <DataCompletenessPanel
          hasContact={!!contactId}
          hasAudit={!!auditId}
          hasValueReport={!!valueReportId}
          serviceCount={0}
          reportType={reportType}
        />

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
                    <th className="text-left px-4 py-3 font-medium">Report</th>
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
                        {report.contact_submissions ? (
                          <Link href={`/admin/contacts/${report.contact_submissions.id}`} className="hover:text-teal-400 transition-colors">
                            {report.contact_submissions.name}
                          </Link>
                        ) : '—'}
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
                            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                          >
                            Open report <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CompanionVideoCell
                          report={report}
                          isStartingForThisRow={generatingCompanion && companionReportId === report.id}
                          generatingCompanion={generatingCompanion}
                          onGenerate={() => handleGenerateCompanionVideo(report.id)}
                        />
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

function CompanionVideoCell({
  report,
  isStartingForThisRow,
  generatingCompanion,
  onGenerate,
}: {
  report: GammaReport;
  isStartingForThisRow: boolean;
  generatingCompanion: boolean;
  onGenerate: () => void;
}) {
  const cv = report.companion_video;
  const adminJobHref = cv?.job_id
    ? `/admin/content/video-generation?jobId=${encodeURIComponent(cv.job_id)}`
    : null;

  if (isStartingForThisRow) {
    return (
      <span className="text-gray-500 text-xs inline-flex items-center gap-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Starting…
      </span>
    );
  }

  if (cv?.watch_url) {
    return (
      <a
        href={cv.watch_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
      >
        <Video className="w-3.5 h-3.5 shrink-0" />
        View video
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      </a>
    );
  }

  if (cv?.job_id && adminJobHref) {
    const st = cv.heygen_status;
    if (st === 'failed') {
      return (
        <Link href={adminJobHref} className="text-red-400 hover:text-red-300 text-sm inline-flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Video failed
        </Link>
      );
    }
    if (st === 'completed' && !cv.watch_url) {
      return (
        <Link href={adminJobHref} className="text-amber-400/90 hover:text-amber-300 text-sm">
          Open video job
        </Link>
      );
    }
    return (
      <Link
        href={adminJobHref}
        className="text-gray-400 hover:text-gray-300 text-sm inline-flex items-center gap-1"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        In progress
      </Link>
    );
  }

  return (
    <span className="text-gray-600 text-sm inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>—</span>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generatingCompanion}
        className="text-gray-500 hover:text-amber-400/90 underline-offset-2 hover:underline disabled:opacity-40 text-xs"
      >
        Generate video
      </button>
    </span>
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

// Describes which data sources each template benefits from
const TEMPLATE_DATA_NEEDS: Record<string, { required: string[]; optional: string[] }> = {
  value_quantification: {
    required: ['Value Report'],
    optional: ['Contact', 'Diagnostic Audit'],
  },
  implementation_strategy: {
    required: ['Contact'],
    optional: ['Diagnostic Audit', 'Value Report'],
  },
  audit_summary: {
    required: ['Diagnostic Audit'],
    optional: ['Contact', 'Value Report'],
  },
  prospect_overview: {
    required: ['Contact'],
    optional: ['Diagnostic Audit', 'Value Report'],
  },
};

function DataCompletenessPanel({
  hasContact,
  hasAudit,
  hasValueReport,
  serviceCount,
  reportType,
}: {
  hasContact: boolean;
  hasAudit: boolean;
  hasValueReport: boolean;
  serviceCount: number;
  reportType: string;
}) {
  const sources = [
    { label: 'Contact', available: hasContact },
    { label: 'Diagnostic Audit', available: hasAudit },
    { label: 'Value Report', available: hasValueReport },
  ];

  const needs = TEMPLATE_DATA_NEEDS[reportType] || { required: [], optional: [] };
  const missingRequired = needs.required.filter(
    (n: string) => !sources.find((s) => s.label === n)?.available
  );
  const missingOptional = needs.optional.filter(
    (n: string) => !sources.find((s) => s.label === n)?.available
  );
  const allOptionalPresent = missingOptional.length === 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Data Sources</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {sources.map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              s.available
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.available ? 'bg-emerald-400' : 'bg-gray-600'}`} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Services (auto-loaded)
        </span>
      </div>
      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-400 mt-2">
          Recommended for this template: {missingRequired.join(', ')}
        </p>
      )}
      {missingRequired.length === 0 && !allOptionalPresent && (
        <p className="text-xs text-gray-500 mt-2">
          Optional data not selected: {missingOptional.join(', ')} — some slides will be omitted.
        </p>
      )}
    </div>
  );
}
