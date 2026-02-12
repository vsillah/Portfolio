'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Plus,
  ChevronDown,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import GuaranteeTemplateEditor from '@/components/admin/guarantees/GuaranteeTemplateEditor';
import {
  INSTANCE_STATUS_LABELS,
  INSTANCE_STATUS_COLORS,
  PAYOUT_TYPE_LABELS,
  daysRemaining,
} from '@/lib/guarantees';
import type {
  GuaranteeInstance,
  GuaranteeInstanceStatus,
  GuaranteeTemplate,
  CreateGuaranteeTemplateInput,
} from '@/lib/guarantees';

export default function GuaranteesAdminPage() {
  // State
  const [instances, setInstances] = useState<any[]>([]);
  const [templates, setTemplates] = useState<GuaranteeTemplate[]>([]);
  const [continuityPlans, setContinuityPlans] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; title: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GuaranteeInstanceStatus | ''>('');
  const [emailSearch, setEmailSearch] = useState('');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'instances' | 'templates'>('instances');

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (emailSearch) params.set('email', emailSearch);
      const res = await fetch(`/api/admin/guarantees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch instances:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, emailSearch]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/guarantee-templates?active=false');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  const fetchSupporting = useCallback(async () => {
    try {
      const [plansRes, servicesRes] = await Promise.all([
        fetch('/api/admin/continuity-plans?active=false'),
        fetch('/api/services?active=false'),
      ]);
      if (plansRes.ok) {
        const plans = await plansRes.json();
        setContinuityPlans(Array.isArray(plans) ? plans.map((p: any) => ({ id: p.id, name: p.name })) : []);
      }
      if (servicesRes.ok) {
        const svcs = await servicesRes.json();
        setServices(Array.isArray(svcs) ? svcs.map((s: any) => ({ id: s.id, title: s.title })) : []);
      }
    } catch (err) {
      console.error('Failed to fetch supporting data:', err);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    fetchTemplates();
    fetchSupporting();
  }, [fetchInstances, fetchTemplates, fetchSupporting]);

  const handleCreateTemplate = async (input: CreateGuaranteeTemplateInput) => {
    const res = await fetch('/api/admin/guarantee-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create template');
    }
    setShowTemplateEditor(false);
    fetchTemplates();
  };

  const statusOptions: (GuaranteeInstanceStatus | '')[] = [
    '',
    'active',
    'conditions_met',
    'refund_issued',
    'credit_issued',
    'rollover_upsell_applied',
    'rollover_continuity_applied',
    'expired',
    'voided',
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Guarantees</h1>
              <p className="text-gray-400 text-sm">Manage conditional guarantees and track client progress</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('instances')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'instances'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Active Guarantees ({total})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Templates ({templates.length})
          </button>
        </div>

        {/* Instances Tab */}
        {activeTab === 'instances' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Search by email..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as GuaranteeInstanceStatus | '')}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="">All Statuses</option>
                {statusOptions.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{INSTANCE_STATUS_LABELS[s as GuaranteeInstanceStatus]}</option>
                ))}
              </select>
              <button
                onClick={fetchInstances}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Instance list */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : instances.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No guarantee instances found.
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((inst: any) => {
                  const days = daysRemaining(inst);
                  const template = inst.guarantee_templates;
                  const milestones = inst.guarantee_milestones || [];
                  const metCount = milestones.filter(
                    (m: any) => m.status === 'met' || m.status === 'waived'
                  ).length;

                  return (
                    <Link
                      key={inst.id}
                      href={`/admin/guarantees/${inst.id}`}
                      className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-sm font-medium text-white">
                              {template?.name || 'Unknown Template'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {inst.client_name || inst.client_email} — Order #{inst.order_id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Progress */}
                          <div className="text-right">
                            <p className="text-xs text-gray-400">
                              {metCount}/{milestones.length} conditions
                            </p>
                            <div className="w-20 h-1.5 bg-gray-700 rounded-full mt-1">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{
                                  width: `${milestones.length > 0 ? (metCount / milestones.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          {/* Days remaining */}
                          {inst.status === 'active' && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {days}d left
                            </div>
                          )}
                          {/* Amount */}
                          <div className="flex items-center gap-1 text-sm text-gray-300">
                            <DollarSign className="w-3 h-3" />
                            {parseFloat(inst.purchase_amount).toFixed(0)}
                          </div>
                          {/* Status badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                              INSTANCE_STATUS_COLORS[inst.status as GuaranteeInstanceStatus] || 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {INSTANCE_STATUS_LABELS[inst.status as GuaranteeInstanceStatus] || inst.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowTemplateEditor(!showTemplateEditor)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>

            {showTemplateEditor && (
              <GuaranteeTemplateEditor
                onSave={handleCreateTemplate}
                onCancel={() => setShowTemplateEditor(false)}
                continuityPlans={continuityPlans}
                services={services}
              />
            )}

            {templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No guarantee templates yet. Create one above.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={`p-4 border rounded-lg ${
                      t.is_active
                        ? 'bg-gray-900 border-gray-700'
                        : 'bg-gray-900/50 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-white">{t.name}</h4>
                        <p className="text-xs text-gray-400 mt-1">{t.description}</p>
                      </div>
                      {!t.is_active && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t.duration_days} days
                      </span>
                      <span>{t.conditions.length} conditions</span>
                      <span>{PAYOUT_TYPE_LABELS[t.default_payout_type]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
