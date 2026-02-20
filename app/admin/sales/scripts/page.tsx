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
  attraction: 'bg-pink-100 text-pink-700 border-pink-300',
  upsell: 'bg-purple-100 text-purple-700 border-purple-300',
  downsell: 'bg-orange-100 text-orange-700 border-orange-300',
  continuity: 'bg-teal-100 text-teal-700 border-teal-300',
  core: 'bg-blue-100 text-blue-700 border-blue-300',
  objection: 'bg-red-100 text-red-700 border-red-300',
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
  }, [fetchScripts]);

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Breadcrumbs 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Scripts' },
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-emerald-500" />
              Sales Scripts
            </h1>
            <p className="text-gray-400 mt-1">
              Create and manage guided sales conversation scripts
            </p>
          </div>

          <button
            onClick={() => {
              setIsCreating(true);
              setEditingScript(null);
              setFormData(EMPTY_SCRIPT);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            New Script
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search scripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as OfferType | 'all')}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
          <div className="bg-red-500/20 text-red-400 p-4 rounded-lg border border-red-500/50 mb-6">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || editingScript) && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">
                {editingScript ? 'Edit Script' : 'Create New Script'}
              </h2>
              <button onClick={cancelEdit} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Script Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Core Offer Presentation"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Offer Type *
                  </label>
                  <select
                    value={formData.offer_type}
                    onChange={(e) => setFormData({ ...formData, offer_type: e.target.value as OfferType })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {Object.entries(OFFER_TYPE_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this script used for?"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                  <label className="block text-sm font-medium text-gray-300">
                    Script Steps
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-sm text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.script_content.steps.map((step, index) => (
                    <div key={step.id} className="border border-gray-700 bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-400">Step {index + 1}</span>
                        {formData.script_content.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            className="text-red-500 hover:text-red-400"
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
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-3 text-white placeholder-gray-500"
                      />

                      <label className="block text-xs text-gray-500 mb-1">
                        Talking Points (one per line)
                      </label>
                      <textarea
                        value={step.talking_points.join('\n')}
                        onChange={(e) => updateStep(step.id, 'talking_points', e.target.value.split('\n'))}
                        placeholder="Enter talking points, one per line..."
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500"
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
                  className="rounded border-gray-600 bg-gray-800"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">
                  Active (visible in sales calls)
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
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
            <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400">Loading scripts...</p>
          </div>
        ) : filteredScripts.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">No scripts found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || typeFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first sales script to get started'}
            </p>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
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
                className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
              >
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50"
                  onClick={() => setExpandedScript(expandedScript === script.id ? null : script.id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{script.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${OFFER_TYPE_COLORS[script.offer_type]}`}>
                          {OFFER_TYPE_LABELS[script.offer_type]}
                        </span>
                        {!script.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {script.description && (
                        <p className="text-sm text-gray-400 mt-1">{script.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {script.script_content.steps.length} steps
                    </span>
                    {expandedScript === script.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>

                {expandedScript === script.id && (
                  <div className="border-t border-gray-800 p-4 bg-gray-800/50">
                    {/* Target stages */}
                    {script.target_funnel_stage.length > 0 && (
                      <div className="mb-4">
                        <span className="text-sm text-gray-500">Target stages: </span>
                        {script.target_funnel_stage.map(stage => (
                          <span key={stage} className="inline-block px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs mr-1">
                            {FUNNEL_STAGE_LABELS[stage]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Steps preview */}
                    <div className="space-y-2 mb-4">
                      {script.script_content.steps.map((step, i) => (
                        <div key={step.id} className="flex items-start gap-2 text-sm">
                          <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-medium text-white">{step.title}</span>
                            <span className="text-gray-500 ml-2">
                              ({step.talking_points.filter(p => p.trim()).length} talking points)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(script);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                          script.is_active 
                            ? 'text-orange-400 hover:bg-orange-500/20' 
                            : 'text-emerald-400 hover:bg-emerald-500/20'
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
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(script);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded-lg"
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
