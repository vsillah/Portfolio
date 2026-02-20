'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Target, Users, Package, CheckCircle2,
  Clock, Loader2, X, ChevronRight, AlertCircle, UserPlus, Calendar,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS, CRITERIA_TYPE_LABELS,
  TRACKING_SOURCE_LABELS, ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS,
  ENROLLMENT_SOURCE_LABELS, CAMPAIGN_TYPE_LABELS, calculateOverallProgress,
} from '@/lib/campaigns';
import type {
  AttractionCampaign, CampaignCriteriaTemplate, CriteriaType, TrackingSource,
} from '@/lib/campaigns';

interface CampaignDetail extends AttractionCampaign {
  campaign_eligible_bundles: Array<{
    id: string;
    bundle_id: string;
    offer_bundles: { id: string; name: string; pricing_tier_slug: string; bundle_price: number } | null;
  }>;
  campaign_criteria_templates: CampaignCriteriaTemplate[];
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
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'criteria' | 'bundles' | 'enrollments'>('criteria');

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

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch campaign:', err);
    }
  }, [campaignId]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enrollments`);
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
    }
  }, [campaignId]);

  const fetchBundles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sales/bundles');
      if (res.ok) {
        const data = await res.json();
        setAvailableBundles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCampaign(), fetchEnrollments(), fetchBundles()]).finally(() => setLoading(false));
  }, [fetchCampaign, fetchEnrollments, fetchBundles]);

  const handleAddCriterion = async () => {
    if (!criteriaForm.label_template.trim()) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/criteria`, {
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
      await fetch(`/api/admin/campaigns/${campaignId}/criteria?criterion_id=${criterionId}`, { method: 'DELETE' });
      fetchCampaign();
    } catch (err) {
      console.error('Failed to delete criterion:', err);
    }
  };

  const handleAddBundle = async () => {
    if (!selectedBundleId) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/eligible-bundles`, {
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
      await fetch(`/api/admin/campaigns/${campaignId}/eligible-bundles?bundle_id=${bundleId}`, { method: 'DELETE' });
      fetchCampaign();
    } catch (err) {
      console.error('Failed to remove bundle:', err);
    }
  };

  const handleEnroll = async () => {
    if (!enrollForm.client_email.trim()) return;
    setEnrollError('');
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enrollments`, {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <p className="text-gray-400">Campaign not found.</p>
        <Link href="/admin/campaigns" className="text-amber-400 hover:underline mt-2 inline-block">Back to campaigns</Link>
      </div>
    );
  }

  const tabs = [
    { key: 'criteria' as const, label: 'Criteria Templates', icon: Target, count: campaign.campaign_criteria_templates.length },
    { key: 'bundles' as const, label: 'Eligible Bundles', icon: Package, count: campaign.campaign_eligible_bundles.length },
    { key: 'enrollments' as const, label: 'Enrollments', icon: Users, count: enrollments.length },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Breadcrumbs items={[
        { label: 'Admin', href: '/admin' },
        { label: 'Campaigns', href: '/admin/campaigns' },
        { label: campaign.name },
      ]} />

      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/campaigns" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Back to campaigns
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <span className={`px-3 py-1 text-sm rounded-full border ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}>
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </span>
          <span className="px-3 py-1 text-sm rounded-full bg-gray-700 text-gray-300">
            {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
          </span>
        </div>
        {campaign.description && <p className="text-gray-400 mt-2">{campaign.description}</p>}
        <div className="flex items-center gap-6 mt-3 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Clock size={14} /> {campaign.completion_window_days} day window</span>
          <span className="flex items-center gap-1"><Calendar size={14} /> {campaign.starts_at ? new Date(campaign.starts_at).toLocaleDateString() : '—'} to {campaign.ends_at ? new Date(campaign.ends_at).toLocaleDateString() : '—'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className="px-1.5 py-0.5 text-xs bg-gray-700 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Criteria Tab */}
      {activeTab === 'criteria' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Criteria Templates</h2>
            <button onClick={() => setShowCriteriaForm(!showCriteriaForm)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm">
              {showCriteriaForm ? <X size={14} /> : <Plus size={14} />}
              {showCriteriaForm ? 'Cancel' : 'Add Criterion'}
            </button>
          </div>

          {showCriteriaForm && (
            <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Label Template *</label>
                  <input type="text" value={criteriaForm.label_template} onChange={(e) => setCriteriaForm({ ...criteriaForm, label_template: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm" placeholder='Achieve {{revenue_target}} monthly revenue' />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select value={criteriaForm.criteria_type} onChange={(e) => setCriteriaForm({ ...criteriaForm, criteria_type: e.target.value as CriteriaType })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm">
                    {Object.entries(CRITERIA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tracking Source</label>
                  <select value={criteriaForm.tracking_source} onChange={(e) => setCriteriaForm({ ...criteriaForm, tracking_source: e.target.value as TrackingSource })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm">
                    {Object.entries(TRACKING_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Threshold Source</label>
                  <input type="text" value={criteriaForm.threshold_source} onChange={(e) => setCriteriaForm({ ...criteriaForm, threshold_source: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm" placeholder="audit.desired_monthly_revenue" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Threshold Default</label>
                  <input type="text" value={criteriaForm.threshold_default} onChange={(e) => setCriteriaForm({ ...criteriaForm, threshold_default: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm" placeholder="50000" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={criteriaForm.required} onChange={(e) => setCriteriaForm({ ...criteriaForm, required: e.target.checked })} className="rounded" />
                  <label className="text-sm text-gray-300">Required</label>
                </div>
              </div>
              <button onClick={handleAddCriterion} disabled={!criteriaForm.label_template.trim()} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm">
                Add Criterion
              </button>
            </div>
          )}

          <div className="space-y-3">
            {campaign.campaign_criteria_templates.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No criteria templates yet. Add criteria that clients must meet.</p>
            ) : (
              campaign.campaign_criteria_templates
                .sort((a, b) => a.display_order - b.display_order)
                .map((ct, i) => (
                  <div key={ct.id} className="p-4 bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">#{i + 1}</span>
                        <span className="font-medium">{ct.label_template}</span>
                        {ct.required && <span className="text-xs text-red-400">Required</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{CRITERIA_TYPE_LABELS[ct.criteria_type]}</span>
                        <span>{TRACKING_SOURCE_LABELS[ct.tracking_source]}</span>
                        {ct.threshold_source && <span>Source: {ct.threshold_source}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteCriterion(ct.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
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
            <button onClick={() => setShowBundleForm(!showBundleForm)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm">
              {showBundleForm ? <X size={14} /> : <Plus size={14} />}
              {showBundleForm ? 'Cancel' : 'Add Bundle'}
            </button>
          </div>

          {showBundleForm && (
            <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Bundle</label>
                <select value={selectedBundleId} onChange={(e) => setSelectedBundleId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">Select a bundle...</option>
                  {availableBundles.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.pricing_tier_slug ? `(${b.pricing_tier_slug})` : ''} — ${b.bundle_price}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleAddBundle} disabled={!selectedBundleId} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm">
                Add
              </button>
            </div>
          )}

          <div className="space-y-3">
            {campaign.campaign_eligible_bundles.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No eligible bundles yet. Add bundles that qualify for this campaign.</p>
            ) : (
              campaign.campaign_eligible_bundles.map((eb) => (
                <div key={eb.id} className="p-4 bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-medium">{eb.offer_bundles?.name || 'Unknown bundle'}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      {eb.offer_bundles?.pricing_tier_slug && <span>Tier: {eb.offer_bundles.pricing_tier_slug}</span>}
                      {eb.offer_bundles?.bundle_price != null && <span>${eb.offer_bundles.bundle_price}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveBundle(eb.bundle_id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
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
            <button onClick={() => setShowEnrollForm(!showEnrollForm)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm">
              {showEnrollForm ? <X size={14} /> : <UserPlus size={14} />}
              {showEnrollForm ? 'Cancel' : 'Enroll Client'}
            </button>
          </div>

          {showEnrollForm && (
            <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
              {enrollError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm text-red-300">
                  <AlertCircle size={16} /> {enrollError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Email *</label>
                  <input type="email" value={enrollForm.client_email} onChange={(e) => setEnrollForm({ ...enrollForm, client_email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm" placeholder="client@example.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                  <input type="text" value={enrollForm.client_name} onChange={(e) => setEnrollForm({ ...enrollForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm" placeholder="John Doe" />
                </div>
              </div>
              <p className="text-xs text-gray-500">Client must have completed the AI Audit Calculator. The system will look up their audit data by email.</p>
              <button onClick={handleEnroll} disabled={!enrollForm.client_email.trim()} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm">
                Enroll
              </button>
            </div>
          )}

          <div className="space-y-3">
            {enrollments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No enrollments yet.</p>
            ) : (
              enrollments.map((e) => {
                const progress = calculateOverallProgress(e.campaign_progress || []);
                return (
                  <Link key={e.id} href={`/admin/campaigns/${campaignId}/enrollments/${e.id}`}>
                    <motion.div whileHover={{ scale: 1.002 }} className="p-4 bg-gray-900 border border-gray-700 rounded-lg hover:border-amber-500/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">{e.client_name || e.client_email}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${ENROLLMENT_STATUS_COLORS[e.status as keyof typeof ENROLLMENT_STATUS_COLORS] || ''}`}>
                              {ENROLLMENT_STATUS_LABELS[e.status as keyof typeof ENROLLMENT_STATUS_LABELS] || e.status}
                            </span>
                            <span className="text-xs text-gray-500">{ENROLLMENT_SOURCE_LABELS[e.enrollment_source as keyof typeof ENROLLMENT_SOURCE_LABELS] || e.enrollment_source}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{e.client_email}</span>
                            <span>Enrolled: {new Date(e.enrolled_at).toLocaleDateString()}</span>
                            <span>Deadline: {new Date(e.deadline_at).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{progress}%</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-500" />
                      </div>
                    </motion.div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
