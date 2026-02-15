'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface UpsellPath {
  id: string;
  source_content_type: string;
  source_content_id: string;
  source_title: string;
  source_tier_slug: string | null;
  next_problem: string;
  next_problem_timing: string;
  next_problem_signals: string[];
  upsell_content_type: string;
  upsell_content_id: string;
  upsell_title: string;
  upsell_tier_slug: string | null;
  upsell_perceived_value: number | null;
  point_of_sale_steps: ScriptStep[];
  point_of_pain_steps: ScriptStep[];
  incremental_cost: number | null;
  incremental_value: number | null;
  value_frame_text: string | null;
  risk_reversal_text: string | null;
  credit_previous_investment: boolean;
  credit_note: string | null;
  point_of_sale_script_id: string | null;
  point_of_pain_script_id: string | null;
  display_order: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ScriptStep {
  id: string;
  title: string;
  talking_points: string[];
  actions: string[];
}

// ============================================================================
// Constants
// ============================================================================

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'ci-starter', label: 'CI Starter' },
  { value: 'ci-accelerator', label: 'CI Accelerator' },
  { value: 'ci-growth', label: 'CI Growth' },
  { value: 'standalone', label: 'Standalone' },
];

const CONTENT_TYPES = [
  'product', 'service', 'lead_magnet', 'video', 'publication', 'music', 'project', 'prototype',
];

const TIER_COLORS: Record<string, string> = {
  'ci-starter': 'bg-green-500/20 text-green-400 border-green-500/30',
  'ci-accelerator': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'ci-growth': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'quick-win': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'accelerator': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'growth-engine': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function UpsellPathsPage() {
  const { user } = useAuth();
  const [paths, setPaths] = useState<UpsellPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPath, setEditingPath] = useState<UpsellPath | null>(null);
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchPaths = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (!showInactive) params.append('active', 'true');
      if (tierFilter !== 'all') params.append('source_tier', tierFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/sales/upsell-paths?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch upsell paths');

      const data = await response.json();
      setPaths(data.paths || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive, tierFilter, searchQuery]);

  useEffect(() => {
    if (user) fetchPaths();
  }, [user, fetchPaths]);

  // ============================================================================
  // CRUD Handlers
  // ============================================================================

  const handleSave = async (pathData: Partial<UpsellPath>, id?: string) => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;

    try {
      const url = id
        ? `/api/admin/sales/upsell-paths/${id}`
        : '/api/admin/sales/upsell-paths';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(pathData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setShowCreateModal(false);
      setEditingPath(null);
      fetchPaths();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this upsell path?')) return;

    const session = await getCurrentSession();
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/admin/sales/upsell-paths/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to delete');
      fetchPaths();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Upsell Paths' },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ArrowUpRight className="w-8 h-8 text-amber-500" />
              Offer Upsell Paths
            </h1>
            <p className="text-gray-400 mt-1">
              Configure decoy-to-premium pairings and the two-touch prescription model
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Path
            </button>
            <button
              onClick={fetchPaths}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by source, upsell, or problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-amber-500/50 focus:outline-none"
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-600"
            />
            Show inactive
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-amber-400">{paths.length}</p>
            <p className="text-sm text-gray-400">Total Paths</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-green-400">
              {paths.filter((p) => p.point_of_sale_steps.length > 0).length}
            </p>
            <p className="text-sm text-gray-400">With PoS Scripts</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-blue-400">
              {paths.filter((p) => p.point_of_pain_steps.length > 0).length}
            </p>
            <p className="text-sm text-gray-400">With PoP Scripts</p>
          </div>
          <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-2xl font-bold text-purple-400">
              {paths.filter((p) => p.credit_previous_investment).length}
            </p>
            <p className="text-sm text-gray-400">Credit Eligible</p>
          </div>
        </div>

        {/* Path List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading upsell paths...</div>
        ) : paths.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No upsell paths found. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {paths.map((path) => (
              <UpsellPathCard
                key={path.id}
                path={path}
                isExpanded={expandedPathId === path.id}
                onToggleExpand={() =>
                  setExpandedPathId(expandedPathId === path.id ? null : path.id)
                }
                onEdit={() => setEditingPath(path)}
                onDelete={() => handleDelete(path.id)}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingPath) && (
          <UpsellPathModal
            path={editingPath}
            onSave={handleSave}
            onClose={() => {
              setShowCreateModal(false);
              setEditingPath(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// UpsellPathCard Component
// ============================================================================

function UpsellPathCard({
  path,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  path: UpsellPath;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tierColor = path.source_tier_slug
    ? TIER_COLORS[path.source_tier_slug] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  const upsellTierColor = path.upsell_tier_slug
    ? TIER_COLORS[path.upsell_tier_slug] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div
      className={`border rounded-xl transition-all ${
        path.is_active
          ? 'bg-gray-900/50 border-gray-800 hover:border-amber-500/30'
          : 'bg-gray-900/30 border-gray-800/50 opacity-60'
      }`}
    >
      {/* Summary Row */}
      <div className="p-4 flex items-center gap-4">
        {/* Source -> Upsell */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border ${tierColor}`}>
              {path.source_tier_slug || 'standalone'}
            </span>
            <span className="font-medium text-white truncate">{path.source_title}</span>
            <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className={`text-xs px-2 py-0.5 rounded border ${upsellTierColor}`}>
              {path.upsell_tier_slug || 'standalone'}
            </span>
            <span className="font-medium text-amber-400 truncate">{path.upsell_title}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{path.next_problem}</p>
        </div>

        {/* Metrics */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          {path.incremental_cost && (
            <div className="flex items-center gap-1 text-green-400">
              <DollarSign className="w-3.5 h-3.5" />
              {path.incremental_cost.toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {path.next_problem_timing}
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400">
              {path.point_of_sale_steps.length}/{path.point_of_pain_steps.length}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="View details"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
            title="Deactivate"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Next Problem */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-1">Next Problem (Client Voice)</h4>
            <p className="text-sm text-gray-400 italic">&ldquo;{path.next_problem}&rdquo;</p>
          </div>

          {/* Timing & Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">Timing</h4>
              <p className="text-sm text-gray-400">{path.next_problem_timing}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">Observable Signals</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                {(path.next_problem_signals || []).map((signal, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Eye className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Value Framing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {path.value_frame_text && (
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Value Frame</h4>
                <p className="text-sm text-gray-400">{path.value_frame_text}</p>
              </div>
            )}
            {path.risk_reversal_text && (
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-green-400" />
                  Risk Reversal
                </h4>
                <p className="text-sm text-gray-400">{path.risk_reversal_text}</p>
              </div>
            )}
          </div>

          {/* Credit Policy */}
          {path.credit_previous_investment && (
            <div className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
              <h4 className="text-sm font-semibold text-green-400 mb-1">Credit Policy</h4>
              <p className="text-sm text-gray-400">
                {path.credit_note || 'Previous investment applies as credit toward the upsell.'}
              </p>
            </div>
          )}

          {/* Point of Sale Steps */}
          {path.point_of_sale_steps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-2">
                Point of Sale Script ({path.point_of_sale_steps.length} steps)
              </h4>
              <div className="space-y-2">
                {path.point_of_sale_steps.map((step) => (
                  <div key={step.id} className="p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <ul className="mt-1 space-y-0.5">
                      {step.talking_points.map((tp, i) => (
                        <li key={i} className="text-xs text-gray-400 pl-3 border-l border-amber-500/30">
                          {tp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Point of Pain Steps */}
          {path.point_of_pain_steps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-blue-400 mb-2">
                Point of Pain Script ({path.point_of_pain_steps.length} steps)
              </h4>
              <div className="space-y-2">
                {path.point_of_pain_steps.map((step) => (
                  <div key={step.id} className="p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <ul className="mt-1 space-y-0.5">
                      {step.talking_points.map((tp, i) => (
                        <li key={i} className="text-xs text-gray-400 pl-3 border-l border-blue-500/30">
                          {tp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          {path.notes && (
            <div className="text-xs text-gray-500 italic">Notes: {path.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UpsellPathModal Component (Create / Edit)
// ============================================================================

function UpsellPathModal({
  path,
  onSave,
  onClose,
}: {
  path: UpsellPath | null;
  onSave: (data: Partial<UpsellPath>, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [sourceContentType, setSourceContentType] = useState(path?.source_content_type || 'service');
  const [sourceContentId, setSourceContentId] = useState(path?.source_content_id || '');
  const [sourceTitle, setSourceTitle] = useState(path?.source_title || '');
  const [sourceTierSlug, setSourceTierSlug] = useState(path?.source_tier_slug || '');
  const [nextProblem, setNextProblem] = useState(path?.next_problem || '');
  const [nextProblemTiming, setNextProblemTiming] = useState(path?.next_problem_timing || '2-4 weeks');
  const [nextProblemSignals, setNextProblemSignals] = useState<string[]>(path?.next_problem_signals || []);
  const [upsellContentType, setUpsellContentType] = useState(path?.upsell_content_type || 'service');
  const [upsellContentId, setUpsellContentId] = useState(path?.upsell_content_id || '');
  const [upsellTitle, setUpsellTitle] = useState(path?.upsell_title || '');
  const [upsellTierSlug, setUpsellTierSlug] = useState(path?.upsell_tier_slug || '');
  const [upsellPerceivedValue, setUpsellPerceivedValue] = useState(path?.upsell_perceived_value?.toString() || '');
  const [incrementalCost, setIncrementalCost] = useState(path?.incremental_cost?.toString() || '');
  const [incrementalValue, setIncrementalValue] = useState(path?.incremental_value?.toString() || '');
  const [valueFrameText, setValueFrameText] = useState(path?.value_frame_text || '');
  const [riskReversalText, setRiskReversalText] = useState(path?.risk_reversal_text || '');
  const [creditPreviousInvestment, setCreditPreviousInvestment] = useState(path?.credit_previous_investment ?? true);
  const [creditNote, setCreditNote] = useState(path?.credit_note || '');
  const [notes, setNotes] = useState(path?.notes || '');
  const [newSignal, setNewSignal] = useState('');

  const handleSubmit = async () => {
    setFormError(null);

    if (!sourceContentType || !sourceContentId || !sourceTitle) {
      setFormError('Source offer fields are required');
      return;
    }
    if (!upsellContentType || !upsellContentId || !upsellTitle) {
      setFormError('Upsell offer fields are required');
      return;
    }
    if (!nextProblem) {
      setFormError('Next problem description is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          source_content_type: sourceContentType,
          source_content_id: sourceContentId,
          source_title: sourceTitle,
          source_tier_slug: sourceTierSlug || null,
          next_problem: nextProblem,
          next_problem_timing: nextProblemTiming,
          next_problem_signals: nextProblemSignals,
          upsell_content_type: upsellContentType,
          upsell_content_id: upsellContentId,
          upsell_title: upsellTitle,
          upsell_tier_slug: upsellTierSlug || null,
          upsell_perceived_value: upsellPerceivedValue ? parseFloat(upsellPerceivedValue) : null,
          incremental_cost: incrementalCost ? parseFloat(incrementalCost) : null,
          incremental_value: incrementalValue ? parseFloat(incrementalValue) : null,
          value_frame_text: valueFrameText || null,
          risk_reversal_text: riskReversalText || null,
          credit_previous_investment: creditPreviousInvestment,
          credit_note: creditNote || null,
          notes: notes || null,
        },
        path?.id
      );
    } catch {
      setFormError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const addSignal = () => {
    if (newSignal.trim()) {
      setNextProblemSignals([...nextProblemSignals, newSignal.trim()]);
      setNewSignal('');
    }
  };

  const removeSignal = (index: number) => {
    setNextProblemSignals(nextProblemSignals.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold">
            {path ? 'Edit Upsell Path' : 'Create Upsell Path'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {formError}
            </div>
          )}

          {/* Source Offer */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              Source Offer (Decoy / Entry-Level)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Content Type</label>
                <select
                  value={sourceContentType}
                  onChange={(e) => setSourceContentType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Content ID</label>
                <input
                  type="text"
                  value={sourceContentId}
                  onChange={(e) => setSourceContentId(e.target.value)}
                  placeholder="e.g. ci-chatbot-template"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Display Title</label>
                <input
                  type="text"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="Pre-Built Chatbot Template"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tier Slug (optional)</label>
                <input
                  type="text"
                  value={sourceTierSlug}
                  onChange={(e) => setSourceTierSlug(e.target.value)}
                  placeholder="ci-accelerator"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          {/* Next Problem */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-red-400 uppercase tracking-wider">
              Predicted Next Problem
            </legend>
            <div>
              <label className="text-xs text-gray-400">Problem Description (Client Voice)</label>
              <textarea
                value={nextProblem}
                onChange={(e) => setNextProblem(e.target.value)}
                rows={3}
                placeholder="The template is generic — it does not know my products..."
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Timing</label>
                <input
                  type="text"
                  value={nextProblemTiming}
                  onChange={(e) => setNextProblemTiming(e.target.value)}
                  placeholder="2-4 weeks after install"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Observable Signals</label>
              <div className="space-y-2 mt-1">
                {nextProblemSignals.map((signal, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-300 bg-gray-800 px-3 py-1.5 rounded-lg">
                      {signal}
                    </span>
                    <button
                      onClick={() => removeSignal(i)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSignal}
                    onChange={(e) => setNewSignal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSignal())}
                    placeholder="Add a signal..."
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                  />
                  <button
                    onClick={addSignal}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Upsell Offer */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-green-400 uppercase tracking-wider">
              Upsell Offer (Premium Solution)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Content Type</label>
                <select
                  value={upsellContentType}
                  onChange={(e) => setUpsellContentType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Content ID</label>
                <input
                  type="text"
                  value={upsellContentId}
                  onChange={(e) => setUpsellContentId(e.target.value)}
                  placeholder="e.g. acc-deployed-chatbot"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Display Title</label>
                <input
                  type="text"
                  value={upsellTitle}
                  onChange={(e) => setUpsellTitle(e.target.value)}
                  placeholder="AI Customer Support Chatbot (Deployed)"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tier Slug (optional)</label>
                <input
                  type="text"
                  value={upsellTierSlug}
                  onChange={(e) => setUpsellTierSlug(e.target.value)}
                  placeholder="accelerator"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          {/* Value & Pricing */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
              Value & Pricing
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Perceived Value ($)</label>
                <input
                  type="number"
                  value={upsellPerceivedValue}
                  onChange={(e) => setUpsellPerceivedValue(e.target.value)}
                  placeholder="15000"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Incremental Cost ($)</label>
                <input
                  type="number"
                  value={incrementalCost}
                  onChange={(e) => setIncrementalCost(e.target.value)}
                  placeholder="5500"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Incremental Value ($)</label>
                <input
                  type="number"
                  value={incrementalValue}
                  onChange={(e) => setIncrementalValue(e.target.value)}
                  placeholder="15000"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Value Frame Text</label>
              <textarea
                value={valueFrameText}
                onChange={(e) => setValueFrameText(e.target.value)}
                rows={2}
                placeholder="The template is $1,997. The deployed chatbot is part of the Accelerator at $7,497..."
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Risk Reversal Text</label>
              <textarea
                value={riskReversalText}
                onChange={(e) => setRiskReversalText(e.target.value)}
                rows={2}
                placeholder="Accelerator Guarantee: Save 10+ hours per week within 90 days..."
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </fieldset>

          {/* Credit Policy */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
              Credit Policy
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={creditPreviousInvestment}
                onChange={(e) => setCreditPreviousInvestment(e.target.checked)}
                className="rounded border-gray-600"
              />
              Previous investment applies as credit toward the upsell
            </label>
            {creditPreviousInvestment && (
              <div>
                <label className="text-xs text-gray-400">Credit Note</label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Your $1,997 CI Accelerator investment applies as credit..."
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            )}
          </fieldset>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400">Internal Notes (admin only)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : path ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
