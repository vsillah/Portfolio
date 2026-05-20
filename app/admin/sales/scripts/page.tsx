'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import {
  SalesScript,
  OfferType,
  FunnelStage,
  FUNNEL_STAGE_LABELS,
} from '@/lib/sales-scripts';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  RefreshCw,
  Search,
  Filter,
  Play,
  Copy,
} from 'lucide-react';

const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  attraction: 'Attraction Offer',
  upsell: 'Upsell',
  downsell: 'Downsell',
  continuity: 'Continuity',
  core: 'Core Offer',
  objection: 'Objection Handling',
};

const OFFER_TYPE_COLORS: Record<OfferType, string> = {
  attraction: 'bg-radiant-gold/10 text-radiant-gold border-radiant-gold/35',
  upsell: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  downsell: 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  continuity: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  core: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  objection: 'bg-red-500/10 text-red-200 border-red-500/30',
};

const FUNNEL_STAGES: FunnelStage[] = [
  'prospect',
  'interested',
  'informed',
  'converted',
  'active',
  'upgraded',
];

interface ScriptFormData {
  name: string;
  description: string;
  offer_type: OfferType;
  target_funnel_stage: FunnelStage[];
  script_content: {
    steps: { id: string; title: string; talking_points: string[]; actions: string[] }[];
    objection_handlers: { trigger: string; response: string; category: string }[];
    success_metrics: string[];
  };
  is_active: boolean;
}

const EMPTY_SCRIPT: ScriptFormData = {
  name: '',
  description: '',
  offer_type: 'core',
  target_funnel_stage: [],
  script_content: {
    steps: [{ id: '1', title: '', talking_points: [''], actions: [] }],
    objection_handlers: [],
    success_metrics: [],
  },
  is_active: true,
};

export default function ScriptsManagementPage() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<OfferType | 'all'>('all');
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ScriptFormData>(EMPTY_SCRIPT);
  const [isSaving, setIsSaving] = useState(false);

  const fetchScripts = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('active', 'false'); // Get all scripts including inactive
      if (typeFilter !== 'all') {
        params.append('offer_type', typeFilter);
      }

      const response = await fetch(`/api/admin/sales/scripts?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch scripts');

      const data = await response.json();
      setScripts(data.scripts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  // Fetch when user becomes available or filters change
  useEffect(() => {
    if (user) {
      fetchScripts();
    }
  }, [user, fetchScripts]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const session = await getCurrentSession();
      const method = editingScript ? 'PUT' : 'POST';
      const body = editingScript
        ? { id: editingScript, ...formData }
        : formData;

      const response = await fetch('/api/admin/sales/scripts', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save script');
      }

      await fetchScripts();
      setEditingScript(null);
      setIsCreating(false);
      setFormData(EMPTY_SCRIPT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return;

    try {
      const session = await getCurrentSession();
      const response = await fetch(`/api/admin/sales/scripts?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete');

      await fetchScripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleToggleActive = async (script: SalesScript) => {
    try {
      const session = await getCurrentSession();
      const response = await fetch('/api/admin/sales/scripts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          id: script.id,
          is_active: !script.is_active
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      await fetchScripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  const handleEdit = (script: SalesScript) => {
    setFormData({
      name: script.name,
      description: script.description || '',
      offer_type: script.offer_type,
      target_funnel_stage: script.target_funnel_stage,
      script_content: script.script_content,
      is_active: script.is_active,
    });
    setEditingScript(script.id);
    setIsCreating(false);
  };

  const handleDuplicate = (script: SalesScript) => {
    setFormData({
      name: `${script.name} (Copy)`,
      description: script.description || '',
      offer_type: script.offer_type,
      target_funnel_stage: script.target_funnel_stage,
      script_content: script.script_content,
      is_active: true,
    });
    setIsCreating(true);
    setEditingScript(null);
  };

  const cancelEdit = () => {
    setEditingScript(null);
    setIsCreating(false);
    setFormData(EMPTY_SCRIPT);
  };

  // Add/remove steps
  const addStep = () => {
    const newStep = {
      id: Date.now().toString(),
      title: '',
      talking_points: [''],
      actions: [],
    };
    setFormData({
      ...formData,
      script_content: {
        ...formData.script_content,
        steps: [...formData.script_content.steps, newStep],
      },
    });
  };

  const removeStep = (stepId: string) => {
    setFormData({
      ...formData,
      script_content: {
        ...formData.script_content,
        steps: formData.script_content.steps.filter(s => s.id !== stepId),
      },
    });
  };

  const updateStep = (stepId: string, field: string, value: string | string[]) => {
    setFormData({
      ...formData,
      script_content: {
        ...formData.script_content,
        steps: formData.script_content.steps.map(s =>
          s.id === stepId ? { ...s, [field]: value } : s
        ),
      },
    });
  };

  // Filter scripts
  const filteredScripts = scripts.filter(script => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!script.name.toLowerCase().includes(query) &&
          !script.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Scripts' },
          ]}
        />

        {/* Header */}
        <header className="admin-console-surface-header mb-6 mt-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
          <div>
            <div className="admin-console-eyebrow mb-2">
              <FileText className="h-4 w-4" />
              Sales Operations
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Sales Scripts
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Create and manage guided sales conversation scripts
            </p>
          </div>

          <button
            onClick={() => {
              setIsCreating(true);
              setEditingScript(null);
              setFormData(EMPTY_SCRIPT);
            }}
            className="admin-console-button-primary"
          >
            <Plus className="w-4 h-4" />
            New Script
          </button>
        </header>

        {/* Filters */}
        <div className="admin-console-card rounded-lg border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search scripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as OfferType | 'all')}
                className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground focus:border-radiant-gold/70 focus:outline-none"
              >
                <option value="all">All Types</option>
                {Object.entries(OFFER_TYPE_LABELS).map(([type, label]) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300 mb-6">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || editingScript) && (
          <div className="admin-console-card rounded-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-foreground">
                {editingScript ? 'Edit Script' : 'Create New Script'}
              </h2>
              <button onClick={cancelEdit} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Close script form">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Script Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Core Offer Presentation"
                    className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Offer Type *
                  </label>
                  <select
                    value={formData.offer_type}
                    onChange={(e) => setFormData({ ...formData, offer_type: e.target.value as OfferType })}
                    className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground focus:border-radiant-gold/70 focus:outline-none"
                  >
                    {Object.entries(OFFER_TYPE_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this script used for?"
                  className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Target Funnel Stages
                </label>
                <div className="flex flex-wrap gap-2">
                  {FUNNEL_STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => {
                        const stages = formData.target_funnel_stage.includes(stage)
                          ? formData.target_funnel_stage.filter(s => s !== stage)
                          : [...formData.target_funnel_stage, stage];
                        setFormData({ ...formData, target_funnel_stage: stages });
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        formData.target_funnel_stage.includes(stage)
                          ? 'border border-radiant-gold/60 bg-radiant-gold text-background'
                          : 'border border-silicon-slate/70 bg-imperial-navy/70 text-muted-foreground hover:border-radiant-gold/50'
                      }`}
                    >
                      {FUNNEL_STAGE_LABELS[stage]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Script Steps
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-sm text-radiant-gold hover:text-gold-light flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.script_content.steps.map((step, index) => (
                    <div key={step.id} className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/55 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
                        {formData.script_content.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            className="text-red-300 hover:text-red-200"
                            aria-label={`Remove step ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                        placeholder="Step title"
                        className="mb-3 w-full rounded-lg border border-silicon-slate/70 bg-background/35 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                      />

                      <label className="block text-xs text-muted-foreground mb-1">
                        Talking Points (one per line)
                      </label>
                      <textarea
                        value={step.talking_points.join('\n')}
                        onChange={(e) => updateStep(step.id, 'talking_points', e.target.value.split('\n'))}
                        placeholder="Enter talking points, one per line..."
                        className="w-full rounded-lg border border-silicon-slate/70 bg-background/35 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                        rows={3}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-silicon-slate bg-imperial-navy/70"
                />
                <label htmlFor="is_active" className="text-sm text-muted-foreground">
                  Active (visible in sales calls)
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={cancelEdit}
                  className="admin-console-button-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name}
                  className="admin-console-button-primary disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Script'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scripts List */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading scripts...</p>
          </div>
        ) : filteredScripts.length === 0 ? (
          <div className="admin-console-card rounded-lg border py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No scripts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first sales script to get started'}
            </p>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="admin-console-button-primary"
              >
                Create Script
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredScripts.map((script) => (
              <div
                key={script.id}
                className="admin-console-card rounded-lg border overflow-hidden"
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedScript(expandedScript === script.id ? null : script.id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{script.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${OFFER_TYPE_COLORS[script.offer_type]}`}>
                          {OFFER_TYPE_LABELS[script.offer_type]}
                        </span>
                        {!script.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </div>
                      {script.description && (
                        <p className="text-sm text-muted-foreground mt-1">{script.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {script.script_content.steps.length} steps
                    </span>
                    {expandedScript === script.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedScript === script.id && (
                  <div className="border-t border-white/10 p-4 bg-imperial-navy/40">
                    {/* Target stages */}
                    {script.target_funnel_stage.length > 0 && (
                      <div className="mb-4">
                        <span className="text-sm text-muted-foreground">Target stages: </span>
                        {script.target_funnel_stage.map(stage => (
                          <span key={stage} className="inline-block px-2 py-0.5 border border-white/10 bg-white/5 text-muted-foreground rounded text-xs mr-1">
                            {FUNNEL_STAGE_LABELS[stage]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Steps preview */}
                    <div className="space-y-2 mb-4">
                      {script.script_content.steps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-2 text-sm">
                          <span className="w-6 h-6 border border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-medium text-foreground">{step.title}</span>
                            <span className="text-muted-foreground ml-2">
                              ({step.talking_points.filter(p => p.trim()).length} talking points)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(script);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                          script.is_active
                            ? 'text-amber-200 hover:bg-amber-500/10'
                            : 'text-radiant-gold hover:bg-radiant-gold/10'
                        }`}
                      >
                        {script.is_active ? (
                          <>
                            <X className="w-4 h-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Activate
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(script);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(script);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(script.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
