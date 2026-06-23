'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Megaphone, Plus, ChevronRight, Calendar, Users, Target,
  DollarSign, X, Loader2,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { buildLinkWithReturn } from '@/lib/admin-return-context';
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
  calendar_item_count: number;
  next_calendar_item: {
    id: string;
    title: string;
    channel: string;
    campaign_phase: string;
    scheduled_for: string;
    authorization_status: string;
  } | null;
}

export default function CampaignsAdminPage() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<CampaignWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');
  const [contextApplied, setContextApplied] = useState(false);

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

  useEffect(() => {
    if (contextApplied || searchParams.get('source') !== 'offer-architecture') return;

    const campaignName = searchParams.get('campaignName');
    const campaignSlug = searchParams.get('campaignSlug');
    if (!campaignName || !campaignSlug) return;

    setShowCreate(true);
    setContextApplied(true);
    setForm((current) => ({
      ...current,
      name: campaignName,
      slug: campaignSlug,
      description:
        'Creditable readiness assessment generated from the ReversR product-asset offer architecture.',
      campaign_type: (searchParams.get('campaignType') as CampaignType | null) || 'bonus_credit',
      completion_window_days: Number(searchParams.get('completionWindowDays')) || 30,
      min_purchase_amount: Number(searchParams.get('minPurchaseAmount')) || 7500,
      payout_type: (searchParams.get('payoutType') as GuaranteePayoutType | null) || 'rollover_upsell',
      payout_amount_type: (searchParams.get('payoutAmountType') as PayoutAmountType | null) || 'fixed',
      payout_amount_value: Number(searchParams.get('payoutAmountValue')) || 7500,
    }));
  }, [contextApplied, searchParams]);

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
    <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Campaigns' }]} />

      <div className="admin-console-surface-header mb-6 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="admin-console-eyebrow mb-2">Sales Campaigns</div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
            <Megaphone className="text-radiant-gold" size={32} />
            Attraction Campaigns
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Manage time-bound promotional offers across bundles and tiers.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={showCreate ? 'admin-console-button-secondary' : 'admin-console-button-primary'}
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? 'Cancel' : 'New Campaign'}
        </button>
      </div>

      {contextApplied && (
        <div className="admin-console-card mb-6 rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 p-4 text-sm text-radiant-gold">
          Offer architecture context applied. Review the prefilled campaign, then add eligible bundles
          and criteria templates after creation.
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="admin-console-card mb-8 space-y-4 rounded-lg border p-5 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">Create Campaign</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
                placeholder="Win Your Money Back Challenge"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
                placeholder="win-your-money-back"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Type</label>
              <select
                value={form.campaign_type}
                onChange={(e) => setForm({ ...form, campaign_type: e.target.value as CampaignType })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              >
                {Object.entries(CAMPAIGN_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Completion Window (days)</label>
              <input
                type="number"
                value={form.completion_window_days}
                onChange={(e) => setForm({ ...form, completion_window_days: parseInt(e.target.value) || 90 })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={form.starts_at || ''}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={form.ends_at || ''}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Payout Type</label>
              <select
                value={form.payout_type}
                onChange={(e) => setForm({ ...form, payout_type: e.target.value as GuaranteePayoutType })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              >
                {Object.entries(PAYOUT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Payout Amount</label>
              <select
                value={form.payout_amount_type}
                onChange={(e) => setForm({ ...form, payout_amount_type: e.target.value as PayoutAmountType })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
              >
                {Object.entries(PAYOUT_AMOUNT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">Description</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground focus:border-radiant-gold/50 focus:outline-none"
                rows={3}
                placeholder="Deposit X dollars and get it all back if you do the work..."
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !form.name?.trim() || !form.slug?.trim()}
            className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Create Campaign
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="admin-console-card mb-6 flex items-center gap-4 rounded-lg border p-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="px-3 py-2 bg-silicon-slate/50 border border-white/10 rounded-lg text-foreground text-sm focus:border-radiant-gold/50 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-radiant-gold" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="admin-console-card rounded-lg border py-20 text-center text-muted-foreground">
          <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
          <p>No campaigns yet. Create your first attraction campaign.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Link key={c.id} href={buildLinkWithReturn(`/admin/campaigns/${c.id}`, '/admin/campaigns')}>
              <motion.div
                whileHover={{ scale: 1.005 }}
                className="admin-console-card admin-console-interactive rounded-lg border p-5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{c.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                        {CAMPAIGN_TYPE_LABELS[c.campaign_type]}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{c.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-100">
                        {c.calendar_item_count || 0} calendar item{c.calendar_item_count === 1 ? '' : 's'}
                      </span>
                      {c.next_calendar_item && (
                        <span className="min-w-0 rounded-full border border-white/10 px-2 py-0.5">
                          Next: {c.next_calendar_item.campaign_phase.replace(/_/g, ' ')} · {new Date(c.next_calendar_item.scheduled_for).toLocaleDateString()}
                        </span>
                      )}
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
                    <ChevronRight size={20} className="text-radiant-gold" />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
