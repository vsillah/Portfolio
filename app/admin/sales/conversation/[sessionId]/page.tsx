'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getBackUrl } from '@/lib/admin-return-context';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  ContentWithRole,
  ContentType,
  FunnelStage,
  SessionOutcome,
  ResponseType,
  ConversationState,
  AIRecommendation,
  OfferStrategy,
  DynamicStep,
  StepType,
  OfferBundleWithStats,
  ResolvedBundleItem,
  OFFER_ROLE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  STRATEGY_TO_STEP_TYPE,
  findObjectionHandlers,
  buildGrandSlamOffer,
  ProductWithRole,
  OfferRole,
  SalesScript,
} from '@/lib/sales-scripts';
import { FunnelStageSelector } from '@/components/admin/sales/FunnelStageSelector';
import { OfferStack, ContentOfferCard } from '@/components/admin/sales/OfferCard';
import { DynamicScriptFlow } from '@/components/admin/sales/DynamicScriptFlow';
import { ValueEvidencePanel } from '@/components/admin/sales/ValueEvidencePanel';
import { ValueEvidenceCallPanel } from '@/components/admin/sales/ValueEvidenceCallPanel';
import { ProposalModal } from '@/components/admin/sales/ProposalModal';
import { ViewDiagnosticLink } from '@/components/admin/ViewDiagnosticLink';
import { useAdminReturnPath } from '@/lib/hooks/useAdminReturnPath';
import { generateProposalEmailDraft, type ProposalEmailDraft } from '@/lib/proposal-email-draft';
import { ConversationTimeline } from '@/components/admin/sales/ConversationTimeline';
import { InPersonDiagnosticPanel } from '@/components/admin/sales/InPersonDiagnosticPanel';
import { CampaignContextPanel } from '@/components/admin/sales/CampaignContextPanel';
import { StreamlinedProductSelection } from '@/components/admin/sales/StreamlinedProductSelection';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  User, Building, Mail, MessageSquare, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, Save, FileText, DollarSign, RefreshCw, ArrowLeft, Send,
  Layers, Package, GitFork, ExternalLink, Copy, XCircle,
  Video, Loader2, Upload, Trash2, Clock, CheckCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone?: string;
  industry?: string | null;
  employee_count?: string | null;
  company_domain?: string | null;
  has_website_tech_stack?: boolean;
}

interface SalesSessionRow {
  id: string;
  diagnostic_audit_id: string | null;
  contact_submission_id: number | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  funnel_stage: FunnelStage;
  current_script_id: string | null;
  current_step_index: number;
  offers_presented: unknown[];
  products_presented: number[];
  internal_notes: string | null;
  outcome: SessionOutcome;
  next_follow_up: string | null;
}

interface ContactMeeting {
  id: string;
  meeting_type: string;
  meeting_date: string;
  duration_minutes: number | null;
  transcript: string | null;
  structured_notes: Record<string, unknown> | null;
  key_decisions: string[] | null;
  action_items: unknown[] | null;
  open_questions: string[] | null;
  recording_url: string | null;
  created_at: string;
}

interface ContactMeetingTask {
  id: string;
  meeting_record_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

const MEETINGS_PER_PAGE = 10;
const TASKS_PER_PAGE = 10;

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session: authSession } = useAuth();
  const sessionId = params.sessionId as string;
  const backUrl = getBackUrl(searchParams, '/admin/sales');
  const adminReturnPath = useAdminReturnPath();

  /* ---- data state ---- */
  const [salesSession, setSalesSession] = useState<SalesSessionRow | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [content, setContent] = useState<ContentWithRole[]>([]);
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [bundles, setBundles] = useState<OfferBundleWithStats[]>([]);

  /* ---- ui state ---- */
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [objectionInput, setObjectionInput] = useState('');
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [showBundleSelector, setShowBundleSelector] = useState(false);
  const [showSaveAsBundle, setShowSaveAsBundle] = useState(false);
  const [showProposalDrawer, setShowProposalDrawer] = useState(false);
  const [valueReportId, setValueReportId] = useState<string | null>(null);
  const [currentProposal, setCurrentProposal] = useState<{
    id: string; status: string; proposalLink: string; accessCode?: string;
  } | null>(null);
  const [proposalEmailDraft, setProposalEmailDraft] = useState<ProposalEmailDraft | null>(null);
  const [proposalDocuments, setProposalDocuments] = useState<Array<{ id: string; document_type: string; title: string; display_order: number; created_at: string }>>([]);
  const [showAttachDocumentModal, setShowAttachDocumentModal] = useState(false);
  const [collapsedContentGroups, setCollapsedContentGroups] = useState<Set<string>>(new Set());
  const hasInitializedCollapsed = useRef(false);

  /* ---- value evidence ---- */
  const [scriptValueEvidence, setScriptValueEvidence] = useState<{
    painPoints: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }[];
    totalAnnualValue: number | null;
  } | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<
    Record<string, { retail_price: number; perceived_value: number }>
  >({});
  const [isApplyingEvidencePricing, setIsApplyingEvidencePricing] = useState(false);

  /* ---- conversation flow ---- */
  const [conversationState, setConversationState] = useState<ConversationState>({
    currentStep: 0,
    responseHistory: [],
    offersPresented: [],
    objectionsRaised: [],
    positiveSignals: 0,
    selectedProducts: [],
    dynamicSteps: [],
    isCallActive: false,
  });
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [accumulatedProducts, setAccumulatedProducts] = useState<Array<{ id: number; name: string; reason: string }>>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingNextStep, setIsLoadingNextStep] = useState(false);

  /* ---- in-person diagnostic ---- */
  const [auditData, setAuditData] = useState<Record<string, unknown> | null>(null);
  const [diagnosticAuditId, setDiagnosticAuditId] = useState<string | null>(null);

  /* ---- previous meetings & tasks ---- */
  const [contactMeetings, setContactMeetings] = useState<ContactMeeting[]>([]);
  const [contactTasks, setContactTasks] = useState<ContactMeetingTask[]>([]);
  const [contactMeetingsLoading, setContactMeetingsLoading] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [meetingsTasksTab, setMeetingsTasksTab] = useState<'meetings' | 'tasks'>('meetings');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [meetingsPage, setMeetingsPage] = useState(1);
  const [tasksPage, setTasksPage] = useState(1);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkDeletingMeetings, setBulkDeletingMeetings] = useState(false);
  const [bulkUpdatingTasks, setBulkUpdatingTasks] = useState(false);
  const [editingContactTask, setEditingContactTask] = useState<ContactMeetingTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<string>('pending');
  const [savingContactTask, setSavingContactTask] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const contextSectionRef = useRef<HTMLDivElement>(null);

  /* ================================================================ */
  /* Data loading                                                      */
  /* ================================================================ */

  const fetchData = useCallback(async () => {
    const session = await getCurrentSession();
    const token = session?.access_token ?? authSession?.access_token;
    if (!token) return;
    setIsLoading(true);
    setError(null);
    let effectiveToken = token;

    const runFetches = (t: string) => {
      const h = { Authorization: `Bearer ${t}` };
      return Promise.all([
        fetch(`/api/admin/sales/sessions?id=${sessionId}`, { headers: h }),
        fetch('/api/admin/sales/products', { headers: h }),
        fetch('/api/admin/sales/scripts', { headers: h }),
        fetch('/api/admin/sales/bundles', { headers: h }),
      ]);
    };

    try {
      let [sessionsRes, productsRes, scriptsRes, bundlesRes] = await runFetches(token);
      if (sessionsRes.status === 401) {
        await supabase.auth.refreshSession();
        const fresh = await getCurrentSession();
        if (fresh?.access_token) {
          [sessionsRes, productsRes, scriptsRes, bundlesRes] = await runFetches(fresh.access_token);
          effectiveToken = fresh.access_token;
        }
      }

      if (!sessionsRes.ok) {
        throw new Error(
          sessionsRes.status === 401
            ? 'Session expired. Please refresh the page or sign in again.'
            : 'Failed to fetch session'
        );
      }

      const headers = { Authorization: `Bearer ${effectiveToken}` };
      const sessionsData = await sessionsRes.json();
      const session: SalesSessionRow | undefined = (sessionsData.sessions || [])[0];
      if (!session) { setError('Session not found'); setIsLoading(false); return; }

      setSalesSession(session);
      setNotes(session.internal_notes || '');
      setSelectedContent((session.products_presented || []).map((id: number) => `product:${id}`));
      if (session.diagnostic_audit_id) setDiagnosticAuditId(session.diagnostic_audit_id);

      // Load contact from lead API or build from session fields
      let contactData: ContactInfo | null = null;
      if (session.contact_submission_id) {
        const leadRes = await fetch(`/api/admin/outreach/leads/${session.contact_submission_id}`, { headers });
        if (leadRes.ok) {
          const lead = await leadRes.json();
          const websiteTech = lead.website_tech_stack;
          contactData = {
            id: String(lead.id),
            name: lead.name ?? '',
            email: lead.email ?? '',
            company: lead.company ?? null,
            phone: lead.phone_number,
            industry: lead.industry ?? null,
            employee_count: lead.employee_count ?? null,
            company_domain: lead.company_domain ?? null,
            has_website_tech_stack: !!(websiteTech && typeof websiteTech === 'object' && websiteTech.domain && Array.isArray(websiteTech.technologies) && websiteTech.technologies.length > 0),
          };
        }
      }
      if (!contactData) {
        contactData = {
          id: '',
          name: session.client_name ?? 'Client',
          email: session.client_email ?? '',
          company: session.client_company ?? null,
        };
      }
      setContact(contactData);

      // If session has no audit linked but contact has a latest audit (e.g. from "Build audit from meetings"), use and link it
      if (!session.diagnostic_audit_id && session.contact_submission_id) {
        const latestRes = await fetch(
          `/api/admin/diagnostic-audits/latest-by-contact?contact_submission_id=${session.contact_submission_id}`,
          { headers }
        );
        if (latestRes.ok) {
          const latestData = await latestRes.json();
          if (latestData.auditId) {
            setDiagnosticAuditId(latestData.auditId);
            setSalesSession((prev) => (prev ? { ...prev, diagnostic_audit_id: latestData.auditId } : prev));
            await fetch('/api/admin/sales/sessions', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ id: sessionId, diagnostic_audit_id: latestData.auditId }),
            });
          }
        }
      }

      const [productsData, scriptsData, bundlesData] = await Promise.all([
        productsRes.json(),
        scriptsRes.ok ? scriptsRes.json() : { scripts: [] },
        bundlesRes.ok ? bundlesRes.json() : { bundles: [] },
      ]);
      setContent(productsData.content || []);
      setScripts(scriptsData.scripts || []);
      setBundles(bundlesData.bundles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, authSession?.access_token]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // Scroll expanded Context & tools section into view when opened
  useEffect(() => {
    if (contextExpanded && contextSectionRef.current) {
      contextSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [contextExpanded]);

  // Default "Select Content for Offer" accordion to collapsed to limit vertical scroll
  useEffect(() => {
    if (hasInitializedCollapsed.current || content.length === 0) return;
    const types = [...new Set(content.map((c) => c.content_type))];
    if (types.length === 0) return;
    hasInitializedCollapsed.current = true;
    setCollapsedContentGroups(new Set(types));
  }, [content]);

  // Load existing audit data for script generation when session has a diagnostic
  useEffect(() => {
    if (!diagnosticAuditId) { setAuditData(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/diagnostic?auditId=${diagnosticAuditId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data.audit) return;
        const a = data.audit;
        setAuditData({
          business_challenges: a.businessChallenges || {},
          tech_stack: a.techStack || {},
          automation_needs: a.automationNeeds || {},
          ai_readiness: a.aiReadiness || {},
          budget_timeline: a.budgetTimeline || {},
          decision_making: a.decisionMaking || {},
          urgency_score: a.urgencyScore,
          opportunity_score: a.opportunityScore,
          key_insights: a.keyInsights || [],
        });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [diagnosticAuditId]);

  // Fetch value evidence when contact is set
  useEffect(() => {
    if (!contact?.id) { setScriptValueEvidence(null); return; }
    let cancelled = false;
    (async () => {
      if (!authSession?.access_token) return;
      const res = await fetch(
        `/api/admin/value-evidence/evidence?contact_id=${encodeURIComponent(contact.id)}`,
        { headers: { Authorization: `Bearer ${authSession.access_token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const painPoints = (data.evidence || [])
        .filter((e: { monetary_indicator?: number }) => e.monetary_indicator != null)
        .map((e: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }) => ({
          display_name: e.display_name ?? null,
          monetary_indicator: Number(e.monetary_indicator),
          monetary_context: e.monetary_context ?? null,
        }))
        .slice(0, 8);
      const report = (data.reports || [])[0];
      setScriptValueEvidence({
        painPoints,
        totalAnnualValue: report?.total_annual_value != null ? Number(report.total_annual_value) : null,
      });
    })();
    return () => { cancelled = true; };
  }, [contact?.id, authSession?.access_token]);

  // Fetch proposal documents when a proposal exists (for Reports & documents section)
  useEffect(() => {
    if (!currentProposal?.id) { setProposalDocuments([]); return; }
    let cancelled = false;
    (async () => {
      if (!authSession?.access_token) return;
      const res = await fetch(`/api/admin/proposals/${currentProposal.id}/documents`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setProposalDocuments(Array.isArray(data.documents) ? data.documents : []);
    })();
    return () => { cancelled = true; };
  }, [currentProposal?.id, authSession?.access_token]);

  // Fetch previous meetings & tasks for this contact (lead/client)
  useEffect(() => {
    const cid = salesSession?.contact_submission_id;
    if (cid == null) {
      setContactMeetings([]);
      setContactTasks([]);
      return;
    }
    let cancelled = false;
    setContactMeetingsLoading(true);
    (async () => {
      if (!authSession?.access_token) return;
      const res = await fetch(
        `/api/admin/sales/contact-meetings?contact_submission_id=${encodeURIComponent(cid)}`,
        { headers: { Authorization: `Bearer ${authSession.access_token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setContactMeetings(data.meetings || []);
      setContactTasks(data.tasks || []);
    })()
      .finally(() => { if (!cancelled) setContactMeetingsLoading(false); });
    return () => { cancelled = true; };
  }, [salesSession?.contact_submission_id, authSession?.access_token]);

  // Filtered and paginated previous meetings & tasks
  const meetingSearchLower = meetingSearch.trim().toLowerCase();
  const taskSearchLower = taskSearch.trim().toLowerCase();
  const filteredContactMeetings = useMemo(() => {
    if (!meetingSearchLower) return contactMeetings;
    return contactMeetings.filter(
      (m) =>
        (m.meeting_type ?? '').toLowerCase().includes(meetingSearchLower) ||
        (m.meeting_date ?? '').toLowerCase().includes(meetingSearchLower)
    );
  }, [contactMeetings, meetingSearchLower]);
  const filteredContactTasks = useMemo(() => {
    if (!taskSearchLower) return contactTasks;
    return contactTasks.filter(
      (t) =>
        (t.title ?? '').toLowerCase().includes(taskSearchLower)
    );
  }, [contactTasks, taskSearchLower]);
  const meetingsTotalPages = Math.max(1, Math.ceil(filteredContactMeetings.length / MEETINGS_PER_PAGE));
  const tasksTotalPages = Math.max(1, Math.ceil(filteredContactTasks.length / TASKS_PER_PAGE));
  const safeMeetingsPage = Math.min(meetingsPage, meetingsTotalPages);
  const safeTasksPage = Math.min(tasksPage, tasksTotalPages);
  const pagedMeetings = useMemo(
    () =>
      filteredContactMeetings.slice(
        (safeMeetingsPage - 1) * MEETINGS_PER_PAGE,
        safeMeetingsPage * MEETINGS_PER_PAGE
      ),
    [filteredContactMeetings, safeMeetingsPage]
  );
  const pagedTasks = useMemo(
    () =>
      filteredContactTasks.slice(
        (safeTasksPage - 1) * TASKS_PER_PAGE,
        safeTasksPage * TASKS_PER_PAGE
      ),
    [filteredContactTasks, safeTasksPage]
  );

  const handleBulkDeleteMeetings = async () => {
    if (selectedMeetingIds.size === 0) return;
    if (!confirm(`Delete ${selectedMeetingIds.size} meeting(s)? Associated tasks will be removed.`)) return;
    if (!authSession?.access_token) return;
    const idsToDelete = new Set(selectedMeetingIds);
    setBulkDeletingMeetings(true);
    try {
      const res = await fetch('/api/admin/meetings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ ids: [...idsToDelete] }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to delete meetings');
        return;
      }
      setSelectedMeetingIds(new Set());
      setMeetingsPage(1);
      setTasksPage(1);
      setContactMeetings((prev) => prev.filter((m) => !idsToDelete.has(m.id)));
      setContactTasks((prev) => prev.filter((t) => !idsToDelete.has(t.meeting_record_id)));
    } catch {
      setError('Failed to delete meetings');
    } finally {
      setBulkDeletingMeetings(false);
    }
  };

  const handleBulkCancelTasks = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!authSession?.access_token) return;
    const idsToUpdate = new Set(selectedTaskIds);
    setBulkUpdatingTasks(true);
    try {
      const res = await fetch('/api/meeting-action-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          updates: [...idsToUpdate].map((id) => ({ id, status: 'cancelled' as const })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to update tasks');
        return;
      }
      setSelectedTaskIds(new Set());
      setContactTasks((prev) =>
        prev.map((t) => (idsToUpdate.has(t.id) ? { ...t, status: 'cancelled' } : t))
      );
    } catch {
      setError('Failed to update tasks');
    } finally {
      setBulkUpdatingTasks(false);
    }
  };

  const openEditContactTask = (t: ContactMeetingTask) => {
    setEditingContactTask(t);
    setEditTaskTitle(t.title);
    setEditTaskStatus(t.status);
  };

  const saveContactTaskEdit = async () => {
    if (!editingContactTask || !authSession?.access_token) return;
    setSavingContactTask(true);
    try {
      const res = await fetch('/api/meeting-action-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          updates: [
            {
              id: editingContactTask.id,
              title: editTaskTitle,
              status: editTaskStatus as 'pending' | 'in_progress' | 'complete' | 'cancelled',
            },
          ],
        }),
      });
      if (res.ok) {
        setContactTasks((prev) =>
          prev.map((t) =>
            t.id === editingContactTask.id
              ? { ...t, title: editTaskTitle, status: editTaskStatus }
              : t
          )
        );
        setEditingContactTask(null);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to update task');
      }
    } catch {
      setError('Failed to update task');
    } finally {
      setSavingContactTask(false);
    }
  };

  /* ================================================================ */
  /* Session helpers                                                   */
  /* ================================================================ */

  const updateSession = async (updates: Partial<SalesSessionRow>) => {
    if (!salesSession) return;
    if (!authSession?.access_token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/sales/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ id: salesSession.id, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update session');
      const data = await res.json();
      setSalesSession(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStageChange = (stage: FunnelStage) => updateSession({ funnel_stage: stage });
  const handleOutcomeChange = (outcome: SessionOutcome) => updateSession({ outcome });
  const saveNotes = () => updateSession({ internal_notes: notes });

  /* ================================================================ */
  /* Bundle helpers                                                    */
  /* ================================================================ */

  const applyBundle = async (bundleId: string) => {
    if (!authSession?.access_token) return;
    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundleId}/resolve`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to load bundle');
      const data = await response.json();
      const bundleContentKeys = data.items.map((item: ResolvedBundleItem) => `${item.content_type}:${item.content_id}`);
      // Only select items that are in the current catalog (active content); filter out inactive.
      const inCatalog = bundleContentKeys.filter((k: string) => content.some((c) => `${c.content_type}:${c.content_id}` === k));
      setSelectedContent(inCatalog);
      setSelectedBundleId(bundleId);
      setShowBundleSelector(false);
    } catch { setError('Failed to load bundle'); }
  };

  const saveAsBundle = async (name: string, description?: string) => {
    if (!authSession?.access_token) return;
    try {
      const items = content
        .filter(c => selectedContent.includes(`${c.content_type}:${c.content_id}`))
        .map((c, i) => ({
          content_type: c.content_type, content_id: c.content_id, display_order: i,
          title: c.title, offer_role: c.offer_role, role_retail_price: c.role_retail_price,
          perceived_value: c.perceived_value, has_overrides: false, is_optional: false,
        }));
      const response = await fetch('/api/admin/sales/bundles/save-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ name, description, items, parent_bundle_id: selectedBundleId }),
      });
      if (!response.ok) throw new Error('Failed to save bundle');
      setShowSaveAsBundle(false);
      const bundlesRes = await fetch('/api/admin/sales/bundles', { headers: { Authorization: `Bearer ${authSession.access_token}` } });
      if (bundlesRes.ok) { const bd = await bundlesRes.json(); setBundles(bd.bundles || []); }
    } catch { setError('Failed to save bundle'); }
  };

  const toggleContent = (contentType: ContentType, contentId: string) => {
    const key = `${contentType}:${contentId}`;
    const next = selectedContent.includes(key) ? selectedContent.filter(k => k !== key) : [...selectedContent, key];
    setSelectedContent(next);
    updateSession({ products_presented: next.filter(k => k.startsWith('product:')).map(k => parseInt(k.split(':')[1], 10)) });
  };

  /* ================================================================ */
  /* Dynamic script / AI                                               */
  /* ================================================================ */

  const generateStep = async (
    stepType: StepType, previousSteps: DynamicStep[],
    lastResponse?: ResponseType, chosenStrategy?: OfferStrategy,
  ): Promise<DynamicStep | null> => {
    if (!authSession?.access_token) return null;
    try {
      const res = await fetch('/api/admin/sales/generate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          stepType, audit: auditData || null,
          clientName: contact?.name, clientCompany: contact?.company,
          previousSteps, lastResponse, chosenStrategy,
          availableContent: content.filter(c => c.is_active),
          conversationHistory: conversationState.responseHistory,
          contactSubmissionId: contact?.id ? parseInt(contact.id, 10) : null,
        }),
      });
      if (res.ok) { const d = await res.json(); return d.step; }
    } catch (err) { console.error('Failed to generate step:', err); }
    return null;
  };

  const startCall = async () => {
    setIsLoadingNextStep(true);
    setConversationState(prev => ({ ...prev, isCallActive: true }));
    const openingStep = await generateStep('opening', []);
    if (openingStep) {
      openingStep.status = 'active';
      setConversationState(prev => ({ ...prev, dynamicSteps: [openingStep], currentStep: 0 }));
    }
    setIsLoadingNextStep(false);
  };

  const handleClientResponse = async (responseType: ResponseType, responseNotes?: string) => {
    if (!authSession?.access_token) return;
    const newResponse = { id: `resp-${Date.now()}`, stepId: 'no-script', responseType, notes: responseNotes, timestamp: new Date().toISOString() };
    const updatedState: ConversationState = {
      ...conversationState,
      responseHistory: [...conversationState.responseHistory, newResponse],
      objectionsRaised: responseType.includes('objection') ? [...conversationState.objectionsRaised, responseType] : conversationState.objectionsRaised,
      positiveSignals: responseType === 'positive' ? conversationState.positiveSignals + 1 : conversationState.positiveSignals,
    };
    setConversationState(updatedState);
    setIsLoadingRecommendations(true);
    try {
      const res = await fetch('/api/admin/sales/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          audit: auditData || null, currentObjection: responseType,
          conversationHistory: updatedState.responseHistory,
          contentPresented: selectedContent,
          availableContent: content.filter(c => c.is_active),
          clientName: contact?.name, clientCompany: contact?.company,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const recs: AIRecommendation[] = d.recommendations || [];
        setAiRecommendations(recs);
        const newProducts = recs.flatMap(r => r.products);
        if (newProducts.length > 0) {
          setAccumulatedProducts(prev => {
            const seen = new Set(prev.map(p => p.name));
            const additions = newProducts.filter(p => !seen.has(p.name));
            return [...prev, ...additions];
          });
        }
      }
    } catch { /* ignore */ } finally { setIsLoadingRecommendations(false); }
  };

  const handleSelectStrategy = async (recommendation: AIRecommendation) => {
    if (recommendation.products.length > 0) {
      const keys = recommendation.products.map(p => `product:${p.id}`);
      const merged = [...new Set([...selectedContent, ...keys])];
      setSelectedContent(merged);
      updateSession({ products_presented: merged.filter(k => k.startsWith('product:')).map(k => parseInt(k.split(':')[1], 10)) });
    }
    const lastResp = conversationState.responseHistory[conversationState.responseHistory.length - 1];
    const updatedSteps = conversationState.dynamicSteps.map((s, i) =>
      i === conversationState.currentStep ? { ...s, status: 'completed' as const, completedAt: new Date().toISOString(), response: lastResp?.responseType } : s,
    );
    const newOffers = [...conversationState.offersPresented, recommendation.strategy];
    setAiRecommendations([]);
    setIsLoadingNextStep(true);
    let nextType = STRATEGY_TO_STEP_TYPE[recommendation.strategy];
    if (recommendation.strategy === 'continue_script') {
      const completedTypes = new Set(updatedSteps.map(s => s.type));
      const SALES_FLOW: StepType[] = ['opening', 'discovery', 'presentation', 'value_stack', 'pricing', 'close', 'followup'];
      const next = SALES_FLOW.find(t => !completedTypes.has(t));
      nextType = next || 'close';
    }
    const newStep = await generateStep(nextType, updatedSteps, lastResp?.responseType, recommendation.strategy);
    if (newStep) {
      newStep.status = 'active';
      setConversationState(prev => ({ ...prev, dynamicSteps: [...updatedSteps, newStep], currentStep: updatedSteps.length, offersPresented: newOffers }));
    }
    setIsLoadingNextStep(false);
  };

  const handleCompleteStep = (stepId: string) => {
    setConversationState(prev => ({
      ...prev,
      dynamicSteps: prev.dynamicSteps.map(s => s.id === stepId ? { ...s, status: 'completed' as const, completedAt: new Date().toISOString() } : s),
    }));
  };

  const refreshRecommendations = () => {
    const last = conversationState.responseHistory[conversationState.responseHistory.length - 1];
    if (last) handleClientResponse(last.responseType, last.notes);
  };

  /* ================================================================ */
  /* Derived data                                                      */
  /* ================================================================ */

  const selectedContentDetails = content.filter(c => selectedContent.includes(`${c.content_type}:${c.content_id}`));
  const selectedAsProducts: ProductWithRole[] = selectedContentDetails.map(c => {
    const key = `${c.content_type}:${c.content_id}`;
    const ov = priceOverrides[key];
    return {
      id: parseInt(c.content_id, 10) || 0, title: c.title, description: c.description,
      type: c.content_type, price: c.price, file_path: null, image_url: c.image_url,
      is_active: c.is_active, is_featured: false, display_order: c.display_order,
      role_id: c.role_id, offer_role: c.offer_role,
      dream_outcome_description: c.dream_outcome_description,
      likelihood_multiplier: c.likelihood_multiplier, time_reduction: c.time_reduction,
      effort_reduction: c.effort_reduction,
      role_retail_price: ov?.retail_price ?? c.role_retail_price,
      offer_price: c.offer_price,
      perceived_value: ov?.perceived_value ?? c.perceived_value,
      bonus_name: c.bonus_name, bonus_description: c.bonus_description,
      qualifying_actions: c.qualifying_actions, payout_type: c.payout_type,
    };
  });
  const grandSlamOffer = buildGrandSlamOffer(selectedAsProducts);
  const { blendedMarginPercent, blendedMarginDollar } = (() => {
    let revenue = 0;
    let cost = 0;
    for (const c of selectedContentDetails) {
      const key = `${c.content_type}:${c.content_id}`;
      const ov = priceOverrides[key];
      revenue += ov?.retail_price ?? c.role_retail_price ?? c.price ?? 0;
      cost += c.unit_cost ?? 0;
    }
    const profit = revenue - cost;
    return {
      blendedMarginPercent: revenue > 0 ? (profit / revenue) * 100 : null,
      blendedMarginDollar: revenue > 0 ? profit : null,
    };
  })();
  const objectionHandlers = objectionInput ? findObjectionHandlers(objectionInput) : [];
  const contentByTypeAndRole = content.reduce((acc, item) => {
    const t = item.content_type;
    const r = item.offer_role || 'unclassified';
    if (!acc[t]) acc[t] = {};
    if (!acc[t][r]) acc[t][r] = [];
    acc[t][r].push(item);
    return acc;
  }, {} as Record<ContentType, Record<string, ContentWithRole[]>>);

  const suggestedProducts = useMemo(() => {
    const seen = new Set<string>();
    const items = accumulatedProducts.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
    return items
      .map((p) => {
        const contentItem = content.find(
          (c) => {
            if (c.content_id === String(p.id)) return true;
            if (p.id === 0 && c.title === p.name) return true;
            return false;
          }
        );
        return {
          id: p.id,
          name: p.name,
          reason: p.reason,
          content: contentItem,
        };
      })
      .filter((item) => item.content != null);
  }, [accumulatedProducts, content]);

  /* ================================================================ */
  /* Loading / error states                                            */
  /* ================================================================ */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !salesSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error || 'Session not found'}</p>
          <div className="flex flex-wrap gap-3">
            {error?.includes('Session expired') && (
              <button onClick={() => { setError(null); fetchData(); }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                Retry
              </button>
            )}
            <button onClick={() => router.push(backUrl)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Sales', href: '/admin/sales' }, { label: contact?.name || 'Conversation' }]} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(backUrl)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Conversation: {contact?.name}</h1>
              <p className="text-gray-400">{contact?.company || contact?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && <span className="text-sm text-gray-400 flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</span>}
            <select value={salesSession.outcome || 'in_progress'} onChange={e => handleOutcomeChange(e.target.value as SessionOutcome)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="in_progress">In Progress</option>
              <option value="converted">Converted</option>
              <option value="downsold">Downsold</option>
              <option value="deferred">Needs Follow-up</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>

        {/* Funnel Stage */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Client Stage</h3>
          <FunnelStageSelector currentStage={salesSession.funnel_stage || 'prospect'} onChange={handleStageChange} />
        </div>

        {/* Context strip: compact contact + expand toggle */}
        <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-gray-900 rounded-lg border border-gray-800 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <User className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-sm font-medium text-white truncate">{contact?.name || 'Client'}</span>
            <span className="text-sm text-gray-400 truncate hidden sm:inline">{contact?.email}</span>
            {contact?.company && <span className="text-xs text-gray-500 truncate hidden md:inline">· {contact.company}</span>}
          </div>
          <button
            type="button"
            onClick={() => setContextExpanded((e) => !e)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700"
          >
            {contextExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Context &amp; tools
          </button>
        </div>

        {/* Main row: Timeline | Script + objections | Unified offer panel */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(320px,480px)] gap-4 mb-6">
          {/* ---- Col 1: Conversation Timeline ---- */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col h-[678px] min-h-[320px] overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {conversationState.responseHistory.length > 0 ? (
                <ConversationTimeline responses={conversationState.responseHistory} currentStep={0} compact={false} />
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversation history yet</p>
                  <p className="text-xs mt-1">Record responses in the Script Guide to build the timeline</p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Col 2: Script Guide + objection help ---- */}
          <div className="flex flex-col min-h-[320px] max-h-[min(75vh,720px)] xl:max-h-[calc(100vh-10rem)] overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                  <h2 className="text-sm font-semibold text-white truncate">Script Guide</h2>
                </div>
                {diagnosticAuditId ? (
                  <ViewDiagnosticLink auditId={diagnosticAuditId} returnPath={adminReturnPath} />
                ) : null}
              </div>
              <DynamicScriptFlow
                steps={conversationState.dynamicSteps}
                currentStepIndex={conversationState.currentStep}
                onRecordResponse={handleClientResponse}
                onSelectStrategy={handleSelectStrategy}
                onCompleteStep={handleCompleteStep}
                aiRecommendations={aiRecommendations}
                isLoadingRecommendations={isLoadingRecommendations}
                isLoadingNextStep={isLoadingNextStep}
                isCallActive={conversationState.isCallActive}
                onStartCall={startCall}
                onRefreshRecommendations={refreshRecommendations}
              />
              <details className="mt-6 border border-gray-700 rounded-lg bg-gray-800/30 group">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-200 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  Objection help
                  <ChevronDown className="w-4 h-4 text-gray-500 ml-auto group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-4 pt-0 border-t border-gray-700/80">
                  <input type="text" value={objectionInput} onChange={e => setObjectionInput(e.target.value)} placeholder="e.g., too expensive, need to think about it..." className="w-full px-3 py-2 mt-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm" />
                  {objectionHandlers.length > 0 ? (
                    <div className="space-y-3 mt-4">
                      {objectionHandlers.map((h, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                          <div className="text-xs font-medium text-gray-400 mb-1 capitalize">{h.category} objection</div>
                          <p className="text-sm text-gray-200">{h.response}</p>
                        </div>
                      ))}
                    </div>
                  ) : objectionInput ? (
                    <p className="text-gray-400 text-center py-6 text-sm">No specific handler found.</p>
                  ) : (
                    <div className="text-gray-500 text-center py-6 text-sm">
                      <p>Type an objection above for suggested responses.</p>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <h4 className="text-xs font-medium text-gray-400 mb-2">Quick phrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {['too expensive', 'need to think', 'talk to spouse', 'not the right time', 'tried before'].map(o => (
                        <button key={o} type="button" onClick={() => setObjectionInput(o)} className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded-full text-xs hover:bg-gray-700">{o}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* ---- Col 3: Offer panel (Suggested/All + bundles, catalog, stack) ---- */}
          <div className="min-h-[280px] flex flex-col xl:min-h-0">
            <StreamlinedProductSelection
              products={selectedAsProducts}
              totalPrice={grandSlamOffer.offerPrice}
              totalValue={grandSlamOffer.totalPerceivedValue}
              suggestedProducts={suggestedProducts}
              allContent={content.filter((c) => c.is_active !== false)}
              selectedContent={selectedContent}
              onRemove={(contentType, contentId) => toggleContent(contentType as ContentType, contentId)}
              onToggleContent={(contentType, contentId) => toggleContent(contentType as ContentType, contentId)}
              onConvertToProposal={() => setShowProposalDrawer(true)}
              currentProposal={currentProposal ? { status: currentProposal.status, proposalLink: currentProposal.proposalLink } : null}
              allCatalogContent={({ searchLower: catalogSearch }) => {
                const q = catalogSearch.trim();
                const filterItems = (items: ContentWithRole[]) =>
                  !q
                    ? items
                    : items.filter(
                        (c) =>
                          (c.title ?? '').toLowerCase().includes(q) ||
                          (c.description ?? '').toLowerCase().includes(q)
                      );
                const filteredByTypeAndRole = Object.fromEntries(
                  Object.entries(contentByTypeAndRole)
                    .map(([ct, roleGroups]) => {
                      const next: Record<string, ContentWithRole[]> = {};
                      for (const [role, items] of Object.entries(roleGroups)) {
                        const f = filterItems(items);
                        if (f.length) next[role] = f;
                      }
                      return [ct, next] as const;
                    })
                    .filter(([, rg]) => Object.keys(rg).length > 0)
                ) as Record<ContentType, Record<string, ContentWithRole[]>>;
                const hasCatalog = Object.keys(filteredByTypeAndRole).length > 0;
                return (
                  <>
                    {bundles.length > 0 && (
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <span className="text-xs font-medium text-white flex items-center gap-2 mb-2"><Layers className="w-3.5 h-3.5 text-purple-400" /> Quick start — bundle</span>
                        <div className="flex flex-wrap gap-1.5">
                          {bundles.slice(0, 5).map(b => (
                            <button key={b.id} type="button" onClick={() => applyBundle(b.id)} className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${selectedBundleId === b.id ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'}`}>
                              {b.name}<span className="ml-1 text-gray-400">({b.item_count})</span>
                            </button>
                          ))}
                          {bundles.length > 5 && <button type="button" onClick={() => setShowBundleSelector(true)} className="px-2.5 py-1 text-xs text-gray-400 hover:text-white">+{bundles.length - 5} more</button>}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Catalog by role</h3>
                      <span className="text-xs text-gray-500">{selectedContent.length} selected</span>
                    </div>
                    {!hasCatalog && q ? (
                      <p className="text-sm text-gray-500 py-2">No catalog items match your search.</p>
                    ) : null}
                    {Object.entries(filteredByTypeAndRole).map(([ct, roleGroups]) => {
                      const collapsed = collapsedContentGroups.has(ct);
                      const count = Object.values(roleGroups).flat().length;
                      const selCount = Object.values(roleGroups).flat().filter(i => selectedContent.includes(`${i.content_type}:${i.content_id}`)).length;
                      return (
                        <div key={ct} className="border border-gray-700/80 rounded-lg overflow-hidden">
                          <button type="button" onClick={() => setCollapsedContentGroups(prev => { const n = new Set(prev); if (n.has(ct)) n.delete(ct); else n.add(ct); return n; })} className="w-full flex items-center gap-2 p-2.5 bg-gray-800/40 hover:bg-gray-800/70 transition-colors text-left">
                            {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                            <span className="text-lg leading-none">{CONTENT_TYPE_ICONS[ct as ContentType]}</span>
                            <span className="text-sm font-medium text-white">{CONTENT_TYPE_LABELS[ct as ContentType]}</span>
                            <span className="text-gray-500 text-xs">({count})</span>
                            {selCount > 0 && <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-blue-900/50 text-blue-300 rounded">{selCount}</span>}
                          </button>
                          {!collapsed && (
                            <div className="px-2 pb-2 pt-0 border-t border-gray-700/60 max-h-[min(50vh,320px)] overflow-y-auto">
                              {Object.entries(roleGroups).map(([role, items]) => (
                                <div key={`${ct}-${role}`} className="mt-2 mb-3 last:mb-0">
                                  <h4 className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase">{OFFER_ROLE_LABELS[role as OfferRole] || 'Unclassified'} ({items.length})</h4>
                                  <div className="space-y-2">
                                    {items.map(item => {
                                      const k = `${item.content_type}:${item.content_id}`;
                                      return <ContentOfferCard key={k} content={item} compact showAddButton isSelected={selectedContent.includes(k)} onAdd={() => toggleContent(item.content_type, item.content_id)} />;
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              }}
              offerFooterDetails={
                selectedContent.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-sm font-medium text-white">Offer stack</h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {contact?.id && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!authSession?.access_token || !selectedContentDetails.length) return;
                              setIsApplyingEvidencePricing(true);
                              try {
                                const next: Record<string, { retail_price: number; perceived_value: number }> = {};
                                for (const c of selectedContentDetails) {
                                  const r = await fetch('/api/admin/value-evidence/suggest-pricing', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
                                    body: JSON.stringify({ content_type: c.content_type, content_id: c.content_id, contact_submission_id: parseInt(contact!.id, 10), industry: contact!.industry || undefined, company_size: contact!.employee_count || undefined }),
                                  });
                                  if (r.ok) { const d = await r.json(); const p = d.pricing; if (p?.suggestedRetailPrice != null && p?.suggestedPerceivedValue != null) next[`${c.content_type}:${c.content_id}`] = { retail_price: Number(p.suggestedRetailPrice), perceived_value: Number(p.suggestedPerceivedValue) }; }
                                }
                                setPriceOverrides(prev => ({ ...prev, ...next }));
                              } finally { setIsApplyingEvidencePricing(false); }
                            }}
                            disabled={isApplyingEvidencePricing}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-900/50 border border-green-700/50 text-green-300 hover:bg-green-900/70 rounded-lg disabled:opacity-50"
                          >
                            {isApplyingEvidencePricing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} Evidence pricing
                          </button>
                        )}
                        <button type="button" onClick={() => setShowSaveAsBundle(true)} className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg"><Save className="w-3 h-3" /> Save bundle</button>
                      </div>
                    </div>
                    <OfferStack products={selectedAsProducts} totalPrice={grandSlamOffer.offerPrice} totalValue={grandSlamOffer.totalPerceivedValue} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Select items from Suggested or All to build your offer stack.</p>
                )
              }
            />
          </div>
        </div>

        {/* Expandable Context & tools (contact, notes, meetings, diagnostic, value evidence, campaign) */}
        {contextExpanded && (
          <div ref={contextSectionRef} className="space-y-6 pt-4 border-t border-gray-800">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ChevronUp className="w-4 h-4 text-gray-400" />
              Context &amp; tools
            </h2>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-blue-500" /> Client Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-300"><Mail className="w-4 h-4 text-gray-500" /><span>{contact?.email}</span></div>
                {contact?.company && <div className="flex items-center gap-2 text-sm text-gray-300"><Building className="w-4 h-4 text-gray-500" /><span>{contact.company}</span></div>}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="font-medium text-white mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-yellow-500" /> Call Notes</h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes from the call..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500" rows={4} />
              <button onClick={saveNotes} className="mt-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1"><Save className="w-4 h-4" /> Save Notes</button>
            </div>
            {salesSession?.contact_submission_id != null && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2"><Video className="w-5 h-5 text-purple-500" /> Previous meetings &amp; tasks</h3>
                {contactMeetingsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {filteredContactMeetings.length} meeting(s), {filteredContactTasks.length} task(s). <Link href="/admin/meeting-tasks" className="text-purple-400 hover:text-purple-300">View in Meeting Tasks</Link>
                  </p>
                )}
              </div>
            )}
            <InPersonDiagnosticPanel
              sessionId={sessionId}
              diagnosticAuditId={diagnosticAuditId}
              contactSubmissionId={contact?.id ? parseInt(contact.id, 10) : null}
              clientName={contact?.name || null}
              clientCompany={contact?.company || null}
              companyDomain={contact?.company_domain ?? null}
              hasWebsiteTechStack={contact?.has_website_tech_stack ?? false}
              onAuditCreated={(id) => {
                setDiagnosticAuditId(id);
                setSalesSession(prev => prev ? { ...prev, diagnostic_audit_id: id } : prev);
              }}
              onAuditUpdated={(data) => setAuditData(data as unknown as Record<string, unknown>)}
            />
            <ValueEvidencePanel
              contactId={contact?.id ? parseInt(contact.id, 10) : null}
              industry={contact?.industry || null}
              companySize={contact?.employee_count || null}
              companyName={contact?.company || null}
              onReportGenerated={id => setValueReportId(id)}
            />
            <ValueEvidenceCallPanel
              painPoints={scriptValueEvidence?.painPoints ?? []}
              totalAnnualValue={scriptValueEvidence?.totalAnnualValue ?? null}
            />
            <CampaignContextPanel contactEmail={contact?.email || null} />
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      {showBundleSelector && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Select Bundle</h3>
              <button onClick={() => setShowBundleSelector(false)} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {bundles.map(b => (
                <button key={b.id} onClick={() => applyBundle(b.id)} className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between"><span className="font-medium text-white">{b.name}</span><span className="text-sm text-gray-400">{b.item_count} items</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSaveAsBundle && <SaveAsBundleModal onClose={() => setShowSaveAsBundle(false)} onSave={saveAsBundle} itemCount={selectedContent.length} parentBundleName={bundles.find(b => b.id === selectedBundleId)?.name} />}

      {showProposalDrawer && (
        <ProposalModal
          presentation="drawer"
          heading="Proposal & documents"
          reviewSection={
            currentProposal ? (
              <ConversationProposalReviewSection
                currentProposal={currentProposal}
                proposalDocuments={proposalDocuments}
                setProposalDocuments={setProposalDocuments}
                proposalEmailDraft={proposalEmailDraft}
                accessToken={authSession?.access_token ?? null}
                onOpenAttachModal={() => setShowAttachDocumentModal(true)}
                contactSubmissionId={salesSession?.contact_submission_id ?? null}
              />
            ) : undefined
          }
          onClose={() => setShowProposalDrawer(false)}
          contactId={contact?.id ? parseInt(contact.id, 10) : null}
          defaultValueReportId={valueReportId}
          defaultClientName={contact?.name || ''}
          defaultClientEmail={contact?.email || ''}
          defaultClientCompany={contact?.company || ''}
          totalAmount={grandSlamOffer.offerPrice}
          blendedMarginPercent={blendedMarginPercent}
          blendedMarginDollar={blendedMarginDollar}
          contactSubmissionId={salesSession?.contact_submission_id ?? null}
          diagnosticAuditId={diagnosticAuditId}
          diagnosticReturnPath={adminReturnPath}
          bundleName={bundles.find(b => b.id === selectedBundleId)?.name || 'Custom Offer'}
          defaultServiceTermMonths={(bundles.find(b => b.id === selectedBundleId) as { default_service_term_months?: number | null } | undefined)?.default_service_term_months ?? null}
          lineItems={selectedContentDetails.map(c => {
            const k = `${c.content_type}:${c.content_id}`;
            const ov = priceOverrides[k];
            return { title: c.title, description: c.description || undefined, content_type: c.content_type, offer_role: c.offer_role || undefined, price: ov?.retail_price ?? c.role_retail_price ?? c.price ?? 0 };
          })}
          onGenerate={async data => {
            if (!authSession?.access_token) return;
            const lineItems = selectedContentDetails.map(c => {
              const k = `${c.content_type}:${c.content_id}`;
              const ov = priceOverrides[k];
              return { content_type: c.content_type, content_id: c.content_id, title: c.title, description: c.description, offer_role: c.offer_role, price: ov?.retail_price ?? c.role_retail_price ?? c.price ?? 0, perceived_value: ov?.perceived_value ?? c.perceived_value ?? c.role_retail_price ?? c.price ?? 0 };
            });
            const response = await fetch('/api/proposals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
              body: JSON.stringify({
                sales_session_id: salesSession?.id,
                client_name: data.clientName,
                client_email: data.clientEmail,
                client_company: data.clientCompany,
                bundle_id: selectedBundleId,
                bundle_name: bundles.find(b => b.id === selectedBundleId)?.name || 'Custom Offer',
                line_items: lineItems,
                subtotal: grandSlamOffer.offerPrice,
                discount_amount: data.discountAmount,
                discount_description: data.discountDescription,
                total_amount: grandSlamOffer.offerPrice - (data.discountAmount || 0),
                valid_days: data.validDays,
                value_report_id: data.valueReportId || undefined,
                include_contract: data.includeContract,
                include_onboarding_preview: data.includeOnboardingPreview,
                onboarding_overrides: data.onboardingContent || undefined,
                attached_report_ids: data.attachedReportIds,
                service_term_months: data.serviceTermMonths || undefined,
              }),
            });
            if (response.ok) {
              const result = await response.json();
              setCurrentProposal({ id: result.proposal.id, status: result.proposal.status, proposalLink: result.proposalLink, accessCode: result.accessCode });
              setProposalEmailDraft(generateProposalEmailDraft({
                clientName: data.clientName,
                clientEmail: data.clientEmail,
                clientCompany: data.clientCompany,
                bundleName: bundles.find(b => b.id === selectedBundleId)?.name || 'Custom Offer',
                totalAmount: grandSlamOffer.offerPrice - (data.discountAmount || 0),
                proposalLink: result.proposalLink,
                accessCode: result.accessCode,
              }));
              if (result.proposal.id) {
                const docsRes = await fetch(`/api/admin/proposals/${result.proposal.id}/documents`, { headers: { Authorization: `Bearer ${authSession.access_token}` } });
                if (docsRes.ok) {
                  const docsData = await docsRes.json();
                  setProposalDocuments(Array.isArray(docsData.documents) ? docsData.documents : []);
                }
              }
            } else { throw new Error('Failed to create proposal'); }
          }}
        />
      )}

      {showAttachDocumentModal && currentProposal && (
        <AttachProposalDocumentModal
          proposalId={currentProposal.id}
          accessToken={authSession?.access_token ?? null}
          onClose={() => setShowAttachDocumentModal(false)}
          onSuccess={async () => {
            if (!authSession?.access_token) return;
            const res = await fetch(`/api/admin/proposals/${currentProposal.id}/documents`, { headers: { Authorization: `Bearer ${authSession.access_token}` } });
            if (res.ok) {
              const data = await res.json();
              setProposalDocuments(Array.isArray(data.documents) ? data.documents : []);
            }
            setShowAttachDocumentModal(false);
          }}
        />
      )}
    </div>
  );
}

type ProposalDocRow = { id: string; document_type: string; title: string; display_order: number; created_at: string };

function ConversationProposalReviewSection({
  currentProposal,
  proposalDocuments,
  setProposalDocuments,
  proposalEmailDraft,
  accessToken,
  onOpenAttachModal,
  contactSubmissionId,
}: {
  currentProposal: { id: string; status: string; proposalLink: string };
  proposalDocuments: ProposalDocRow[];
  setProposalDocuments: Dispatch<SetStateAction<ProposalDocRow[]>>;
  proposalEmailDraft: ProposalEmailDraft | null;
  accessToken: string | null;
  onOpenAttachModal: () => void;
  contactSubmissionId: number | null;
}) {
  const [proposalLogged, setProposalLogged] = useState(false)
  const [loggingProposal, setLoggingProposal] = useState(false)

  const logProposalSent = async () => {
    if (!accessToken || !contactSubmissionId || !proposalEmailDraft) return
    setLoggingProposal(true)
    try {
      const res = await fetch('/api/admin/communications/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          contactSubmissionId,
          channel: 'email',
          direction: 'outbound',
          messageType: 'proposal',
          subject: proposalEmailDraft.subject,
          body: proposalEmailDraft.body,
          sourceSystem: 'proposal',
          sourceId: currentProposal.id,
          status: 'sent',
          metadata: { proposal_id: currentProposal.id, proposal_link: currentProposal.proposalLink },
        }),
      })
      if (res.ok) setProposalLogged(true)
    } catch {
      /* fire-and-forget */
    } finally {
      setLoggingProposal(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Adjust line items in the offer column on the left anytime. Scroll down to generate or regenerate a proposal.
      </p>
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <span className={`inline-block px-2 py-0.5 text-xs rounded ${currentProposal.status === 'paid' ? 'bg-green-900/50 text-green-300' : currentProposal.status === 'accepted' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{currentProposal.status}</span>
        <div className="flex items-center gap-2 mt-2">
          <input type="text" value={currentProposal.proposalLink} readOnly className="flex-1 min-w-0 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300" />
          <button type="button" onClick={() => navigator.clipboard.writeText(currentProposal.proposalLink)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg shrink-0" title="Copy"><Copy className="w-4 h-4" /></button>
          <a href={currentProposal.proposalLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0" title="Open client view"><ExternalLink className="w-4 h-4" /></a>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Reports &amp; documents</h5>
          {proposalDocuments.length > 0 ? (
            <ul className="space-y-2 mb-2">
              {proposalDocuments.map((doc, index) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-gray-900/50">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        if (index === 0 || !accessToken) return;
                        const newOrder = [...proposalDocuments];
                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        const res = await fetch(`/api/admin/proposals/${currentProposal.id}/documents`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                          body: JSON.stringify({ documentIds: newOrder.map(d => d.id) }),
                        });
                        if (res.ok) { const data = await res.json(); setProposalDocuments(data.documents ?? newOrder); }
                      }}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (index >= proposalDocuments.length - 1 || !accessToken) return;
                        const newOrder = [...proposalDocuments];
                        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                        const res = await fetch(`/api/admin/proposals/${currentProposal.id}/documents`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                          body: JSON.stringify({ documentIds: newOrder.map(d => d.id) }),
                        });
                        if (res.ok) { const data = await res.json(); setProposalDocuments(data.documents ?? newOrder); }
                      }}
                      disabled={index >= proposalDocuments.length - 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-200 truncate flex-1">{doc.title}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {doc.document_type === 'strategy_report' ? 'Strategy' : doc.document_type === 'opportunity_quantification' ? 'Opportunity' : doc.document_type === 'proposal_package' ? 'Package' : 'Document'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!accessToken) return;
                      const res = await fetch(`/api/admin/proposals/${currentProposal.id}/documents/${doc.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
                      if (res.ok) setProposalDocuments(prev => prev.filter(d => d.id !== doc.id));
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 mb-2">No reports or documents attached yet.</p>
          )}
          <button type="button" onClick={onOpenAttachModal} className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
            <Upload className="w-3.5 h-3.5" /> Attach report or document (PDF)
          </button>
        </div>
        {proposalEmailDraft && (
          <div className="mt-3 border-t border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email draft
              </h5>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const full = `Subject: ${proposalEmailDraft.subject}\n\n${proposalEmailDraft.body}`;
                    navigator.clipboard.writeText(full);
                  }}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1 transition-colors"
                  title="Copy email to clipboard"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
                <a
                  href={`mailto:${encodeURIComponent(proposalEmailDraft.to)}?subject=${encodeURIComponent(proposalEmailDraft.subject)}&body=${encodeURIComponent(proposalEmailDraft.body)}`}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1 transition-colors"
                  title="Open in email client"
                  onClick={logProposalSent}
                >
                  <Send className="w-3 h-3" />
                  Send
                </a>
                {contactSubmissionId && !proposalLogged && (
                  <button
                    type="button"
                    onClick={logProposalSent}
                    disabled={loggingProposal}
                    className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="Log this email as sent in the communication timeline"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {loggingProposal ? 'Logging...' : 'Log sent'}
                  </button>
                )}
                {proposalLogged && (
                  <span className="px-2 py-1 text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Logged
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-1">To: {proposalEmailDraft.to}</div>
            <div className="text-xs text-gray-500 mb-2">Subject: {proposalEmailDraft.subject}</div>
            <pre className="text-xs text-gray-300 bg-gray-900/80 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
              {proposalEmailDraft.body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attach Proposal Document Modal                                      */
/* ------------------------------------------------------------------ */

function AttachProposalDocumentModal({
  proposalId,
  accessToken,
  onClose,
  onSuccess,
}: {
  proposalId: string;
  accessToken: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<string>('strategy_report');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      setError('Please provide a title and select a PDF file.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('File must be a PDF.');
      return;
    }
    if (!accessToken) {
      setError('Not authenticated.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('title', title.trim());
      formData.set('document_type', documentType);
      const res = await fetch(`/api/admin/proposals/${proposalId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed.');
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Attach report or document</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. KMB Implementation Strategy"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="strategy_report">Strategy Report</option>
              <option value="opportunity_quantification">Opportunity Quantification</option>
              <option value="proposal_package">Proposal Package</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">PDF file *</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-200"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={uploading || !title.trim() || !file} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save As Bundle Modal (inline)                                       */
/* ------------------------------------------------------------------ */

function SaveAsBundleModal({ onClose, onSave, itemCount, parentBundleName }: {
  onClose: () => void; onSave: (name: string, desc?: string) => void; itemCount: number; parentBundleName?: string;
}) {
  const [name, setName] = useState(parentBundleName ? `${parentBundleName} - Modified` : '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-purple-400" /> Save as New Bundle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-300 mb-2">Bundle Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Enterprise Premium Pack" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500" /></div>
          <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this bundle..." rows={3} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none" /></div>
          <p className="text-sm text-gray-400">{itemCount} items{parentBundleName && <span className="block mt-1 text-purple-400"><GitFork className="w-3 h-3 inline mr-1" />Forked from &quot;{parentBundleName}&quot;</span>}</p>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={async () => { if (!name.trim()) return; setSaving(true); await onSave(name.trim(), description.trim() || undefined); setSaving(false); }} disabled={!name.trim() || saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Bundle
          </button>
        </div>
      </div>
    </div>
  );
}
