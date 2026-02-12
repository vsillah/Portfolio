'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Save,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import {
  GUARANTEE_TYPE_LABELS,
  PAYOUT_TYPE_LABELS,
  PAYOUT_AMOUNT_TYPE_LABELS,
  validateConditions,
} from '@/lib/guarantees';
import type {
  GuaranteeTemplate,
  GuaranteeCondition,
  GuaranteeType,
  GuaranteePayoutType,
  PayoutAmountType,
  CreateGuaranteeTemplateInput,
} from '@/lib/guarantees';

interface GuaranteeTemplateEditorProps {
  template?: GuaranteeTemplate | null;
  onSave: (data: CreateGuaranteeTemplateInput) => Promise<void>;
  onCancel?: () => void;
  continuityPlans?: { id: string; name: string }[];
  services?: { id: string; title: string }[];
}

const EMPTY_CONDITION: GuaranteeCondition = {
  id: '',
  label: '',
  verification_method: 'admin_verified',
  required: true,
};

export default function GuaranteeTemplateEditor({
  template,
  onSave,
  onCancel,
  continuityPlans = [],
  services = [],
}: GuaranteeTemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [guaranteeType, setGuaranteeType] = useState<GuaranteeType>(
    template?.guarantee_type || 'conditional'
  );
  const [durationDays, setDurationDays] = useState(template?.duration_days || 90);
  const [conditions, setConditions] = useState<GuaranteeCondition[]>(
    template?.conditions || []
  );
  const [defaultPayoutType, setDefaultPayoutType] = useState<GuaranteePayoutType>(
    template?.default_payout_type || 'refund'
  );
  const [payoutAmountType, setPayoutAmountType] = useState<PayoutAmountType>(
    template?.payout_amount_type || 'full'
  );
  const [payoutAmountValue, setPayoutAmountValue] = useState<number | ''>(
    template?.payout_amount_value || ''
  );
  const [rolloverBonusMultiplier, setRolloverBonusMultiplier] = useState(
    template?.rollover_bonus_multiplier || 1.0
  );
  const [rolloverUpsellServiceIds, setRolloverUpsellServiceIds] = useState<string[]>(
    template?.rollover_upsell_service_ids || []
  );
  const [rolloverContinuityPlanId, setRolloverContinuityPlanId] = useState(
    template?.rollover_continuity_plan_id || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isRollover = defaultPayoutType === 'rollover_upsell' || defaultPayoutType === 'rollover_continuity';

  // Auto-generate condition ID from label
  const generateConditionId = (label: string) =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const addCondition = () => {
    setConditions([...conditions, { ...EMPTY_CONDITION, id: `condition-${Date.now()}` }]);
  };

  const updateCondition = (index: number, updates: Partial<GuaranteeCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    // Auto-generate ID from label if label changed
    if (updates.label !== undefined) {
      updated[index].id = generateConditionId(updates.label);
    }
    setConditions(updated);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      if (!name.trim()) throw new Error('Name is required');
      if (durationDays < 1) throw new Error('Duration must be at least 1 day');
      if (guaranteeType === 'conditional' && conditions.length === 0) {
        throw new Error('Conditional guarantees must have at least one condition');
      }

      // Validate conditions
      const validConditions = conditions.filter(c => c.label.trim());
      if (guaranteeType === 'conditional' && !validateConditions(validConditions)) {
        throw new Error('Each condition must have a label and verification method');
      }

      const input: CreateGuaranteeTemplateInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        guarantee_type: guaranteeType,
        duration_days: durationDays,
        conditions: validConditions,
        default_payout_type: defaultPayoutType,
        payout_amount_type: payoutAmountType,
        payout_amount_value: payoutAmountValue || undefined,
        rollover_bonus_multiplier: isRollover ? rolloverBonusMultiplier : undefined,
        rollover_upsell_service_ids:
          defaultPayoutType === 'rollover_upsell' ? rolloverUpsellServiceIds : undefined,
        rollover_continuity_plan_id:
          defaultPayoutType === 'rollover_continuity' ? rolloverContinuityPlanId || undefined : undefined,
      };

      await onSave(input);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">
          {template ? 'Edit Guarantee Template' : 'New Guarantee Template'}
        </h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 90-Day ROI Guarantee"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
          <select
            value={guaranteeType}
            onChange={(e) => setGuaranteeType(e.target.value as GuaranteeType)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            {Object.entries(GUARANTEE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Description (client-facing)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="If you complete all the requirements and don't see results, you get your money back..."
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        />
      </div>

      {/* Duration */}
      <div className="flex items-center gap-4">
        <Clock className="w-5 h-5 text-gray-400" />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(parseInt(e.target.value) || 0)}
            min={1}
            className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-center"
          />
          <span className="text-gray-300 text-sm">day guarantee window</span>
        </div>
      </div>

      {/* Conditions */}
      {guaranteeType === 'conditional' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-300">Conditions</h4>
            <button
              onClick={addCondition}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Condition
            </button>
          </div>

          {conditions.length === 0 && (
            <p className="text-gray-500 text-sm italic">
              No conditions defined. Add conditions the client must meet to qualify for the guarantee.
            </p>
          )}

          {conditions.map((condition, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <GripVertical className="w-4 h-4 text-gray-600 mt-2 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={condition.label}
                  onChange={(e) => updateCondition(index, { label: e.target.value })}
                  placeholder="e.g. Attend all 6 coaching sessions"
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                />
                <div className="flex items-center gap-4">
                  <select
                    value={condition.verification_method}
                    onChange={(e) =>
                      updateCondition(index, {
                        verification_method: e.target.value as 'admin_verified' | 'client_self_report',
                      })
                    }
                    className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300 text-xs"
                  >
                    <option value="admin_verified">Admin Verified</option>
                    <option value="client_self_report">Client Self-Report</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={condition.required}
                      onChange={(e) => updateCondition(index, { required: e.target.checked })}
                      className="rounded border-gray-600"
                    />
                    Required
                  </label>
                </div>
              </div>
              <button
                onClick={() => removeCondition(index)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Payout Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Payout Configuration
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Default Payout Type</label>
            <select
              value={defaultPayoutType}
              onChange={(e) => setDefaultPayoutType(e.target.value as GuaranteePayoutType)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              {Object.entries(PAYOUT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Payout Amount</label>
            <select
              value={payoutAmountType}
              onChange={(e) => setPayoutAmountType(e.target.value as PayoutAmountType)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              {Object.entries(PAYOUT_AMOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {payoutAmountType !== 'full' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {payoutAmountType === 'partial' ? 'Percentage (0-100)' : 'Fixed Amount ($)'}
            </label>
            <input
              type="number"
              value={payoutAmountValue}
              onChange={(e) => setPayoutAmountValue(parseFloat(e.target.value) || '')}
              min={0}
              max={payoutAmountType === 'partial' ? 100 : undefined}
              step={payoutAmountType === 'partial' ? 1 : 0.01}
              className="w-40 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
          </div>
        )}

        {/* Rollover-specific config */}
        {isRollover && (
          <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg space-y-4">
            <h5 className="text-sm font-medium text-indigo-300">Rollover Configuration</h5>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Bonus Multiplier (e.g. 1.25 = 25% bonus on rollover credit)
              </label>
              <input
                type="number"
                value={rolloverBonusMultiplier}
                onChange={(e) => setRolloverBonusMultiplier(parseFloat(e.target.value) || 1.0)}
                min={1}
                max={5}
                step={0.05}
                className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                A $1,000 refund at 1.25x becomes $1,250 in rollover credit.
              </p>
            </div>

            {defaultPayoutType === 'rollover_upsell' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Eligible Services for Upsell Credit</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={rolloverUpsellServiceIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRolloverUpsellServiceIds([...rolloverUpsellServiceIds, s.id]);
                          } else {
                            setRolloverUpsellServiceIds(rolloverUpsellServiceIds.filter(id => id !== s.id));
                          }
                        }}
                        className="rounded border-gray-600"
                      />
                      {s.title}
                    </label>
                  ))}
                  {services.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No services available</p>
                  )}
                </div>
              </div>
            )}

            {defaultPayoutType === 'rollover_continuity' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Continuity Plan for Subscription Credit</label>
                <select
                  value={rolloverContinuityPlanId}
                  onChange={(e) => setRolloverContinuityPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="">Select a continuity plan...</option>
                  {continuityPlans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {continuityPlans.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No continuity plans exist yet. Create one first.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
