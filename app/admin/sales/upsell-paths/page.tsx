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
  'ci-starter': 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  'ci-accelerator': 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  'ci-growth': 'bg-radiant-gold/10 text-radiant-gold border-radiant-gold/35',
  'quick-win': 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  'accelerator': 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  'growth-engine': 'bg-red-500/10 text-red-200 border-red-500/30',
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
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Upsell Paths' },
          ]}
        />

        {/* Header */}
        <header className="admin-console-surface-header mb-6 mt-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
          <div>
            <div className="admin-console-eyebrow mb-2">
              <ArrowUpRight className="h-4 w-4" />
              Sales Operations
            </div>
            <h1 className="text-3xl font-bold">
              Offer Upsell Paths
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Configure decoy-to-premium pairings and the two-touch prescription model
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="admin-console-button-primary"
            >
              <Plus className="w-4 h-4" />
              New Path
            </button>
            <button
              onClick={fetchPaths}
              disabled={isLoading}
              className="admin-console-button-muted disabled:opacity-60"
              aria-label="Refresh upsell paths"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="admin-console-card mb-6 flex flex-wrap items-center gap-4 rounded-lg border p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by source, upsell, or problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-4 py-2 text-sm text-foreground focus:border-radiant-gold/70 focus:outline-none"
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-silicon-slate bg-imperial-navy"
            />
            Show inactive
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-200" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="admin-console-metric rounded-lg border p-4">
            <p className="text-2xl font-bold text-radiant-gold">{paths.length}</p>
            <p className="text-sm text-muted-foreground">Total Paths</p>
          </div>
          <div className="admin-console-metric rounded-lg border p-4">
            <p className="text-2xl font-bold text-green-400">
              {paths.filter((p) => p.point_of_sale_steps.length > 0).length}
            </p>
            <p className="text-sm text-muted-foreground">With PoS Scripts</p>
          </div>
          <div className="admin-console-metric rounded-lg border p-4">
            <p className="text-2xl font-bold text-sky-200">
              {paths.filter((p) => p.point_of_pain_steps.length > 0).length}
            </p>
            <p className="text-sm text-muted-foreground">With PoP Scripts</p>
          </div>
          <div className="admin-console-metric rounded-lg border p-4">
            <p className="text-2xl font-bold text-emerald-200">
              {paths.filter((p) => p.credit_previous_investment).length}
            </p>
            <p className="text-sm text-muted-foreground">Credit Eligible</p>
          </div>
        </div>

        {/* Path List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading upsell paths...</div>
        ) : paths.length === 0 ? (
          <div className="admin-console-card rounded-lg border py-12 text-center text-muted-foreground">
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
    ? TIER_COLORS[path.source_tier_slug] || 'bg-white/5 text-muted-foreground border-white/10'
    : 'bg-white/5 text-muted-foreground border-white/10';

  const upsellTierColor = path.upsell_tier_slug
    ? TIER_COLORS[path.upsell_tier_slug] || 'bg-white/5 text-muted-foreground border-white/10'
    : 'bg-white/5 text-muted-foreground border-white/10';

  return (
    <div
      className={`rounded-xl border transition-all ${
        path.is_active
          ? 'admin-console-card admin-console-interactive'
          : 'admin-console-card opacity-60'
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
            <span className="font-medium text-foreground truncate">{path.source_title}</span>
            <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className={`text-xs px-2 py-0.5 rounded border ${upsellTierColor}`}>
              {path.upsell_tier_slug || 'standalone'}
            </span>
            <span className="font-medium text-amber-400 truncate">{path.upsell_title}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{path.next_problem}</p>
        </div>

        {/* Metrics */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          {path.incremental_cost && (
          <div className="flex items-center gap-1 text-emerald-200">
              <DollarSign className="w-3.5 h-3.5" />
              {path.incremental_cost.toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {path.next_problem_timing}
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-muted-foreground">
              {path.point_of_sale_steps.length}/{path.point_of_pain_steps.length}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="View details"
            aria-label={isExpanded ? 'Collapse upsell path details' : 'Expand upsell path details'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-radiant-gold transition-colors"
            title="Edit"
            aria-label="Edit upsell path"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-red-300 transition-colors"
            title="Deactivate"
            aria-label="Deactivate upsell path"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* Next Problem */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Next Problem (Client Voice)</h4>
            <p className="text-sm text-muted-foreground italic">&ldquo;{path.next_problem}&rdquo;</p>
          </div>

          {/* Timing & Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Timing</h4>
              <p className="text-sm text-muted-foreground">{path.next_problem_timing}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Observable Signals</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
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
                <h4 className="text-sm font-semibold text-foreground mb-1">Value Frame</h4>
                <p className="text-sm text-muted-foreground">{path.value_frame_text}</p>
              </div>
            )}
            {path.risk_reversal_text && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-200" />
                  Risk Reversal
                </h4>
                <p className="text-sm text-muted-foreground">{path.risk_reversal_text}</p>
              </div>
            )}
          </div>

          {/* Credit Policy */}
          {path.credit_previous_investment && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <h4 className="text-sm font-semibold text-emerald-200 mb-1">Credit Policy</h4>
              <p className="text-sm text-muted-foreground">
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
                  <div key={step.id} className="rounded-lg border border-white/10 bg-imperial-navy/55 p-3">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <ul className="mt-1 space-y-0.5">
                      {step.talking_points.map((tp, i) => (
                        <li key={i} className="text-xs text-muted-foreground pl-3 border-l border-amber-500/30">
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
              <h4 className="text-sm font-semibold text-sky-200 mb-2">
                Point of Pain Script ({path.point_of_pain_steps.length} steps)
              </h4>
              <div className="space-y-2">
                {path.point_of_pain_steps.map((step) => (
                  <div key={step.id} className="rounded-lg border border-white/10 bg-imperial-navy/55 p-3">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <ul className="mt-1 space-y-0.5">
                      {step.talking_points.map((tp, i) => (
                        <li key={i} className="text-xs text-muted-foreground pl-3 border-l border-sky-500/30">
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
            <div className="text-xs text-muted-foreground italic">Notes: {path.notes}</div>
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
      <div className="admin-console-card rounded-xl border w-full max-w-3xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">
            {path ? 'Edit Upsell Path' : 'Create Upsell Path'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close upsell path modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm">
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
                <label className="text-xs text-muted-foreground">Content Type</label>
                <select
                  value={sourceContentType}
                  onChange={(e) => setSourceContentType(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Content ID</label>
                <input
                  type="text"
                  value={sourceContentId}
                  onChange={(e) => setSourceContentId(e.target.value)}
                  placeholder="e.g. ci-chatbot-template"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Display Title</label>
                <input
                  type="text"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="Pre-Built Chatbot Template"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tier Slug (optional)</label>
                <input
                  type="text"
                  value={sourceTierSlug}
                  onChange={(e) => setSourceTierSlug(e.target.value)}
                  placeholder="ci-accelerator"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
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
              <label className="text-xs text-muted-foreground">Problem Description (Client Voice)</label>
              <textarea
                value={nextProblem}
                onChange={(e) => setNextProblem(e.target.value)}
                rows={3}
                placeholder="The template is generic — it does not know my products..."
                className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Timing</label>
                <input
                  type="text"
                  value={nextProblemTiming}
                  onChange={(e) => setNextProblemTiming(e.target.value)}
                  placeholder="2-4 weeks after install"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observable Signals</label>
              <div className="space-y-2 mt-1">
                {nextProblemSignals.map((signal, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-muted-foreground bg-imperial-navy/70 border border-white/10 px-3 py-1.5 rounded-lg">
                      {signal}
                    </span>
                    <button
                      onClick={() => removeSignal(i)}
                      className="text-muted-foreground hover:text-red-400"
                      aria-label={`Remove signal ${i + 1}`}
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
                    className="flex-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                  />
                  <button
                    onClick={addSignal}
                    className="admin-console-button-muted px-3 py-1.5"
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
                <label className="text-xs text-muted-foreground">Content Type</label>
                <select
                  value={upsellContentType}
                  onChange={(e) => setUpsellContentType(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Content ID</label>
                <input
                  type="text"
                  value={upsellContentId}
                  onChange={(e) => setUpsellContentId(e.target.value)}
                  placeholder="e.g. acc-deployed-chatbot"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Display Title</label>
                <input
                  type="text"
                  value={upsellTitle}
                  onChange={(e) => setUpsellTitle(e.target.value)}
                  placeholder="AI Customer Support Chatbot (Deployed)"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tier Slug (optional)</label>
                <input
                  type="text"
                  value={upsellTierSlug}
                  onChange={(e) => setUpsellTierSlug(e.target.value)}
                  placeholder="accelerator"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          {/* Value & Pricing */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-radiant-gold uppercase tracking-wider">
              Value & Pricing
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Perceived Value ($)</label>
                <input
                  type="number"
                  value={upsellPerceivedValue}
                  onChange={(e) => setUpsellPerceivedValue(e.target.value)}
                  placeholder="15000"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Incremental Cost ($)</label>
                <input
                  type="number"
                  value={incrementalCost}
                  onChange={(e) => setIncrementalCost(e.target.value)}
                  placeholder="5500"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Incremental Value ($)</label>
                <input
                  type="number"
                  value={incrementalValue}
                  onChange={(e) => setIncrementalValue(e.target.value)}
                  placeholder="15000"
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Value Frame Text</label>
              <textarea
                value={valueFrameText}
                onChange={(e) => setValueFrameText(e.target.value)}
                rows={2}
                placeholder="The template is $1,997. The deployed chatbot is part of the Accelerator at $7,497..."
                className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Risk Reversal Text</label>
              <textarea
                value={riskReversalText}
                onChange={(e) => setRiskReversalText(e.target.value)}
                rows={2}
                placeholder="Accelerator Guarantee: Save 10+ hours per week within 90 days..."
                className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
              />
            </div>
          </fieldset>

          {/* Credit Policy */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-sky-200 uppercase tracking-wider">
              Credit Policy
            </legend>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={creditPreviousInvestment}
                onChange={(e) => setCreditPreviousInvestment(e.target.checked)}
                className="rounded border-silicon-slate"
              />
              Previous investment applies as credit toward the upsell
            </label>
            {creditPreviousInvestment && (
              <div>
                <label className="text-xs text-muted-foreground">Credit Note</label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Your $1,997 CI Accelerator investment applies as credit..."
                  className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                />
              </div>
            )}
          </fieldset>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground">Internal Notes (admin only)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="admin-console-button-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="admin-console-button-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : path ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
