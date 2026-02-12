'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  XCircle,
  MinusCircle,
  Clock,
  User,
  Shield,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MILESTONE_STATUS_LABELS } from '@/lib/guarantees';
import type { GuaranteeMilestone, MilestoneStatus } from '@/lib/guarantees';

interface MilestoneTrackerProps {
  milestones: GuaranteeMilestone[];
  instanceId: string;
  isAdmin?: boolean;
  onVerify?: (conditionId: string, status: MilestoneStatus, notes?: string) => Promise<void>;
  onClientSubmit?: (conditionId: string, evidence: string) => Promise<void>;
}

const STATUS_ICONS: Record<MilestoneStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  met: CheckCircle2,
  not_met: XCircle,
  waived: MinusCircle,
};

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: 'text-gray-400',
  met: 'text-green-400',
  not_met: 'text-red-400',
  waived: 'text-yellow-400',
};

export default function MilestoneTracker({
  milestones,
  instanceId,
  isAdmin = false,
  onVerify,
  onClientSubmit,
}: MilestoneTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [clientEvidence, setClientEvidence] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const totalConditions = milestones.length;
  const metCount = milestones.filter(m => m.status === 'met' || m.status === 'waived').length;
  const progressPercent = totalConditions > 0 ? Math.round((metCount / totalConditions) * 100) : 0;

  const handleVerify = async (conditionId: string, status: MilestoneStatus) => {
    if (!onVerify) return;
    setProcessing(conditionId);
    try {
      await onVerify(conditionId, status, verifyNotes);
      setVerifyNotes('');
      setExpandedId(null);
    } finally {
      setProcessing(null);
    }
  };

  const handleClientSubmit = async (conditionId: string) => {
    if (!onClientSubmit) return;
    setProcessing(conditionId);
    try {
      await onClientSubmit(conditionId, clientEvidence);
      setClientEvidence('');
      setExpandedId(null);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300 font-medium">
            {metCount} of {totalConditions} conditions met
          </span>
          <span className="text-gray-400">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestone list */}
      <div className="space-y-2">
        {milestones.map((milestone) => {
          const StatusIcon = STATUS_ICONS[milestone.status];
          const isExpanded = expandedId === milestone.condition_id;
          const isProcessing = processing === milestone.condition_id;

          return (
            <div
              key={milestone.id}
              className="border border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Milestone header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : milestone.condition_id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors text-left"
              >
                <StatusIcon className={`w-5 h-5 flex-shrink-0 ${STATUS_COLORS[milestone.status]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{milestone.condition_label}</p>
                  <p className="text-xs text-gray-500">
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                    {milestone.verified_at && ` — Verified ${new Date(milestone.verified_at).toLocaleDateString()}`}
                    {milestone.client_submitted_at && ` — Evidence submitted ${new Date(milestone.client_submitted_at).toLocaleDateString()}`}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
                  {/* Client evidence */}
                  {milestone.client_evidence && (
                    <div className="mt-3 p-2 bg-gray-800/50 rounded text-sm">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                        <FileText className="w-3 h-3" />
                        Client Evidence
                      </div>
                      <p className="text-gray-300">{milestone.client_evidence}</p>
                    </div>
                  )}

                  {/* Admin notes */}
                  {milestone.admin_notes && (
                    <div className="p-2 bg-gray-800/50 rounded text-sm">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                        <Shield className="w-3 h-3" />
                        Admin Notes
                      </div>
                      <p className="text-gray-300">{milestone.admin_notes}</p>
                    </div>
                  )}

                  {/* Admin verify actions */}
                  {isAdmin && milestone.status === 'pending' && onVerify && (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={verifyNotes}
                        onChange={(e) => setVerifyNotes(e.target.value)}
                        placeholder="Admin notes (optional)..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerify(milestone.condition_id, 'met')}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Met
                        </button>
                        <button
                          onClick={() => handleVerify(milestone.condition_id, 'not_met')}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                        >
                          <XCircle className="w-3 h-3" />
                          Mark Not Met
                        </button>
                        <button
                          onClick={() => handleVerify(milestone.condition_id, 'waived')}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                        >
                          <MinusCircle className="w-3 h-3" />
                          Waive
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Client self-report action */}
                  {!isAdmin && milestone.status === 'pending' && onClientSubmit && (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={clientEvidence}
                        onChange={(e) => setClientEvidence(e.target.value)}
                        placeholder="Describe how you've met this condition..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                      <button
                        onClick={() => handleClientSubmit(milestone.condition_id)}
                        disabled={isProcessing || !clientEvidence.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                      >
                        <FileText className="w-3 h-3" />
                        Submit Evidence
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
