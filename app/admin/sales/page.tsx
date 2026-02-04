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
} from 'lucide-react';

interface DiagnosticAudit {
  id: string;
  session_id: string;
  contact_id: string | null;
  status: string;
  urgency_score: number | null;
  opportunity_score: number | null;
  audit_summary: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  created_at: string;
  contact_submissions: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    created_at: string;
  } | null;
  sales_session: {
    diagnostic_audit_id: string;
    outcome: SessionOutcome;
    next_follow_up: string | null;
    funnel_stage: FunnelStage;
  } | null;
  has_follow_up: boolean;
}

interface DashboardStats {
  total_audits: number;
  pending_follow_up: number;
  converted: number;
  high_urgency: number;
  high_opportunity: number;
}

const OUTCOME_ICONS: Record<SessionOutcome, React.ReactNode> = {
  converted: <CheckCircle className="w-4 h-4 text-green-500" />,
  downsold: <CheckCircle className="w-4 h-4 text-blue-500" />,
  deferred: <Pause className="w-4 h-4 text-yellow-500" />,
  lost: <XCircle className="w-4 h-4 text-red-500" />,
  in_progress: <Clock className="w-4 h-4 text-gray-500" />,
};

const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  converted: 'Converted',
  downsold: 'Downsold',
  deferred: 'Follow-up Needed',
  lost: 'Lost',
  in_progress: 'In Progress',
};

export default function SalesDashboardPage() {
  const { user } = useAuth();
  const [audits, setAudits] = useState<DiagnosticAudit[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
      const params = new URLSearchParams();
      if (minUrgency > 0) params.append('min_urgency', minUrgency.toString());
      
      const response = await fetch(`/api/admin/sales?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      setAudits(data.audits || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [minUrgency, user]);

  // Fetch when user becomes available or filters change
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Filter and sort audits
  const filteredAudits = audits
    .filter(audit => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        audit.contact_submissions?.name?.toLowerCase().includes(query) ||
        audit.contact_submissions?.email?.toLowerCase().includes(query) ||
        audit.contact_submissions?.company?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'urgency':
          return (b.urgency_score || 0) - (a.urgency_score || 0);
        case 'opportunity':
          return (b.opportunity_score || 0) - (a.opportunity_score || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400';
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-black text-white">
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
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-emerald-500" />
              Sales Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Manage leads from diagnostic audits and track sales progress
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/sales/products"
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors"
            >
              <Package className="w-4 h-4" />
              Content
            </Link>
            <Link
              href="/admin/sales/bundles"
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors"
            >
              <Layers className="w-4 h-4" />
              Bundles
            </Link>
            <Link
              href="/admin/sales/scripts"
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Scripts
            </Link>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div className="text-sm text-gray-400">Total Leads</div>
              <div className="text-2xl font-bold text-white">{stats.total_audits}</div>
            </div>
            <div className="bg-orange-500/20 rounded-lg border border-orange-500/50 p-4">
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <Clock className="w-4 h-4 text-orange-500" />
                Pending
              </div>
              <div className="text-2xl font-bold text-orange-400">{stats.pending_follow_up}</div>
            </div>
            <div className="bg-green-500/20 rounded-lg border border-green-500/50 p-4">
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Converted
              </div>
              <div className="text-2xl font-bold text-green-400">{stats.converted}</div>
            </div>
            <div className="bg-red-500/20 rounded-lg border border-red-500/50 p-4">
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                High Urgency
              </div>
              <div className="text-2xl font-bold text-red-400">{stats.high_urgency}</div>
            </div>
            <div className="bg-yellow-500/20 rounded-lg border border-yellow-500/50 p-4">
              <div className="text-sm text-gray-400 flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                High Opportunity
              </div>
              <div className="text-2xl font-bold text-yellow-400">{stats.high_opportunity}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            {/* Min urgency */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={minUrgency}
                onChange={(e) => setMinUrgency(parseInt(e.target.value))}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
            <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400">Loading leads...</p>
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">No leads found</h3>
            <p className="text-gray-400">
              {searchQuery || minUrgency > 0 
                ? 'Try adjusting your filters' 
                : 'Complete some diagnostic audits to see leads here'}
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Contact</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Scores</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Stage</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-white">
                          {audit.contact_submissions?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {audit.contact_submissions?.email}
                        </div>
                        {audit.contact_submissions?.company && (
                          <div className="text-sm text-gray-500">
                            {audit.contact_submissions.company}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Urgency</div>
                          <div className={`font-bold ${getScoreColor(audit.urgency_score)}`}>
                            {audit.urgency_score ?? '-'}/10
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Opportunity</div>
                          <div className={`font-bold ${getScoreColor(audit.opportunity_score)}`}>
                            {audit.opportunity_score ?? '-'}/10
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {audit.sales_session ? (
                        <FunnelStageBadge stage={audit.sales_session.funnel_stage} size="sm" />
                      ) : (
                        <span className="text-gray-500 text-sm">Not started</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {audit.sales_session ? (
                        <div className="flex items-center gap-2">
                          {OUTCOME_ICONS[audit.sales_session.outcome]}
                          <span className="text-sm text-gray-300">
                            {OUTCOME_LABELS[audit.sales_session.outcome]}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium">
                          <Phone className="w-3 h-3" />
                          Needs Follow-up
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-400">
                      {formatDate(audit.created_at)}
                      {audit.sales_session?.next_follow_up && (
                        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Follow-up: {formatDate(audit.sales_session.next_follow_up)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/admin/sales/${audit.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                      >
                        {audit.sales_session ? 'Continue' : 'Start Call'}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
