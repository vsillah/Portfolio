'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { parseReturnTo } from '@/lib/admin-return-context';
import { ViewDiagnosticLink } from '@/components/admin/ViewDiagnosticLink';
import { useAdminReturnPath } from '@/lib/hooks/useAdminReturnPath';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import LatestAuditBanner from '@/components/audits/LatestAuditBanner';
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
  Video,
  Info,
  Palette,
  Settings,
  Square,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import ExternalInputCard, { type ReportContextPreview } from '@/components/admin/ExternalInputCard';
import EvidencePreviewCard from '@/components/admin/EvidencePreviewCard';
import MeetingVerbatimPicker, { type PickedVerbatim } from '@/components/admin/MeetingVerbatimPicker';
import AssetPicker, { type AssetPickerItem } from '@/components/admin/AssetPicker';
import { ExtractionStatusChip } from '@/components/admin/ExtractionStatusChip';
import { GammaDeckGenerateRow } from '@/components/admin/GammaDeckGenerateRow';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportType = 'value_quantification' | 'implementation_strategy' | 'audit_summary' | 'prospect_overview' | 'offer_presentation';

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
  /** Populated by `SELECT *` on gamma_reports; null for non-audit-anchored decks. */
  diagnostic_audit_id?: string | null;
  /** bigint in DB — serialized as number by Supabase. */
  contact_submission_id?: number | null;
  contact_submissions: Contact | null;
  companion_video?: GammaReportCompanionVideo | null;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string; slides: number }[] = [
  {
    value: 'value_quantification',
    label: 'Value Quantification',
    description: '"Cost of Standing Still" — pain points mapped to dollar values with ROI, payback, and phased roadmap.',
    slides: 17,
  },
  {
    value: 'implementation_strategy',
    label: 'Implementation Strategy',
    description: 'Current state assessment, 3-track plan (DIY / Platform / ATAS), investment comparison, phased approach.',
    slides: 20,
  },
  {
    value: 'audit_summary',
    label: 'Audit Summary',
    description: 'Diagnostic audit results across all 6 categories with key insights and recommended actions.',
    slides: 11,
  },
  {
    value: 'prospect_overview',
    label: 'Prospect Overview',
    description: 'Lighter deck for prospects without a full audit — industry benchmarks and relevant services.',
    slides: 9,
  },
  {
    value: 'offer_presentation',
    label: 'Offer Presentation',
    description: 'Sales-flow-aligned deck from a bundle or pricing tier — walk clients through the offer live with presenter notes.',
    slides: 16,
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
  const returnUrl = parseReturnTo(searchParams);
  const adminReturnPath = useAdminReturnPath();

  // Form state
  const [reportType, setReportType] = useState<ReportType>(
    (searchParams.get('type') as ReportType) || 'value_quantification'
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>(searchParams.get('contactId') || '');
  const [auditId, setAuditId] = useState<string>(searchParams.get('auditId') || '');
  const [audits, setAudits] = useState<
    { id: string | number; created_at: string; status: string; audit_type?: string | null }[]
  >([]);
  const [valueReportId, setValueReportId] = useState<string>(searchParams.get('valueReportId') || '');
  const [valueReports, setValueReports] = useState<{ id: string; title: string }[]>([]);

  // Offer presentation — bundle picker
  const [bundles, setBundles] = useState<{ id: string; name: string; pricing_tier_slug: string | null }[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [loadingBundles, setLoadingBundles] = useState(false);

  // External inputs (smart cards)
  const [assembledFindings, setAssembledFindings] = useState<string | undefined>();
  const [assembledCompetitor, setAssembledCompetitor] = useState<string | undefined>();
  const [assembledSiteData, setAssembledSiteData] = useState<string | undefined>();
  const [customInstructions, setCustomInstructions] = useState('');
  const [previewData, setPreviewData] = useState<ReportContextPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pickedVerbatims, setPickedVerbatims] = useState<PickedVerbatim[]>([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ gammaUrl: string; reportId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  /**
   * When we arrive on this page with context (auditId / contactId) and an
   * audit_summary / etc. was already kicked off elsewhere (e.g. by the
   * auto-summary hook on `audit-from-meetings`), we bind the pill + progress
   * bar to that row so the UI mirrors what you'd see if you clicked Generate
   * here yourself.
   *
   * Null when nothing is in-flight for the current context.
   */
  const [trackedInFlight, setTrackedInFlight] = useState<
    { reportId: string; reportType: ReportType; startedAt: string } | null
  >(null);
  /** Remember whether the URL pinned `type=...`. We only auto-switch the
   * active template when the user didn't explicitly request one. */
  const urlTypePinnedRef = useRef<boolean>(Boolean(searchParams.get('type')));

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

  // Theme (DB catalog + Gamma sync — see AssetPicker pattern next to HeyGen)
  const [themeAssets, setThemeAssets] = useState<AssetPickerItem[]>([]);
  const [defaultThemeId, setDefaultThemeId] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [themeSyncing, setThemeSyncing] = useState(false);
  const [themesLastSync, setThemesLastSync] = useState<{
    syncedAt: string;
    success: boolean;
    themesSynced: number;
    error: string | null;
  } | null>(null);
  const [hasGammaApiKey, setHasGammaApiKey] = useState(true);

  // History
  const [reports, setReports] = useState<GammaReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [generatingValueReport, setGeneratingValueReport] = useState(false);
  const [valueReportGenerateError, setValueReportGenerateError] = useState<string | null>(null);

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

  const loadThemes = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadingThemes(true);
    try {
      const res = await fetch('/api/admin/gamma-reports/themes', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const assets = Array.isArray(data.themeAssets) ? (data.themeAssets as AssetPickerItem[]) : [];
        setThemeAssets(assets);
        setHasGammaApiKey(data.hasApiKey !== false);
        const dflt = typeof data.defaultThemeId === 'string' ? data.defaultThemeId : '';
        setDefaultThemeId(dflt || null);
        if (data.lastSync && typeof data.lastSync === 'object') {
          const ls = data.lastSync as Record<string, unknown>;
          setThemesLastSync({
            syncedAt: String(ls.syncedAt ?? ''),
            success: Boolean(ls.success),
            themesSynced: Number(ls.themesSynced ?? 0),
            error: ls.error != null ? String(ls.error) : null,
          });
        } else {
          setThemesLastSync(null);
        }
        setSelectedTheme((prev) => {
          const ids = new Set(assets.map((a) => a.asset_id));
          if (prev && ids.has(prev)) return prev;
          if (dflt && ids.has(dflt)) return dflt;
          return '';
        });
      }
    } catch {
      /* non-critical */
    }
    setLoadingThemes(false);
  }, [getToken]);

  useEffect(() => {
    if (!session) return;
    void loadThemes();
  }, [session, loadThemes]);

  const syncThemesFromGamma = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setThemeSyncing(true);
    try {
      const res = await fetch('/api/admin/gamma-reports/themes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      if (!res.ok) {
        if (process.env.NODE_ENV === 'development') {
          const errBody = await res.json().catch(() => ({}));
          console.warn('[gamma] theme sync failed', errBody);
        }
      }
      await loadThemes();
    } catch {
      await loadThemes();
    } finally {
      setThemeSyncing(false);
    }
  }, [getToken, loadThemes]);

  const toggleFavoriteTheme = useCallback(
    async (themeId: string, fav: boolean) => {
      const token = await getToken();
      if (!token) return;
      try {
        await fetch('/api/admin/gamma-reports/themes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_favorite', themeId, favorite: fav }),
        });
        setThemeAssets((prev) =>
          prev.map((t) => (t.asset_id === themeId ? { ...t, is_favorite: fav } : t))
        );
      } catch {
        /* non-critical */
      }
    },
    [getToken]
  );

  const setDefaultGammaTheme = useCallback(
    async (themeId: string) => {
      const token = await getToken();
      if (!token) return;
      try {
        await fetch('/api/admin/gamma-reports/themes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_default', themeId }),
        });
        setThemeAssets((prev) =>
          prev.map((t) => ({ ...t, is_default: t.asset_id === themeId }))
        );
        setDefaultThemeId(themeId);
      } catch {
        /* non-critical */
      }
    },
    [getToken]
  );

  const addManualGammaTheme = useCallback(
    async (themeId: string, themeName: string) => {
      const token = await getToken();
      if (!token) return;
      try {
        await fetch('/api/admin/gamma-reports/themes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_manual', themeId, themeName }),
        });
        await loadThemes();
      } catch {
        /* non-critical */
      }
    },
    [getToken, loadThemes]
  );

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

  // Fetch bundles when offer_presentation is selected
  useEffect(() => {
    if (reportType !== 'offer_presentation' || !session) return;
    if (bundles.length > 0) return;
    let cancelled = false;
    async function loadBundles() {
      setLoadingBundles(true);
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await fetch('/api/admin/sales/bundles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list = Array.isArray(data.bundles) ? data.bundles : Array.isArray(data) ? data : [];
          setBundles(list.map((b: Record<string, unknown>) => ({
            id: String(b.id),
            name: String(b.name ?? 'Untitled'),
            pricing_tier_slug: b.pricing_tier_slug ? String(b.pricing_tier_slug) : null,
          })));
        }
      } catch { /* non-critical */ }
      if (!cancelled) setLoadingBundles(false);
    }
    loadBundles();
    return () => { cancelled = true; };
  }, [reportType, session, getToken, bundles.length]);

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

  const loadValueReports = useCallback(
    async (cid: string, options?: { selectId?: string }) => {
      if (!cid) {
        setValueReports([]);
        setValueReportId('');
        return;
      }
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `/api/admin/value-evidence/reports?contact_id=${encodeURIComponent(cid)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const reportList = Array.isArray(data) ? data : data.reports || [];
        setValueReports(reportList);
        if (options?.selectId) {
          setValueReportId(options.selectId);
        } else if (reportList.length === 1) {
          setValueReportId(reportList[0].id);
        } else {
          setValueReportId('');
        }
      }
    },
    [getToken]
  );

  // Fetch value reports when contact changes
  useEffect(() => {
    if (!contactId) {
      setValueReports([]);
      setValueReportId('');
      setValueReportGenerateError(null);
      return;
    }
    setValueReportId('');
    setValueReportGenerateError(null);
    void loadValueReports(contactId);
  }, [contactId, loadValueReports]);

  async function handleGenerateValueReport() {
    if (!contactId) return;
    setGeneratingValueReport(true);
    setValueReportGenerateError(null);
    try {
      const token = await getToken();
      if (!token) {
        setValueReportGenerateError('Please sign in again.');
        return;
      }
      const res = await fetch('/api/admin/value-evidence/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contact_submission_id: parseInt(contactId, 10),
          report_type: 'client_facing',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[gamma] value report generate failed', data);
        }
        setValueReportGenerateError('We could not create the value report. Please try again.');
        return;
      }
      const newId = data.report?.id as string | undefined;
      if (newId) {
        await loadValueReports(contactId, { selectId: newId });
      } else {
        await loadValueReports(contactId);
      }
    } catch {
      setValueReportGenerateError('We could not create the value report. Please try again.');
    } finally {
      setGeneratingValueReport(false);
    }
  }

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

  /**
   * Clear any tracked generation when the context (audit/contact) changes so
   * detection below re-runs from scratch against the new target.
   */
  useEffect(() => {
    setTrackedInFlight(null);
  }, [auditId, contactId]);

  /**
   * On mount (with context), detect an already-running Gamma deck for this
   * audit or contact. If found, bind the pill/progress UI to it — same
   * behaviour as if the user had clicked Generate on this page themselves.
   *
   * Runs once per session+context change. Skips silently if nothing in-flight.
   */
  useEffect(() => {
    if (!session) return;
    if (!auditId && !contactId) return;
    let cancelled = false;
    async function detect() {
      const token = await getToken();
      if (!token || cancelled) return;
      const params = new URLSearchParams({ status: 'generating', limit: '20' });
      if (contactId) params.set('contactId', contactId);
      const res = await fetch(`/api/admin/gamma-reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.reports) ? (data.reports as GammaReport[]) : [];
      const match = rows.find((r) => {
        if (auditId && r.diagnostic_audit_id && String(r.diagnostic_audit_id) === String(auditId)) {
          return true;
        }
        if (contactId && r.contact_submission_id != null && String(r.contact_submission_id) === String(contactId)) {
          return true;
        }
        return false;
      });
      if (!match || cancelled) return;
      setTrackedInFlight({
        reportId: match.id,
        reportType: match.report_type,
        startedAt: match.created_at,
      });
      if (!urlTypePinnedRef.current) {
        setReportType(match.report_type);
      }
    }
    void detect();
    return () => { cancelled = true; };
  }, [session, auditId, contactId, getToken]);

  /**
   * Poll the tracked in-flight row until it flips to completed/failed, then
   * hydrate the `result`/`error` state exactly like a local Generate click
   * would. Refreshes history on every poll so the table stays in sync.
   */
  useEffect(() => {
    if (!session || !trackedInFlight) return;
    let cancelled = false;
    const tick = async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const res = await fetch('/api/admin/gamma-reports?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.reports) ? (data.reports as GammaReport[]) : [];
      setReports(rows);
      const row = rows.find((r) => r.id === trackedInFlight.reportId);
      if (!row) return;
      if (row.status === 'completed') {
        setTrackedInFlight(null);
        if (row.gamma_url) {
          setResult({
            gammaUrl: row.gamma_url,
            reportId: row.id,
            title: row.title ?? '',
          });
        }
      } else if (row.status === 'failed') {
        setTrackedInFlight(null);
        setError(row.error_message || 'Generation failed.');
      }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 5000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [session, trackedInFlight, getToken]);

  /**
   * Whether the current template has an in-flight generation we should
   * reflect in the GammaDeckGenerateRow. External (tracked) generations use
   * the row's real `created_at`; local generations fall back to mount time.
   */
  const trackedForCurrentType = trackedInFlight && trackedInFlight.reportType === reportType
    ? trackedInFlight
    : null;
  const isGeneratingUi = generating || Boolean(trackedForCurrentType);

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
          meetingVerbatims: pickedVerbatims.length > 0 ? pickedVerbatims : undefined,
        },
        externalInputSources: {
          thirdPartyFindings: assembledFindings ? 'provided' : 'none',
          competitorPlatform: assembledCompetitor ? 'provided' : 'none',
          siteCrawlData: assembledSiteData ? 'provided' : 'none',
        },
      };

      if (contactId) body.contactSubmissionId = parseInt(contactId, 10);
      if (auditId) body.diagnosticAuditId = auditId;
      if (valueReportId) body.valueReportId = valueReportId;
      if (selectedTheme) body.theme = selectedTheme;
      if (reportType === 'offer_presentation') {
        if (selectedBundleId) body.bundleId = selectedBundleId;
        else if (selectedTierId) body.pricingTierId = selectedTierId;
      }

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

  const contactPickerItems = useMemo<AssetPickerItem[]>(
    () =>
      contacts.map((c) => ({
        asset_id: String(c.id),
        asset_name: `${c.name}${c.company ? ` (${c.company})` : ''} — ${c.email}`,
        is_favorite: false,
        is_default: false,
      })),
    [contacts]
  );

  const templateButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTemplateRadiogroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const currentIndex = REPORT_TYPES.findIndex((t) => t.value === reportType);
      const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const next = (currentIndex + delta + REPORT_TYPES.length) % REPORT_TYPES.length;
      const nextValue = REPORT_TYPES[next].value;
      setReportType(nextValue);
      queueMicrotask(() => templateButtonRefs.current[next]?.focus());
    },
    [reportType]
  );

  const selectedType = REPORT_TYPES.find((t) => t.value === reportType)!;

  const reportsForCurrentTemplate = useMemo(
    () =>
      [...reports]
        .filter((r) => r.report_type === reportType)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [reports, reportType]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Gamma Reports' },
          ]}
        />

        {(auditId || contactId) && (
          <LatestAuditBanner
            mode="admin"
            auditId={auditId || null}
            contactSubmissionId={contactId || null}
          />
        )}

        {returnUrl && (
          <Link href={returnUrl} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mt-2">
            <ArrowLeft size={16} /> Back
          </Link>
        )}

        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Gamma Report Generator
          </h1>
          <p className="text-gray-400 mt-1">
            Generate professional Gamma presentations from audit data, value evidence, and service content.
          </p>
        </div>

        {/* Report Type Selection — same card pattern as Context; list + radiogroup */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-3">
          <h2 id="gamma-report-template-heading" className="text-lg font-semibold text-white">
            Report Template
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="gamma-report-template-heading"
            className="flex flex-col gap-2"
            onKeyDown={handleTemplateRadiogroupKeyDown}
          >
            {REPORT_TYPES.map((type, index) => {
              const selected = reportType === type.value;
              return (
                <button
                  key={type.value}
                  ref={(el) => {
                    templateButtonRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setReportType(type.value)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                    selected
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'border-gray-800 bg-gray-800/50 hover:border-gray-700 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{type.label}</span>
                    <span className="shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                      {type.slides} slides
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Context Pickers */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Context</h2>

          {/* Contact / Prospect — same AssetPicker pattern as Theme (dropdown + in-panel search) */}
          <div>
            <AssetPicker
              pickerMode="simple"
              className="max-w-none"
              label="Contact / Prospect"
              items={contactPickerItems}
              selectedId={contactId || null}
              onSelect={(id) => setContactId(id)}
              onToggleFavorite={() => {}}
            />
            {contactId !== '' && (
              <button
                type="button"
                onClick={() => setContactId('')}
                className="mt-1.5 text-[10px] text-gray-500 hover:text-teal-400/90 transition-colors"
              >
                Clear contact selection
              </button>
            )}
          </div>

          {contactId && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-3">
              {reportType === 'value_quantification' && (
                <p className="text-xs text-amber-400/90">
                  Value Quantification works best with a saved value report. Create one here if this contact does not have one yet.
                </p>
              )}
              {valueReportGenerateError && (
                <p className="text-xs text-red-400" role="alert">
                  {valueReportGenerateError}
                </p>
              )}
              <button
                type="button"
                onClick={() => { void handleGenerateValueReport(); }}
                disabled={generatingValueReport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600/20 border border-green-500/50 text-green-300 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingValueReport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating value report…
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    {valueReports.length > 0 ? 'Regenerate value report' : 'Generate value report for this contact'}
                  </>
                )}
              </button>
              {valueReports.length === 0 && !generatingValueReport && (
                <p className="text-xs text-gray-500">
                  No value reports on file for this contact. Generate one to populate the selector below (same as Admin → Value Evidence Pipeline → Reports).
                </p>
              )}
            </div>
          )}

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
              {auditId ? (
                <div className="mt-2">
                  <ViewDiagnosticLink auditId={auditId} returnPath={adminReturnPath} />
                </div>
              ) : null}
            </div>
          )}

          {/* Value Report Picker */}
          {contactId && valueReports.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Value Report</label>
              <select
                value={valueReportId}
                onChange={(e) => setValueReportId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— No value report selected (latest used if omitted) —</option>
                {valueReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title?.trim() ? r.title : 'Value report'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bundle / Tier Picker — for offer_presentation */}
          {reportType === 'offer_presentation' && (
            <div className="space-y-3 pt-2 border-t border-gray-800">
              <label className="block text-sm font-medium text-emerald-300">Offer Source (required)</label>
              <p className="text-xs text-gray-400">
                Select a bundle from your offer catalog or a static pricing tier. The deck will be built from the selected offer&apos;s items, pricing, and guarantees.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Bundle</label>
                {loadingBundles ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading bundles…
                  </div>
                ) : (
                  <select
                    value={selectedBundleId}
                    onChange={(e) => {
                      setSelectedBundleId(e.target.value);
                      if (e.target.value) setSelectedTierId('');
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">— Select a bundle —</option>
                    {bundles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.pricing_tier_slug ? ` (${b.pricing_tier_slug})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="text-xs text-gray-500 text-center">— or —</div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Pricing Tier (static)</label>
                <select
                  value={selectedTierId}
                  onChange={(e) => {
                    setSelectedTierId(e.target.value);
                    if (e.target.value) setSelectedBundleId('');
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">— Select a pricing tier —</option>
                  <optgroup label="Premium Tiers">
                    <option value="quick-win">AI Quick Win ($997)</option>
                    <option value="accelerator">AI Accelerator ($7,497)</option>
                    <option value="growth-engine">Growth Engine ($14,997)</option>
                    <option value="digital-transformation">Digital Transformation ($29,997+)</option>
                  </optgroup>
                  <optgroup label="Community Impact Tiers">
                    <option value="ci-starter">CI Starter (Free)</option>
                    <option value="ci-accelerator">CI Accelerator ($1,997)</option>
                    <option value="ci-growth">CI Growth ($4,997)</option>
                  </optgroup>
                </select>
              </div>
              {!selectedBundleId && !selectedTierId && (
                <p className="text-xs text-amber-400/90">
                  Select a bundle or pricing tier to generate the offer presentation.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Theme — Gamma catalog (sync pulls all pages from Gamma API) */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <Palette className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-300">Theme</span>
            {selectedTheme === '' && defaultThemeId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600">
                using default from settings
              </span>
            )}
            {selectedTheme !== '' && selectedTheme === defaultThemeId && defaultThemeId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-800">
                default
              </span>
            )}
            <button
              type="button"
              onClick={() => void syncThemesFromGamma()}
              disabled={themeSyncing || !hasGammaApiKey}
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-teal-900/40 text-teal-200 border border-teal-700/60 hover:bg-teal-800/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Fetch all themes from Gamma (paginated) and update the catalog"
            >
              {themeSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Sync from Gamma
            </button>
          </div>
          {!hasGammaApiKey && (
            <p className="text-[11px] text-amber-400/90">
              Set <code className="text-amber-200/90">GAMMA_API_KEY</code> to sync themes. Reports can still use{' '}
              <code className="text-amber-200/90">GAMMA_DEFAULT_THEME_ID</code> when set.
            </p>
          )}
          {themesLastSync?.syncedAt && (
            <p className="text-[10px] text-gray-500">
              Last Gamma sync: {new Date(themesLastSync.syncedAt).toLocaleString()}
              {themesLastSync.themesSynced > 0 ? ` · ${themesLastSync.themesSynced} themes` : ''}
              {!themesLastSync.success && themesLastSync.error ? ` · ${themesLastSync.error}` : ''}
            </p>
          )}
          {loadingThemes ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading themes…
            </div>
          ) : themeAssets.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                No themes in the catalog yet. Click <strong className="text-gray-400">Sync from Gamma</strong> to import
                your workspace themes (including custom themes past the first API page), or add a theme by ID if it does
                not appear after sync.
              </p>
              <AssetPicker
                label="Theme"
                items={[]}
                selectedId={null}
                onSelect={() => {}}
                onToggleFavorite={() => {
                  /* no rows */
                }}
                onAddManual={async (id, name) => {
                  await addManualGammaTheme(id, name);
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <AssetPicker
                label="Theme"
                items={themeAssets}
                selectedId={selectedTheme === '' ? null : selectedTheme}
                onSelect={(id) => setSelectedTheme(id)}
                onToggleFavorite={(id, fav) => void toggleFavoriteTheme(id, fav)}
                onSetDefault={(id) => void setDefaultGammaTheme(id)}
                onAddManual={async (id, name) => {
                  await addManualGammaTheme(id, name);
                }}
              />
              {selectedTheme !== '' && (
                <button
                  type="button"
                  onClick={() => setSelectedTheme('')}
                  className="text-[10px] text-gray-500 hover:text-teal-400/90 transition-colors"
                >
                  Clear selection — use default from settings (DB or GAMMA_DEFAULT_THEME_ID)
                </button>
              )}
            </div>
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

        {/* Evidence Preview — shows what source citations will back the report */}
        {contactId && (
          <EvidencePreviewCard
            contactId={contactId}
            auditId={auditId || undefined}
            valueReportId={valueReportId || undefined}
            getToken={getToken}
          />
        )}

        {/* Meeting Verbatims — pick discovery quotes to cite verbatim in the deck */}
        {contactId && (
          <MeetingVerbatimPicker
            excerpts={previewData?.meetingExcerpts}
            loading={loadingPreview}
            onChange={setPickedVerbatims}
          />
        )}

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
          hasValueReport={Boolean(valueReportId) || valueReports.length > 0}
          serviceCount={0}
          reportType={reportType}
        />

        {/* Generate — execution row (progress + milestones + history), same pattern as HeyGen config */}
        <GammaDeckGenerateRow
          generating={isGeneratingUi}
          onGenerate={handleGenerate}
          templateLabel={selectedType.label}
          reportsForTemplate={reportsForCurrentTemplate}
          disabled={isGeneratingUi}
          helperTextWhileGenerating={
            trackedForCurrentType
              ? 'Generation was started from another screen — tracking progress here.'
              : 'This may take 30–60 seconds while Gamma creates your presentation.'
          }
          startedAt={trackedForCurrentType?.startedAt}
          fullReportHistoryHref="#gamma-report-history"
        />

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

        {/* Report History — same card + header strip as other admin lists; body scrolls (contacts timeline pattern) */}
        <div
          id="gamma-report-history"
          className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden scroll-mt-24"
        >
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-400 shrink-0" />
              Report History
            </h2>
            <button
              type="button"
              onClick={fetchReports}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {loadingReports ? (
            <div className="text-center py-8 text-gray-500 px-6">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500 px-6">
              No reports generated yet. Create your first one above.
            </div>
          ) : (
            <div className="max-h-[min(50vh,420px)] overflow-y-auto overflow-x-auto overscroll-contain">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 shadow-[0_1px_0_0_rgb(31_41_55)]">
                  <tr className="text-gray-400">
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
                          <Link
                            href={`/admin/contacts/${report.contact_submissions.id}`}
                            className="inline-flex items-center gap-1.5 text-white hover:text-teal-300 transition-colors underline decoration-dotted decoration-teal-400/70 underline-offset-4 hover:decoration-teal-300"
                            title="Open contact record"
                          >
                            <span>{report.contact_submissions.name}</span>
                            <ExternalLink size={13} className="shrink-0 opacity-70 text-teal-400/90" aria-hidden />
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
  offer_presentation: {
    required: [],
    optional: ['Contact', 'Diagnostic Audit', 'Value Report'],
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
