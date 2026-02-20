'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, CheckCircle2, Circle, Clock, Shield, AlertCircle,
  ChevronDown, ChevronUp, Send,
} from 'lucide-react';
import {
  PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS,
  ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS,
  CAMPAIGN_TYPE_LABELS, calculateOverallProgress, enrollmentDaysRemaining,
} from '@/lib/campaigns';
import type { CampaignType, ProgressStatus } from '@/lib/campaigns';

interface CampaignEnrollmentData {
  id: string;
  campaign_id: string;
  status: string;
  enrolled_at: string;
  deadline_at: string;
  attraction_campaigns: {
    id: string; name: string; slug: string; campaign_type: CampaignType;
    payout_type: string; hero_image_url: string | null;
  };
  enrollment_criteria: Array<{
    id: string; label: string; description: string | null; criteria_type: string;
    tracking_source: string; target_value: string | null; required: boolean; display_order: number;
  }>;
  campaign_progress: Array<{
    id: string; criterion_id: string; status: string; progress_value: number;
    current_value: string | null; auto_tracked: boolean;
    client_evidence: string | null; client_submitted_at: string | null;
  }>;
}

interface Props {
  clientEmail: string;
  authToken?: string;
}

export default function CampaignProgressSection({ clientEmail, authToken }: Props) {
  const [enrollments, setEnrollments] = useState<CampaignEnrollmentData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [evidenceText, setEvidenceText] = useState('');

  useEffect(() => {
    if (!authToken) return;
    fetch('/api/campaigns/my-enrollments', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((data) => {
        setEnrollments(data.data || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [authToken]);

  if (!loaded || enrollments.length === 0) return null;

  const activeEnrollments = enrollments.filter((e) =>
    ['active', 'criteria_met', 'payout_pending'].includes(e.status)
  );

  if (activeEnrollments.length === 0) return null;

  const handleSubmitEvidence = async (enrollmentId: string, criterionId: string) => {
    if (!evidenceText.trim() || !authToken) return;
    setSubmitting(criterionId);
    try {
      const res = await fetch(`/api/campaigns/enrollments/${enrollmentId}/progress/${criterionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ client_evidence: evidenceText }),
      });
      if (res.ok) {
        setEvidenceText('');
        // Refresh
        const refreshRes = await fetch('/api/campaigns/my-enrollments', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setEnrollments(data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to submit evidence:', err);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-amber-500/30 overflow-hidden">
      <div className="p-5 border-b border-gray-800">
        <h3 className="text-sm font-medium text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <Trophy size={16} />
          Campaign Progress
        </h3>
      </div>

      <div className="divide-y divide-gray-800">
        {activeEnrollments.map((enrollment) => {
          const campaign = enrollment.attraction_campaigns;
          const criteria = (enrollment.enrollment_criteria || []).sort((a, b) => a.display_order - b.display_order);
          const progressMap = new Map(
            (enrollment.campaign_progress || []).map((p) => [p.criterion_id, p])
          );
          const overallProgress = calculateOverallProgress(enrollment.campaign_progress || []);
          const daysLeft = enrollmentDaysRemaining(enrollment);
          const isExpanded = expandedId === enrollment.id;

          return (
            <div key={enrollment.id} className="p-5">
              <button
                onClick={() => setExpandedId(isExpanded ? null : enrollment.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield size={20} className="text-amber-400" />
                    <div>
                      <h4 className="font-semibold text-white">{campaign.name}</h4>
                      <span className="text-xs text-gray-500">{CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${ENROLLMENT_STATUS_COLORS[enrollment.status as keyof typeof ENROLLMENT_STATUS_COLORS] || ''}`}>
                      {ENROLLMENT_STATUS_LABELS[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABELS] || enrollment.status}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {daysLeft > 0 ? `${daysLeft} days remaining` : 'Deadline passed'}
                  </span>
                  <span>{overallProgress}% complete</span>
                </div>

                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 space-y-3"
                >
                  {criteria.map((c) => {
                    const progress = progressMap.get(c.id);
                    const pStatus = (progress?.status || 'pending') as ProgressStatus;
                    const StatusIcon = pStatus === 'met' ? CheckCircle2
                      : pStatus === 'in_progress' ? Clock : Circle;

                    return (
                      <div key={c.id} className="pl-4 border-l-2 border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon size={14} className={
                              pStatus === 'met' ? 'text-green-400'
                                : pStatus === 'in_progress' ? 'text-blue-400'
                                  : 'text-gray-500'
                            } />
                            <span className={`text-sm ${pStatus === 'met' ? 'text-green-300 line-through' : 'text-gray-200'}`}>
                              {c.label}
                            </span>
                            {c.required && <span className="text-[10px] text-red-400">Required</span>}
                          </div>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded border ${PROGRESS_STATUS_COLORS[pStatus]}`}>
                            {PROGRESS_STATUS_LABELS[pStatus]}
                          </span>
                        </div>
                        {c.target_value && (
                          <p className="text-xs text-gray-500 ml-6 mt-0.5">Target: {c.target_value}</p>
                        )}
                        {progress?.client_evidence && (
                          <p className="text-xs text-gray-400 ml-6 mt-1 italic">
                            Your evidence: {progress.client_evidence}
                          </p>
                        )}

                        {/* Submit evidence for manual criteria */}
                        {c.tracking_source === 'manual' && pStatus !== 'met' && pStatus !== 'waived' && enrollment.status === 'active' && (
                          <div className="ml-6 mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Describe your progress..."
                              value={submitting === c.id ? '' : evidenceText}
                              onChange={(e) => setEvidenceText(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                              onFocus={() => setEvidenceText('')}
                            />
                            <button
                              onClick={() => handleSubmitEvidence(enrollment.id, c.id)}
                              disabled={submitting === c.id || !evidenceText.trim()}
                              className="p-1 text-amber-400 hover:text-amber-300 disabled:opacity-50"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        )}
                        {progress?.auto_tracked && (
                          <p className="text-[10px] text-blue-400 ml-6 mt-0.5">Auto-tracked</p>
                        )}
                      </div>
                    );
                  })}

                  {enrollment.status === 'criteria_met' && (
                    <div className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
                      <p className="text-sm text-green-300 flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        All criteria met! Choose your reward in the dashboard or contact your consultant.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
