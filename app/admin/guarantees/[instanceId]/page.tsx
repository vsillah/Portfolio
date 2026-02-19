'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  ArrowLeft,
  Clock,
  DollarSign,
  User,
  Mail,
  Package,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Play,
  Ban,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import MilestoneTracker from '@/components/admin/guarantees/MilestoneTracker';
import { formatCurrency } from '@/lib/pricing-model';
import {
  INSTANCE_STATUS_LABELS,
  INSTANCE_STATUS_COLORS,
  PAYOUT_TYPE_LABELS,
  daysRemaining,
  isGuaranteeExpired,
} from '@/lib/guarantees';
import type { GuaranteeInstanceStatus, MilestoneStatus } from '@/lib/guarantees';

export default function GuaranteeInstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.instanceId as string;

  const [instance, setInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInstance = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/guarantees/${instanceId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch');
      }
      setInstance(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  const handleVerifyMilestone = async (
    conditionId: string,
    status: MilestoneStatus,
    notes?: string
  ) => {
    const res = await fetch(
      `/api/admin/guarantees/${instanceId}/milestones/${conditionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify milestone');
    }
    fetchInstance(); // Refresh to see updated status
  };

  const handleEvaluate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/guarantees/${instanceId}/evaluate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchInstance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (resolution: string) => {
    const notes = prompt(`Enter notes for ${resolution}:`);
    if (notes === null) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/guarantees/${instanceId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      fetchInstance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (error && !instance) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <Link href="/admin/guarantees" className="text-blue-400 text-sm mt-2 inline-block">
            Back to Guarantees
          </Link>
        </div>
      </div>
    );
  }

  if (!instance) return null;

  const template = instance.guarantee_templates;
  const milestones = instance.guarantee_milestones || [];
  const days = daysRemaining(instance);
  const expired = isGuaranteeExpired(instance);
  const canEvaluate = instance.status === 'active' || instance.status === 'conditions_met';
  const canResolve = instance.status === 'active' || instance.status === 'conditions_met';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Guarantees', href: '/admin/guarantees' },
            { label: template?.name || 'Instance' },
          ]}
        />
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/guarantees"
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Shield className="w-6 h-6 text-blue-400" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{template?.name || 'Guarantee'}</h1>
            <p className="text-gray-400 text-sm">Instance {instanceId.slice(0, 8)}...</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              INSTANCE_STATUS_COLORS[instance.status as GuaranteeInstanceStatus]
            }`}
          >
            {INSTANCE_STATUS_LABELS[instance.status as GuaranteeInstanceStatus]}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <User className="w-3 h-3" />
              Client
            </div>
            <p className="text-sm text-white font-medium">{instance.client_name || 'N/A'}</p>
            <p className="text-xs text-gray-400">{instance.client_email}</p>
          </div>

          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Purchase Amount
            </div>
            <p className="text-sm text-white font-medium">
              {formatCurrency(parseFloat(instance.purchase_amount))}
            </p>
            <p className="text-xs text-gray-400">
              {PAYOUT_TYPE_LABELS[instance.payout_type as keyof typeof PAYOUT_TYPE_LABELS]}
            </p>
          </div>

          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Time Remaining
            </div>
            <p className={`text-sm font-medium ${expired ? 'text-red-400' : days <= 7 ? 'text-yellow-400' : 'text-white'}`}>
              {expired ? 'Expired' : `${days} days`}
            </p>
            <p className="text-xs text-gray-400">
              Expires {new Date(instance.expires_at).toLocaleDateString()}
            </p>
          </div>

          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Package className="w-3 h-3" />
              Order
            </div>
            <p className="text-sm text-white font-medium">#{instance.order_id}</p>
            <p className="text-xs text-gray-400">
              Item #{instance.order_item_id}
            </p>
          </div>
        </div>

        {/* Rollover credit info */}
        {instance.rollover_credit_amount && (
          <div className="p-4 bg-indigo-900/20 border border-indigo-700 rounded-lg">
            <p className="text-sm text-indigo-300">
              Rollover credit: <strong>{formatCurrency(parseFloat(instance.rollover_credit_amount))}</strong>
              {template?.rollover_bonus_multiplier > 1 && (
                <span className="text-xs text-indigo-400 ml-2">
                  ({template.rollover_bonus_multiplier}x bonus multiplier applied)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Resolution notes */}
        {instance.resolution_notes && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Resolution Notes</p>
            <p className="text-sm text-gray-300">{instance.resolution_notes}</p>
            {instance.resolved_at && (
              <p className="text-xs text-gray-500 mt-2">
                Resolved {new Date(instance.resolved_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Milestones */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Condition Milestones</h2>
          <MilestoneTracker
            milestones={milestones}
            instanceId={instanceId}
            isAdmin={true}
            onVerify={canEvaluate ? handleVerifyMilestone : undefined}
          />
        </div>

        {/* Actions */}
        {canEvaluate && (
          <div className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <button
              onClick={handleEvaluate}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Evaluate & Trigger Payout
            </button>
            <button
              onClick={() => handleResolve('voided')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              <Ban className="w-4 h-4" />
              Void Guarantee
            </button>
            <button
              onClick={() => handleResolve('expired')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Force Expire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
