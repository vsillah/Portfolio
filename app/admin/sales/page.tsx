'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { 
  FunnelStage,
  SessionOutcome,
  FUNNEL_STAGE_LABELS,
} from '@/lib/sales-scripts';
import { FunnelStageBadge } from '@/components/admin/sales/FunnelStageSelector';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import ReportActionToast from '@/components/admin/ReportActionToast';
import { 
  Users, 
  TrendingUp, 
  Calendar,
  Package,
  FileText,
  Layers,
  ArrowRight,
  Phone,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  RefreshCw,
  Filter,
  Search,
  Star,
  ArrowUpRight,
  Trash2,
  Zap,
  Presentation,
} from 'lucide-react';

interface LeadAudit {
  id: string;
  urgency_score: number | null;
  opportunity_score: number | null;
  created_at: string;
}

interface LeadSession {
  id: string;
  outcome: string;
  funnel_stage: string;
  next_follow_up: string | null;
  created_at: string;
  diagnostic_audit_id: string | null;
}

interface LeadRow {
  contact_id: number;
  name: string | null;
  email: string | null;
  company: string | null;
  has_diagnostic_audit: boolean;
  has_conversation: boolean;
  audit: LeadAudit | null;
  session: LeadSession | null;
}

interface DashboardStats {
  total_leads: number;
  pending_follow_up: number;
  converted: number;
  high_urgency: number;
  high_opportunity: number;
}

const OUTCOME_ICONS: Record<SessionOutcome, React.ReactNode> = {
  converted: <CheckCircle className="w-4 h-4 text-green-500" />,
  downsold: <CheckCircle className="w-4 h-4 text-radiant-gold" />,
  deferred: <Pause className="w-4 h-4 text-yellow-500" />,
  lost: <XCircle className="w-4 h-4 text-red-500" />,
  in_progress: <Clock className="w-4 h-4 text-platinum-white/60" />,
};

const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  converted: 'Converted',
  downsold: 'Downsold',
  deferred: 'Follow-up Needed',
  lost: 'Lost',
  in_progress: 'In Progress',
};

interface ConversationSession {
  id: string;
  contact_submission_id: number | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  funnel_stage: FunnelStage;
  outcome: SessionOutcome;
  next_follow_up: string | null;
  created_at: string;
  diagnostic_audit_id: string | null;
}

interface ReportStatus {
  reportId: string;
  totalAnnualValue: number;
  reportType: string;
  gammaReportId?: string;
  gammaUrl?: string;
}

interface ToastData {
  contactName: string;
  company?: string;
  totalAnnualValue: number;
  reportId: string;
  contactId: number;
}

export default function SalesDashboardPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [conversationSessions, setConversationSessions] = useState<ConversationSession[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [reportStatuses, setReportStatuses] = useState<Record<string, ReportStatus | null>>({});
  const [generatingReportFor, setGeneratingReportFor] = useState<number | null>(null);
  const [toastData, setToastData] = useState<ToastData | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minUrgency, setMinUrgency] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'urgency' | 'opportunity'>('date');

  const fetchData = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const params = new URLSearchParams();
      if (minUrgency > 0) params.append('min_urgency', minUrgency.toString());
      
      const [auditsResponse, sessionsResponse] = await Promise.all([
        fetch(`/api/admin/sales?${params}`, { headers }),
        fetch('/api/admin/sales/sessions', { headers }),
      ]);
      if (!auditsResponse.ok) throw new Error('Failed to fetch data');
      
      const data = await auditsResponse.json();
      setLeads(data.leads || []);
      setStats(data.stats || null);

      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        // Only show sessions that don't have a diagnostic audit (conversation-only)
        const convOnly = (sessionsData.sessions || []).filter(
          (s: ConversationSession) => !s.diagnostic_audit_id
        );
        setConversationSessions(convOnly);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [minUrgency]);

  // Fetch report statuses whenever leads are loaded
  const fetchReportStatuses = useCallback(async (leadRows: LeadRow[]) => {
    const ids = leadRows.map(l => l.contact_id).filter(Boolean);
    if (ids.length === 0) return;

    try {
      const session = await getCurrentSession();
      if (!session?.access_token) return;

      const res = await fetch(
        `/api/admin/value-evidence/reports/status?contactIds=${ids.join(',')}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setReportStatuses(data.statuses || {});
      }
    } catch {
      // Non-critical — statuses just won't show
    }
  }, []);

  // Fetch when user becomes available or filters change
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Fetch report statuses after leads load
  useEffect(() => {
    if (leads.length > 0) {
      fetchReportStatuses(leads);
    }
  }, [leads, fetchReportStatuses]);

  const handleGenerateReport = async (contactId: number, name: string, company?: string) => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setGeneratingReportFor(contactId);
    try {
      const res = await fetch('/api/admin/value-evidence/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contact_submission_id: contactId,
          report_type: 'client_facing',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate report');
      }

      const data = await res.json();
      const report = data.report;

      setToastData({
        contactName: name || 'Unknown',
        company: company || undefined,
        totalAnnualValue: report.totalAnnualValue ?? 0,
        reportId: report.id,
        contactId,
      });

      // Refresh report statuses
      await fetchReportStatuses(leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReportFor(null);
    }
  };

  // Filter and sort leads
  const filteredLeads = leads
    .filter(lead => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.company?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aDate = a.audit?.created_at ?? a.session?.created_at ?? '';
      const bDate = b.audit?.created_at ?? b.session?.created_at ?? '';
      switch (sortBy) {
        case 'urgency':
          return (b.audit?.urgency_score ?? 0) - (a.audit?.urgency_score ?? 0);
        case 'opportunity':
          return (b.audit?.opportunity_score ?? 0) - (a.audit?.opportunity_score ?? 0);
        default:
          return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
    });

  // Active Conversations: apply same search filter as table so header count matches visible rows
  const filteredConversationSessions = conversationSessions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.client_name?.toLowerCase().includes(q) ||
      s.client_email?.toLowerCase().includes(q) ||
      s.client_company?.toLowerCase().includes(q)
    );
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDeleteConversation = async (sessionId: string) => {
    if (!confirm('Remove this conversation from the list? This cannot be undone.')) return;
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    setDeletingSessionId(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sales/sessions?id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove conversation');
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove conversation');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-platinum-white/80';
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales Dashboard' },
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-emerald-500" />
              Sales Dashboard
            </h1>
            <p className="text-platinum-white/80 mt-1">
              Manage leads from diagnostic audits and conversations; track steps and progress
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/sales/products"
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <Package className="w-4 h-4" />
              Content
            </Link>
            <Link
              href="/admin/sales/bundles"
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <Layers className="w-4 h-4" />
              Bundles
            </Link>
            <Link
              href="/admin/sales/scripts"
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              Scripts
            </Link>
            <Link
              href="/admin/sales/upsell-paths"
              className="flex items-center gap-2 px-4 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-foreground hover:border-radiant-gold/50 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Upsell Paths
            </Link>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 btn-gold text-imperial-navy rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-silicon-slate/50 rounded-lg border border-silicon-slate p-4">
              <div className="text-sm text-platinum-white/80">Total Leads</div>
              <div className="text-2xl font-bold text-foreground">{stats.total_leads}</div>
            </div>
            <div className="bg-radiant-gold/20 rounded-lg border border-radiant-gold/50 p-4">
              <div className="text-sm text-platinum-white/80 flex items-center gap-1">
                <Clock className="w-4 h-4 text-radiant-gold" />
                Pending
              </div>
              <div className="text-2xl font-bold text-radiant-gold">{stats.pending_follow_up}</div>
            </div>
            <div className="bg-emerald-500/20 rounded-lg border border-emerald-500/50 p-4">
              <div className="text-sm text-platinum-white/80 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Converted
              </div>
              <div className="text-2xl font-bold text-emerald-400">{stats.converted}</div>
            </div>
            <div className="bg-red-500/20 rounded-lg border border-red-500/50 p-4">
              <div className="text-sm text-platinum-white/80 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                High Urgency
              </div>
              <div className="text-2xl font-bold text-red-400">{stats.high_urgency}</div>
            </div>
            <div className="bg-amber-500/20 rounded-lg border border-amber-500/50 p-4">
              <div className="text-sm text-platinum-white/80 flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400" />
                High Opportunity
              </div>
              <div className="text-2xl font-bold text-amber-400">{stats.high_opportunity}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-silicon-slate/50 rounded-lg border border-silicon-slate p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-platinum-white/60" />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-silicon-slate border border-silicon-slate rounded-lg text-foreground placeholder-platinum-white/60"
              />
            </div>

            {/* Min urgency */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-platinum-white/60" />
              <select
                value={minUrgency}
                onChange={(e) => setMinUrgency(parseInt(e.target.value))}
                className="px-3 py-2 bg-silicon-slate border border-silicon-slate rounded-lg text-foreground"
              >
                <option value={0}>All Urgency Levels</option>
                <option value={7}>High Urgency (7+)</option>
                <option value={5}>Medium+ (5+)</option>
                <option value={3}>Low+ (3+)</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'urgency' | 'opportunity')}
              className="px-3 py-2 bg-silicon-slate border border-silicon-slate rounded-lg text-foreground"
            >
              <option value="date">Sort by Date</option>
              <option value="urgency">Sort by Urgency</option>
              <option value="opportunity">Sort by Opportunity</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-lg border border-red-500/50 mb-6">
            {error}
          </div>
        )}

        {/* Leads list */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-platinum-white/60 animate-spin mx-auto mb-3" />
            <p className="text-platinum-white/80">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 bg-silicon-slate/50 rounded-lg border border-silicon-slate">
            <Users className="w-12 h-12 text-platinum-white/60 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No leads found</h3>
            <p className="text-platinum-white/80">
              {searchQuery || minUrgency > 0
                ? 'Try adjusting your filters'
                : 'Complete diagnostic audits or start conversations from Outreach to see leads here'}
            </p>
          </div>
        ) : (
          <div className="bg-silicon-slate/50 rounded-lg border border-silicon-slate overflow-hidden">
            <table className="w-full">
              <thead className="bg-silicon-slate border-b border-silicon-slate">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Contact</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Steps completed</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Scores</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Stage</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Date</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-platinum-white/80">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLeads.map((lead) => {
                  const primaryDate = lead.audit?.created_at ?? lead.session?.created_at ?? '';
                  return (
                    <tr key={lead.contact_id} className="hover:bg-silicon-slate/50">
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-2">
                            <Link href={`/admin/contacts/${lead.contact_id}`} className="hover:text-teal-400 transition-colors">{lead.name || 'Unknown'}</Link>
                            {(() => {
                              const status = reportStatuses[String(lead.contact_id)];
                              if (!status) return null;
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Value report generated" />
                                  {status.gammaUrl && (
                                    <span className="w-2 h-2 rounded-full bg-purple-400" title="Gamma deck ready" />
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-sm text-platinum-white/80">{lead.email}</div>
                          {lead.company && (
                            <div className="text-sm text-platinum-white/60">{lead.company}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 text-sm">
                          <span className={lead.has_diagnostic_audit ? 'text-emerald-400' : 'text-platinum-white/50'}>
                            {lead.has_diagnostic_audit ? (
                              <span className="inline-flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                Diagnostic audit
                              </span>
                            ) : (
                              '— Diagnostic audit'
                            )}
                          </span>
                          <span className={lead.has_conversation ? 'text-emerald-400' : 'text-platinum-white/50'}>
                            {lead.has_conversation ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                Conversation
                              </span>
                            ) : (
                              '— Conversation'
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {lead.audit ? (
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-xs text-platinum-white/60">Urgency</div>
                              <div className={`font-bold ${getScoreColor(lead.audit.urgency_score)}`}>
                                {lead.audit.urgency_score ?? '-'}/10
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-platinum-white/60">Opportunity</div>
                              <div className={`font-bold ${getScoreColor(lead.audit.opportunity_score)}`}>
                                {lead.audit.opportunity_score ?? '-'}/10
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-platinum-white/50 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {lead.session ? (
                          <FunnelStageBadge stage={lead.session.funnel_stage as FunnelStage} size="sm" />
                        ) : (
                          <span className="text-platinum-white/60 text-sm">Not started</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {lead.session ? (
                          <div className="flex items-center gap-2">
                            {OUTCOME_ICONS[lead.session.outcome as SessionOutcome]}
                            <span className="text-sm text-platinum-white">
                              {OUTCOME_LABELS[lead.session.outcome as SessionOutcome]}
                            </span>
                          </div>
                        ) : lead.audit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-radiant-gold/20 text-radiant-gold rounded-full text-xs font-medium">
                            <Phone className="w-3 h-3" />
                            Needs Follow-up
                          </span>
                        ) : (
                          <span className="text-platinum-white/60 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-platinum-white/80">
                        {primaryDate ? formatDate(primaryDate) : '—'}
                        {lead.session?.next_follow_up && (
                          <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {formatDate(lead.session.next_follow_up)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(() => {
                            const status = reportStatuses[String(lead.contact_id)];
                            if (status) {
                              return (
                                <Link
                                  href={`/admin/value-evidence/reports/${status.reportId}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                                  title="View value report"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Report ✓
                                </Link>
                              );
                            }
                            return (
                              <button
                                onClick={() =>
                                  handleGenerateReport(
                                    lead.contact_id,
                                    lead.name || 'Unknown',
                                    lead.company || undefined
                                  )
                                }
                                disabled={generatingReportFor === lead.contact_id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {generatingReportFor === lead.contact_id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5" />
                                )}
                                {generatingReportFor === lead.contact_id
                                  ? 'Generating...'
                                  : 'Generate Report'}
                              </button>
                            );
                          })()}
                          <Link
                            href={`/admin/outreach?tab=leads&id=${lead.contact_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-900/30 hover:bg-purple-800/50 text-purple-400 rounded-lg text-sm transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            View Lead
                          </Link>
                          {lead.session ? (
                            <Link
                              href={`/admin/sales/conversation/${lead.session.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-foreground rounded-lg text-sm hover:bg-emerald-700"
                            >
                              Continue
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          ) : lead.audit ? (
                            <Link
                              href={`/admin/sales/${lead.audit.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-foreground rounded-lg text-sm hover:bg-emerald-700"
                            >
                              Start Call
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Active Conversations (no diagnostic audit) */}
        {conversationSessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-purple-500" />
              Active Conversations
              <span className="text-sm font-normal text-platinum-white/80">({filteredConversationSessions.length})</span>
            </h2>
            <div className="bg-silicon-slate/50 rounded-lg border border-silicon-slate overflow-hidden">
              <table className="w-full">
                <thead className="bg-silicon-slate border-b border-silicon-slate">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Contact</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Stage</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-platinum-white/80">Date</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-platinum-white/80">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredConversationSessions.map(s => (
                    <tr key={s.id} className="hover:bg-silicon-slate/50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-foreground">{s.client_name || 'Unknown'}</div>
                        <div className="text-sm text-platinum-white/80">{s.client_email}</div>
                        {s.client_company && <div className="text-sm text-platinum-white/60">{s.client_company}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <FunnelStageBadge stage={s.funnel_stage} size="sm" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {OUTCOME_ICONS[s.outcome]}
                          <span className="text-sm text-platinum-white">{OUTCOME_LABELS[s.outcome]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-platinum-white/80">
                        {formatDate(s.created_at)}
                        {s.next_follow_up && (
                          <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {formatDate(s.next_follow_up)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/sales/conversation/${s.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-foreground rounded-lg text-sm hover:bg-emerald-700"
                          >
                            Continue <ArrowRight className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteConversation(s.id)}
                            disabled={deletingSessionId === s.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-900/50 text-red-400 rounded-lg text-sm hover:bg-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove conversation"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Report Action Toast */}
      {toastData && (
        <ReportActionToast
          contactName={toastData.contactName}
          company={toastData.company}
          totalAnnualValue={toastData.totalAnnualValue}
          reportId={toastData.reportId}
          contactId={toastData.contactId}
          onDismiss={() => setToastData(null)}
        />
      )}
    </div>
  );
}
