'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Megaphone, Plus, ChevronRight, Calendar, Users, Target,
  DollarSign, X, Loader2,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  CAMPAIGN_TYPE_LABELS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS,
  ENROLLMENT_STATUS_LABELS, validateSlug,
} from '@/lib/campaigns';
import type {
  AttractionCampaign, CampaignType, CampaignStatus, CreateCampaignInput,
} from '@/lib/campaigns';
import type { GuaranteePayoutType, PayoutAmountType } from '@/lib/guarantees';
import { PAYOUT_TYPE_LABELS, PAYOUT_AMOUNT_TYPE_LABELS } from '@/lib/guarantees';

interface CampaignWithCounts extends AttractionCampaign {
  eligible_bundle_count: number;
  criteria_count: number;
  enrollment_count: number;
  active_enrollment_count: number;
}

export default function CampaignsAdminPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');

  const [form, setForm] = useState<CreateCampaignInput>({
    name: '',
    slug: '',
    description: '',
    campaign_type: 'win_money_back',
    completion_window_days: 90,
    min_purchase_amount: 0,
    payout_type: 'refund',
    payout_amount_type: 'full',
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/campaigns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleCreate = async () => {
    if (!form.name?.trim() || !form.slug?.trim()) return;
    if (!validateSlug(form.slug)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: '', slug: '', campaign_type: 'win_money_back', completion_window_days: 90, payout_type: 'refund', payout_amount_type: 'full' });
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: CampaignStatus) => {
    try {
      await fetch(`/api/admin/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchCampaigns();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Campaigns' }]} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="text-amber-400" size={32} />
            Attraction Campaigns
          </h1>
          <p className="text-gray-400 mt-1">Manage time-bound promotional offers across bundles and tiers</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? 'Cancel' : 'New Campaign'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-8 p-6 bg-gray-900 border border-gray-700 rounded-xl space-y-4">
          <h2 className="text-xl font-semibold mb-4">Create Campaign</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                placeholder="Win Your Money Back Challenge"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                placeholder="win-your-money-back"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={form.campaign_type}
                onChange={(e) => setForm({ ...form, campaign_type: e.target.value as CampaignType })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                {Object.entries(CAMPAIGN_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Completion Window (days)</label>
              <input
                type="number"
                value={form.completion_window_days}
                onChange={(e) => setForm({ ...form, completion_window_days: parseInt(e.target.value) || 90 })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={form.starts_at || ''}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={form.ends_at || ''}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payout Type</label>
              <select
                value={form.payout_type}
                onChange={(e) => setForm({ ...form, payout_type: e.target.value as GuaranteePayoutType })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                {Object.entries(PAYOUT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payout Amount</label>
              <select
                value={form.payout_amount_type}
                onChange={(e) => setForm({ ...form, payout_amount_type: e.target.value as PayoutAmountType })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                {Object.entries(PAYOUT_AMOUNT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                rows={3}
                placeholder="Deposit X dollars and get it all back if you do the work..."
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !form.name?.trim() || !form.slug?.trim()}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Create Campaign
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
        >
          <option value="">All Statuses</option>
          {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
          <p>No campaigns yet. Create your first attraction campaign.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`}>
              <motion.div
                whileHover={{ scale: 1.005 }}
                className="p-5 bg-gray-900 border border-gray-700 rounded-xl hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{c.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300">
                        {CAMPAIGN_TYPE_LABELS[c.campaign_type]}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-1">{c.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : 'No start'} — {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : 'No end'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target size={14} />
                        {c.criteria_count} criteria
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign size={14} />
                        {c.eligible_bundle_count} bundles
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {c.active_enrollment_count} active / {c.enrollment_count} total
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === 'draft' && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleStatusChange(c.id, 'active'); }}
                        className="px-3 py-1 text-xs bg-green-600/20 text-green-300 border border-green-500/50 rounded-lg hover:bg-green-600/30"
                      >
                        Activate
                      </button>
                    )}
                    {c.status === 'active' && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleStatusChange(c.id, 'paused'); }}
                        className="px-3 py-1 text-xs bg-yellow-600/20 text-yellow-300 border border-yellow-500/50 rounded-lg hover:bg-yellow-600/30"
                      >
                        Pause
                      </button>
                    )}
                    {c.status === 'paused' && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleStatusChange(c.id, 'active'); }}
                        className="px-3 py-1 text-xs bg-green-600/20 text-green-300 border border-green-500/50 rounded-lg hover:bg-green-600/30"
                      >
                        Resume
                      </button>
                    )}
                    <ChevronRight size={20} className="text-gray-500" />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
