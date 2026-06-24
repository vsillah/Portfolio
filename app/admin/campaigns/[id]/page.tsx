'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Target, Users, Package, CheckCircle2,
  Clock, Loader2, X, ChevronRight, AlertCircle, UserPlus, Calendar,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { getCurrentSession } from '@/lib/auth';
import { getBackUrl, buildLinkWithReturn } from '@/lib/admin-return-context';
import {
  CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS, CRITERIA_TYPE_LABELS,
  TRACKING_SOURCE_LABELS, ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS,
  ENROLLMENT_SOURCE_LABELS, CAMPAIGN_TYPE_LABELS, calculateOverallProgress,
} from '@/lib/campaigns';
import type {
  AttractionCampaign, CampaignCriteriaTemplate, CriteriaType, TrackingSource,
} from '@/lib/campaigns';
import {
  SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS,
  SOCIAL_CONTENT_CALENDAR_TEMPLATES,
  type SocialContentCalendarTemplateKey,
} from '@/lib/social-content-calendar';

type CampaignCalendarItem = {
  id: string;
  title: string;
  channel: 'linkedin' | 'youtube_shorts' | 'instagram_reels' | 'thumbnail';
  campaign_phase: 'tease' | 'teach' | 'proof' | 'offer';
  planned_angle: string | null;
  scheduled_for: string;
  due_status: string;
  authorization_status: string;
  authorization_due_at: string | null;
  agent_work_item_id: string | null;
  social_content_id: string | null;
  metadata?: Record<string, unknown> | null;
};

function calendarAuthorizationTone(status: string) {
  if (status === 'authorized') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100';
  }
  if (status === 'rejected' || status === 'expired') {
    return 'border-red-500/35 bg-red-500/10 text-red-100';
  }
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100';
}

function metadataRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

interface CampaignDetail extends AttractionCampaign {
  campaign_eligible_bundles: Array<{
    id: string;
    bundle_id: string;
    offer_bundles: { id: string; name: string; pricing_tier_slug: string; bundle_price: number } | null;
  }>;
  campaign_criteria_templates: CampaignCriteriaTemplate[];
  social_content_calendar_items?: CampaignCalendarItem[];
  calendar_item_count?: number;
  next_calendar_item?: CampaignCalendarItem | null;
}

interface EnrollmentRow {
  id: string;
  client_email: string;
  client_name: string | null;
  enrollment_source: string;
  status: string;
  enrolled_at: string;
  deadline_at: string;
  purchase_amount: number | null;
  enrollment_criteria: Array<{ id: string; required: boolean }>;
  campaign_progress: Array<{ id: string; status: string }>;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const backUrl = getBackUrl(searchParams, '/admin/campaigns');

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'criteria' | 'bundles' | 'enrollments' | 'content-calendar'>('criteria');
  const [generatingContentPlan, setGeneratingContentPlan] = useState(false);
  const [contentPlanNotice, setContentPlanNotice] = useState('');
  const [contentPlanTemplateKey, setContentPlanTemplateKey] =
    useState<SocialContentCalendarTemplateKey>('whisper_to_shout');
  const [calendarActionItemId, setCalendarActionItemId] = useState<string | null>(null);
  const [rejectingCalendarItemId, setRejectingCalendarItemId] = useState<string | null>(null);
  const [calendarDecisionNotes, setCalendarDecisionNotes] = useState<Record<string, string>>({});

  // Criteria form
  const [showCriteriaForm, setShowCriteriaForm] = useState(false);
  const [criteriaForm, setCriteriaForm] = useState({
    label_template: '', description_template: '', criteria_type: 'action' as CriteriaType,
    tracking_source: 'manual' as TrackingSource, threshold_source: '', threshold_default: '',
    required: true,
  });

  // Bundle form
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [availableBundles, setAvailableBundles] = useState<Array<{ id: string; name: string; pricing_tier_slug: string; bundle_price: number }>>([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');

  // Enroll form
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ client_email: '', client_name: '' });
  const [enrollError, setEnrollError] = useState('');

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const session = await getCurrentSession();
    if (!session?.access_token) throw new Error('Missing admin session');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(path, { ...init, headers });
  }, []);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch campaign:', err);
    }
  }, [authedFetch, campaignId]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}/enrollments`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
    }
  }, [authedFetch, campaignId]);

  const fetchBundles = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/sales/bundles');
      if (res.ok) {
        const data = await res.json();
        setAvailableBundles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    }
  }, [authedFetch]);

  useEffect(() => {
    Promise.all([fetchCampaign(), fetchEnrollments(), fetchBundles()]).finally(() => setLoading(false));
  }, [fetchCampaign, fetchEnrollments, fetchBundles]);

  const handleAddCriterion = async () => {
    if (!criteriaForm.label_template.trim()) return;
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteriaForm),
      });
      if (res.ok) {
        setShowCriteriaForm(false);
        setCriteriaForm({ label_template: '', description_template: '', criteria_type: 'action', tracking_source: 'manual', threshold_source: '', threshold_default: '', required: true });
        fetchCampaign();
      }
    } catch (err) {
      console.error('Failed to add criterion:', err);
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    try {
      await authedFetch(`/api/admin/campaigns/${campaignId}/criteria?criterion_id=${criterionId}`, { method: 'DELETE' });
      fetchCampaign();
    } catch (err) {
      console.error('Failed to delete criterion:', err);
    }
  };

  const handleAddBundle = async () => {
    if (!selectedBundleId) return;
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}/eligible-bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: selectedBundleId }),
      });
      if (res.ok) {
        setShowBundleForm(false);
        setSelectedBundleId('');
        fetchCampaign();
      }
    } catch (err) {
      console.error('Failed to add bundle:', err);
    }
  };

  const handleRemoveBundle = async (bundleId: string) => {
    try {
      await authedFetch(`/api/admin/campaigns/${campaignId}/eligible-bundles?bundle_id=${bundleId}`, { method: 'DELETE' });
      fetchCampaign();
    } catch (err) {
      console.error('Failed to remove bundle:', err);
    }
  };

  const handleEnroll = async () => {
    if (!enrollForm.client_email.trim()) return;
    setEnrollError('');
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollForm),
      });
      if (res.ok) {
        setShowEnrollForm(false);
        setEnrollForm({ client_email: '', client_name: '' });
        fetchEnrollments();
      } else {
        const data = await res.json();
        setEnrollError(data.error || 'Failed to enroll');
      }
    } catch (err) {
      console.error('Failed to enroll:', err);
      setEnrollError('Failed to enroll client');
    }
  };

  const handleGenerateContentPlan = async () => {
    setGeneratingContentPlan(true);
    setContentPlanNotice('');
    try {
      const res = await authedFetch(`/api/admin/campaigns/${campaignId}/content-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: contentPlanTemplateKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const templateLabel = typeof data.template_label === 'string'
          ? data.template_label
          : SOCIAL_CONTENT_CALENDAR_TEMPLATES[contentPlanTemplateKey].label;
        setContentPlanNotice(`${templateLabel}: created ${data.created_count || 0} items; skipped ${data.skipped_existing_count || 0} existing milestones.`);
        await fetchCampaign();
      } else {
        setContentPlanNotice(data.error || 'Failed to generate content plan.');
      }
    } catch (err) {
      console.error('Failed to generate content plan:', err);
      setContentPlanNotice('Failed to generate content plan.');
    } finally {
      setGeneratingContentPlan(false);
    }
  };

  const handleAuthorizeCalendarItem = async (item: CampaignCalendarItem) => {
    setContentPlanNotice('');
    setCalendarActionItemId(item.id);
    try {
      const res = await authedFetch(`/api/admin/social-content/calendar/${item.id}/authorize`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setContentPlanNotice(data.handoff?.social_content_id
          ? 'Draft handoff authorized and Social Content draft created.'
          : 'Draft handoff authorized for channel planning.');
        await fetchCampaign();
      } else {
        setContentPlanNotice(data.error || 'Failed to authorize draft handoff.');
      }
    } catch (err) {
      console.error('Failed to authorize calendar item:', err);
      setContentPlanNotice('Failed to authorize draft handoff.');
    } finally {
      setCalendarActionItemId(null);
    }
  };

  const handleRejectCalendarItem = async (item: CampaignCalendarItem) => {
    const decisionNote = calendarDecisionNotes[item.id]?.trim() || '';
    if (!decisionNote) {
      setRejectingCalendarItemId(item.id);
      setContentPlanNotice('Decision note is required when rejecting a calendar item.');
      return;
    }

    setContentPlanNotice('');
    setCalendarActionItemId(item.id);
    try {
      const res = await authedFetch(`/api/admin/social-content/calendar/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decision_note: decisionNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCalendarDecisionNotes((current) => ({ ...current, [item.id]: '' }));
        setRejectingCalendarItemId(null);
        setContentPlanNotice('Calendar item rejected and returned to Shaka for revision.');
        await fetchCampaign();
      } else {
        setContentPlanNotice(data.error || 'Failed to reject calendar item.');
      }
    } catch (err) {
      console.error('Failed to reject calendar item:', err);
      setContentPlanNotice('Failed to reject calendar item.');
    } finally {
      setCalendarActionItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-console-page min-h-screen flex items-center justify-center text-foreground">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="admin-console-card rounded-lg border p-6">
            <p className="text-muted-foreground">Campaign not found.</p>
            <Link href={backUrl} className="admin-console-button-secondary mt-4 inline-flex">Back</Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'criteria' as const, label: 'Criteria Templates', icon: Target, count: campaign.campaign_criteria_templates.length },
    { key: 'bundles' as const, label: 'Eligible Bundles', icon: Package, count: campaign.campaign_eligible_bundles.length },
    { key: 'enrollments' as const, label: 'Enrollments', icon: Users, count: enrollments.length },
    { key: 'content-calendar' as const, label: 'Content Calendar', icon: Calendar, count: campaign.calendar_item_count || 0 },
  ];

  const campaignCalendarItems = campaign.social_content_calendar_items || [];
  const calendarPhases: Array<{ key: CampaignCalendarItem['campaign_phase']; label: string }> = [
    { key: 'tease', label: 'Tease' },
    { key: 'teach', label: 'Teach' },
    { key: 'proof', label: 'Proof' },
    { key: 'offer', label: 'Offer' },
  ];

  return (
    <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <Breadcrumbs items={[
        { label: 'Admin', href: '/admin' },
        { label: 'Campaigns', href: '/admin/campaigns' },
        { label: campaign.name },
      ]} />

      {/* Header */}
      <div className="admin-console-surface-header mb-6 mt-4 rounded-xl border p-5 sm:p-6">
        <Link href={backUrl} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="admin-console-eyebrow w-full">Campaign Detail</div>
          <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
          <span className={`px-3 py-1 text-sm rounded-full border ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}>
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </span>
          <span className="rounded-full border border-white/10 bg-silicon-slate/50 px-3 py-1 text-sm text-muted-foreground">
            {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
          </span>
        </div>
        {campaign.description && <p className="mt-2 max-w-3xl text-muted-foreground">{campaign.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock size={14} /> {campaign.completion_window_days} day window</span>
          <span className="flex items-center gap-1"><Calendar size={14} /> {campaign.starts_at ? new Date(campaign.starts_at).toLocaleDateString() : '—'} to {campaign.ends_at ? new Date(campaign.ends_at).toLocaleDateString() : '—'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-console-card mb-6 flex gap-1 overflow-x-auto rounded-lg border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-radiant-gold text-imperial-navy'
                : 'text-muted-foreground hover:bg-silicon-slate/60 hover:text-foreground'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Criteria Tab */}
      {activeTab === 'criteria' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Criteria Templates</h2>
            <button onClick={() => setShowCriteriaForm(!showCriteriaForm)} className={showCriteriaForm ? 'admin-console-button-secondary' : 'admin-console-button-primary'}>
              {showCriteriaForm ? <X size={14} /> : <Plus size={14} />}
              {showCriteriaForm ? 'Cancel' : 'Add Criterion'}
            </button>
          </div>

          {showCriteriaForm && (
            <div className="admin-console-card mb-6 space-y-3 rounded-lg border p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-muted-foreground">Label Template *</label>
                  <input type="text" value={criteriaForm.label_template} onChange={(e) => setCriteriaForm({ ...criteriaForm, label_template: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground" placeholder='Achieve {{revenue_target}} monthly revenue' />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Type</label>
                  <select value={criteriaForm.criteria_type} onChange={(e) => setCriteriaForm({ ...criteriaForm, criteria_type: e.target.value as CriteriaType })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground">
                    {Object.entries(CRITERIA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tracking Source</label>
                  <select value={criteriaForm.tracking_source} onChange={(e) => setCriteriaForm({ ...criteriaForm, tracking_source: e.target.value as TrackingSource })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground">
                    {Object.entries(TRACKING_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Threshold Source</label>
                  <input type="text" value={criteriaForm.threshold_source} onChange={(e) => setCriteriaForm({ ...criteriaForm, threshold_source: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground" placeholder="audit.desired_monthly_revenue" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Threshold Default</label>
                  <input type="text" value={criteriaForm.threshold_default} onChange={(e) => setCriteriaForm({ ...criteriaForm, threshold_default: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground" placeholder="50000" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={criteriaForm.required} onChange={(e) => setCriteriaForm({ ...criteriaForm, required: e.target.checked })} className="rounded" />
                  <label className="text-sm text-muted-foreground">Required</label>
                </div>
              </div>
              <button onClick={handleAddCriterion} disabled={!criteriaForm.label_template.trim()} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">
                Add Criterion
              </button>
            </div>
          )}

          <div className="space-y-3">
            {campaign.campaign_criteria_templates.length === 0 ? (
              <p className="admin-console-card rounded-lg border py-8 text-center text-muted-foreground">No criteria templates yet. Add criteria that clients must meet.</p>
            ) : (
              campaign.campaign_criteria_templates
                .sort((a, b) => a.display_order - b.display_order)
                .map((ct, i) => (
                  <div key={ct.id} className="admin-console-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">#{i + 1}</span>
                        <span className="min-w-0 break-words font-medium">{ct.label_template}</span>
                        {ct.required && <span className="text-xs text-red-400">Required</span>}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span>{CRITERIA_TYPE_LABELS[ct.criteria_type]}</span>
                        <span>{TRACKING_SOURCE_LABELS[ct.tracking_source]}</span>
                        {ct.threshold_source && <span className="break-all">Source: {ct.threshold_source}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCriterion(ct.id)}
                      aria-label={`Delete criterion ${ct.label_template}`}
                      className="self-start rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-300 sm:self-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Bundles Tab */}
      {activeTab === 'bundles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Eligible Bundles</h2>
            <button onClick={() => setShowBundleForm(!showBundleForm)} className={showBundleForm ? 'admin-console-button-secondary' : 'admin-console-button-primary'}>
              {showBundleForm ? <X size={14} /> : <Plus size={14} />}
              {showBundleForm ? 'Cancel' : 'Add Bundle'}
            </button>
          </div>

          {showBundleForm && (
            <div className="admin-console-card mb-6 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Bundle</label>
                <select value={selectedBundleId} onChange={(e) => setSelectedBundleId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground">
                  <option value="">Select a bundle...</option>
                  {availableBundles.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.pricing_tier_slug ? `(${b.pricing_tier_slug})` : ''} — ${b.bundle_price}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleAddBundle} disabled={!selectedBundleId} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">
                Add
              </button>
            </div>
          )}

          <div className="space-y-3">
            {campaign.campaign_eligible_bundles.length === 0 ? (
              <p className="admin-console-card rounded-lg border py-8 text-center text-muted-foreground">No eligible bundles yet. Add bundles that qualify for this campaign.</p>
            ) : (
              campaign.campaign_eligible_bundles.map((eb) => (
                <div key={eb.id} className="admin-console-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="block min-w-0 break-words font-medium">{eb.offer_bundles?.name || 'Unknown bundle'}</span>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-3 text-xs text-gray-400">
                      {eb.offer_bundles?.pricing_tier_slug && <span>Tier: {eb.offer_bundles.pricing_tier_slug}</span>}
                      {eb.offer_bundles?.bundle_price != null && <span>${eb.offer_bundles.bundle_price}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBundle(eb.bundle_id)}
                    aria-label={`Remove bundle ${eb.offer_bundles?.name || eb.bundle_id}`}
                    className="self-start rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-300 sm:self-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Enrollments Tab */}
      {activeTab === 'enrollments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Enrollments</h2>
            <button onClick={() => setShowEnrollForm(!showEnrollForm)} className={showEnrollForm ? 'admin-console-button-secondary' : 'admin-console-button-primary'}>
              {showEnrollForm ? <X size={14} /> : <UserPlus size={14} />}
              {showEnrollForm ? 'Cancel' : 'Enroll Client'}
            </button>
          </div>

          {showEnrollForm && (
            <div className="admin-console-card mb-6 space-y-3 rounded-lg border p-4">
              {enrollError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm text-red-300">
                  <AlertCircle size={16} /> {enrollError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Client Email *</label>
                  <input type="email" value={enrollForm.client_email} onChange={(e) => setEnrollForm({ ...enrollForm, client_email: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground" placeholder="client@example.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Client Name</label>
                  <input type="text" value={enrollForm.client_name} onChange={(e) => setEnrollForm({ ...enrollForm, client_name: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-sm text-foreground" placeholder="John Doe" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Client must have completed the AI Audit Calculator. The system will look up their audit data by email.</p>
              <button onClick={handleEnroll} disabled={!enrollForm.client_email.trim()} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">
                Enroll
              </button>
            </div>
          )}

          <div className="space-y-3">
            {enrollments.length === 0 ? (
              <p className="admin-console-card rounded-lg border py-8 text-center text-muted-foreground">No enrollments yet.</p>
            ) : (
              enrollments.map((e) => {
                const progress = calculateOverallProgress(e.campaign_progress || []);
                return (
                  <Link key={e.id} href={buildLinkWithReturn(`/admin/campaigns/${campaignId}/enrollments/${e.id}`, `/admin/campaigns/${campaignId}`)}>
                    <motion.div whileHover={{ scale: 1.002 }} className="admin-console-card admin-console-interactive cursor-pointer rounded-lg border p-4 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">{e.client_name || e.client_email}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${ENROLLMENT_STATUS_COLORS[e.status as keyof typeof ENROLLMENT_STATUS_COLORS] || ''}`}>
                              {ENROLLMENT_STATUS_LABELS[e.status as keyof typeof ENROLLMENT_STATUS_LABELS] || e.status}
                            </span>
                            <span className="text-xs text-muted-foreground">{ENROLLMENT_SOURCE_LABELS[e.enrollment_source as keyof typeof ENROLLMENT_SOURCE_LABELS] || e.enrollment_source}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span>{e.client_email}</span>
                            <span>Enrolled: {new Date(e.enrolled_at).toLocaleDateString()}</span>
                            <span>Deadline: {new Date(e.deadline_at).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-silicon-slate/70">
                              <div className="h-full rounded-full bg-radiant-gold transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-muted-foreground" />
                      </div>
                    </motion.div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'content-calendar' && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Content Calendar</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Campaign-specific projection of the central Social Content calendar.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[20rem]">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calendar template
                <select
                  value={contentPlanTemplateKey}
                  onChange={(event) => setContentPlanTemplateKey(event.target.value as SocialContentCalendarTemplateKey)}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  {SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SOCIAL_CONTENT_CALENDAR_TEMPLATES[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleGenerateContentPlan}
                disabled={generatingContentPlan}
                className="admin-console-button-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingContentPlan ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {generatingContentPlan ? 'Generating...' : 'Generate Calendar Plan'}
              </button>
            </div>
          </div>

          <div className="admin-console-card mb-4 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-sm text-blue-100">
            <p className="font-semibold">{SOCIAL_CONTENT_CALENDAR_TEMPLATES[contentPlanTemplateKey].label}</p>
            <p className="mt-1 text-xs leading-5 text-blue-100/80">
              {SOCIAL_CONTENT_CALENDAR_TEMPLATES[contentPlanTemplateKey].description}
            </p>
          </div>

          {contentPlanNotice && (
            <div className="admin-console-card mb-4 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3 text-sm text-radiant-gold">
              {contentPlanNotice}
            </div>
          )}

          <div className="admin-console-card mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Authorization creates or updates the internal draft handoff only. External publishing, uploads, scheduling, media generation, and autonomous execution remain locked.
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {calendarPhases.map((phase) => {
              const items = campaignCalendarItems.filter((item) => item.campaign_phase === phase.key);
              return (
                <div key={phase.key} className="admin-console-card rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{phase.label}</h3>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.length ? items.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-silicon-slate/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold ${calendarAuthorizationTone(item.authorization_status)}`}>
                            {item.authorization_status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {item.planned_angle && (
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.planned_angle}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] text-muted-foreground">
                          <span className="rounded-full border border-white/10 px-2 py-0.5">{item.channel.replace(/_/g, ' ')}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5">{item.due_status.replace(/_/g, ' ')}</span>
                          {typeof metadataRecord(item.metadata).template_label === 'string' && (
                            <span className="rounded-full border border-white/10 px-2 py-0.5">
                              {String(metadataRecord(item.metadata).template_label)}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {(() => {
                            const platformDraftHandoff = metadataRecord(metadataRecord(item.metadata).platform_draft_handoff);
                            const handoffWorkItemId = typeof platformDraftHandoff.work_item_id === 'string'
                              ? platformDraftHandoff.work_item_id
                              : null;
                            const socialContentId = item.social_content_id
                              || (typeof platformDraftHandoff.social_content_id === 'string' ? platformDraftHandoff.social_content_id : null);
                            return (
                              <>
                                {handoffWorkItemId && (
                                  <Link href={`/admin/agents/social-insights/${handoffWorkItemId}`} className="text-blue-200 hover:text-blue-100">
                                    Handoff
                                  </Link>
                                )}
                                {!item.social_content_id && socialContentId && (
                                  <Link href={`/admin/social-content/${socialContentId}`} className="text-blue-200 hover:text-blue-100">
                                    Draft
                                  </Link>
                                )}
                              </>
                            );
                          })()}
                          {item.agent_work_item_id && (
                            <Link href={`/admin/agents/social-insights/${item.agent_work_item_id}`} className="text-blue-200 hover:text-blue-100">
                              Insight
                            </Link>
                          )}
                          {item.social_content_id && (
                            <Link href={`/admin/social-content/${item.social_content_id}`} className="text-blue-200 hover:text-blue-100">
                              Draft
                            </Link>
                          )}
                        </div>
                        {(rejectingCalendarItemId === item.id || item.authorization_status === 'rejected') && (
                          <label className="mt-3 block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Decision note
                            <textarea
                              value={calendarDecisionNotes[item.id] || ''}
                              onChange={(event) => setCalendarDecisionNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                              disabled={calendarActionItemId === item.id || item.authorization_status !== 'pending'}
                              rows={2}
                              placeholder="What should Shaka revise before this campaign item can be authorized?"
                              className="mt-1 w-full rounded-lg border border-white/10 bg-silicon-slate/50 px-3 py-2 text-xs normal-case tracking-normal text-foreground disabled:opacity-60"
                            />
                          </label>
                        )}
                        {(item.authorization_status === 'pending' || item.authorization_status === 'rejected') && (
                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handleAuthorizeCalendarItem(item)}
                              disabled={calendarActionItemId === item.id}
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {calendarActionItemId === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              {calendarActionItemId === item.id ? 'Authorizing...' : 'Authorize Draft Handoff'}
                            </button>
                            <button
                              type="button"
                              onClick={() => (rejectingCalendarItemId === item.id || item.authorization_status === 'rejected')
                                ? handleRejectCalendarItem(item)
                                : setRejectingCalendarItemId(item.id)}
                              disabled={calendarActionItemId === item.id || item.authorization_status === 'rejected'}
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {item.authorization_status === 'rejected' ? 'Rejected' : rejectingCalendarItemId === item.id ? 'Submit Rejection' : 'Reject'}
                            </button>
                          </div>
                        )}
                      </div>
                    )) : (
                      <p className="rounded-lg border border-white/10 bg-silicon-slate/40 p-4 text-center text-sm text-muted-foreground">
                        No planned items.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
