'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle, Shield,
  Loader2, MessageSquare, DollarSign,
} from 'lucide-react';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS, ENROLLMENT_SOURCE_LABELS,
  PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS, CRITERIA_TYPE_LABELS,
  TRACKING_SOURCE_LABELS, calculateOverallProgress, enrollmentDaysRemaining,
} from '@/lib/campaigns';
import type { ProgressStatus } from '@/lib/campaigns';

interface EnrollmentDetail {
  id: string;
  campaign_id: string;
  client_email: string;
  client_name: string | null;
  enrollment_source: string;
  status: string;
  enrolled_at: string;
  deadline_at: string;
  purchase_amount: number | null;
  personalization_context: Record<string, unknown>;
  resolution_notes: string | null;
  attraction_campaigns: { id: string; name: string; slug: string; campaign_type: string; payout_type: string };
  enrollment_criteria: Array<{
    id: string; label: string; description: string | null; criteria_type: string;
    tracking_source: string; target_value: string | null; required: boolean; display_order: number;
  }>;
  campaign_progress: Array<{
    id: string; criterion_id: string; status: string; progress_value: number;
    current_value: string | null; auto_tracked: boolean; client_evidence: string | null;
    client_submitted_at: string | null; admin_verified_at: string | null; admin_notes: string | null;
  }>;
}

export default function EnrollmentDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const enrollmentId = params.enrollmentId as string;

  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchEnrollment = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enrollments/${enrollmentId}`);
      if (res.ok) {
        const data = await res.json();
        setEnrollment(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch enrollment:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, enrollmentId]);

  useEffect(() => { fetchEnrollment(); }, [fetchEnrollment]);

  const handleVerify = async (criterionId: string, status: 'met' | 'not_met' | 'waived', notes?: string) => {
    setVerifyingId(criterionId);
    try {
      await fetch(`/api/admin/campaigns/${campaignId}/enrollments/${enrollmentId}/progress/${criterionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes }),
      });
      fetchEnrollment();
    } catch (err) {
      console.error('Failed to verify:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleResolve = async (payoutType: string) => {
    setResolving(true);
    try {
      await fetch(`/api/admin/campaigns/${campaignId}/enrollments/${enrollmentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payout_type: payoutType }),
      });
      fetchEnrollment();
    } catch (err) {
      console.error('Failed to resolve:', err);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <p className="text-gray-400">Enrollment not found.</p>
      </div>
    );
  }

  const criteria = enrollment.enrollment_criteria.sort((a, b) => a.display_order - b.display_order);
  const progressMap = new Map(enrollment.campaign_progress.map((p) => [p.criterion_id, p]));
  const overallProgress = calculateOverallProgress(enrollment.campaign_progress);
  const daysLeft = enrollmentDaysRemaining(enrollment);
  const isTerminal = ['refund_issued', 'credit_issued', 'rollover_applied', 'expired', 'withdrawn'].includes(enrollment.status);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Breadcrumbs items={[
        { label: 'Admin', href: '/admin' },
        { label: 'Campaigns', href: '/admin/campaigns' },
        { label: enrollment.attraction_campaigns?.name || 'Campaign', href: `/admin/campaigns/${campaignId}` },
        { label: enrollment.client_name || enrollment.client_email },
      ]} />

      <Link href={`/admin/campaigns/${campaignId}`} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to campaign
      </Link>

      {/* Client Header */}
      <div className="mb-8 p-6 bg-gray-900 border border-gray-700 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{enrollment.client_name || enrollment.client_email}</h1>
            <p className="text-gray-400 text-sm">{enrollment.client_email}</p>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full border ${ENROLLMENT_STATUS_COLORS[enrollment.status as keyof typeof ENROLLMENT_STATUS_COLORS] || ''}`}>
            {ENROLLMENT_STATUS_LABELS[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABELS] || enrollment.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Source</span>
            <p>{ENROLLMENT_SOURCE_LABELS[enrollment.enrollment_source as keyof typeof ENROLLMENT_SOURCE_LABELS] || enrollment.enrollment_source}</p>
          </div>
          <div>
            <span className="text-gray-500">Enrolled</span>
            <p>{new Date(enrollment.enrolled_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Deadline</span>
            <p className={daysLeft <= 7 ? 'text-red-400' : ''}>{new Date(enrollment.deadline_at).toLocaleDateString()} ({daysLeft}d left)</p>
          </div>
          <div>
            <span className="text-gray-500">Purchase</span>
            <p>{enrollment.purchase_amount ? `$${enrollment.purchase_amount}` : '—'}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Overall Progress</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Criteria Progress */}
      <h2 className="text-xl font-semibold mb-4">Criteria Progress</h2>
      <div className="space-y-4 mb-8">
        {criteria.map((c, i) => {
          const progress = progressMap.get(c.id);
          const pStatus = (progress?.status || 'pending') as ProgressStatus;
          return (
            <div key={c.id} className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">#{i + 1}</span>
                  <span className="font-medium">{c.label}</span>
                  {c.required && <span className="text-xs text-red-400">Required</span>}
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${PROGRESS_STATUS_COLORS[pStatus]}`}>
                    {PROGRESS_STATUS_LABELS[pStatus]}
                  </span>
                </div>
                {c.target_value && <span className="text-sm text-gray-400">Target: {c.target_value}</span>}
              </div>
              {c.description && <p className="text-sm text-gray-400 mb-2">{c.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span>{CRITERIA_TYPE_LABELS[c.criteria_type as keyof typeof CRITERIA_TYPE_LABELS]}</span>
                <span>{TRACKING_SOURCE_LABELS[c.tracking_source as keyof typeof TRACKING_SOURCE_LABELS]}</span>
                {progress?.auto_tracked && <span className="text-blue-400">Auto-tracked</span>}
              </div>

              {/* Client evidence */}
              {progress?.client_evidence && (
                <div className="mb-3 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    <MessageSquare size={12} /> Client evidence ({progress.client_submitted_at ? new Date(progress.client_submitted_at).toLocaleDateString() : ''})
                  </div>
                  <p className="text-sm">{progress.client_evidence}</p>
                  {progress.current_value && <p className="text-sm text-gray-400 mt-1">Current value: {progress.current_value}</p>}
                </div>
              )}

              {/* Admin verification */}
              {progress?.admin_verified_at && (
                <div className="mb-3 p-3 bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Admin verified: {new Date(progress.admin_verified_at).toLocaleDateString()}</div>
                  {progress.admin_notes && <p className="text-sm">{progress.admin_notes}</p>}
                </div>
              )}

              {/* Verify buttons */}
              {!isTerminal && pStatus !== 'met' && pStatus !== 'waived' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(c.id, 'met')}
                    disabled={verifyingId === c.id}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600/20 text-green-300 border border-green-500/50 rounded-lg hover:bg-green-600/30"
                  >
                    <CheckCircle2 size={12} /> Mark Met
                  </button>
                  <button
                    onClick={() => handleVerify(c.id, 'not_met')}
                    disabled={verifyingId === c.id}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-600/30"
                  >
                    <XCircle size={12} /> Not Met
                  </button>
                  <button
                    onClick={() => handleVerify(c.id, 'waived')}
                    disabled={verifyingId === c.id}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-600/20 text-yellow-300 border border-yellow-500/50 rounded-lg hover:bg-yellow-600/30"
                  >
                    <Shield size={12} /> Waive
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolve Payout */}
      {enrollment.status === 'criteria_met' && (
        <div className="p-6 bg-gradient-to-r from-green-900/30 to-amber-900/30 border border-green-500/50 rounded-xl">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <DollarSign size={20} className="text-green-400" />
            All Criteria Met — Resolve Payout
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Campaign payout type: <strong>{enrollment.attraction_campaigns?.payout_type}</strong>. Choose how to resolve:
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => handleResolve('refund')} disabled={resolving} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm">
              Issue Refund
            </button>
            <button onClick={() => handleResolve('credit')} disabled={resolving} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm">
              Issue Credit
            </button>
            <button onClick={() => handleResolve('rollover_upsell')} disabled={resolving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm">
              Rollover to Upsell
            </button>
          </div>
        </div>
      )}

      {enrollment.status === 'payout_pending' && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-xl">
          <p className="text-sm text-yellow-300 flex items-center gap-2">
            <Clock size={16} /> Client has chosen their payout. {enrollment.resolution_notes}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => handleResolve('refund')} disabled={resolving} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm">
              Process Refund
            </button>
            <button onClick={() => handleResolve('credit')} disabled={resolving} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm">
              Process Credit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
