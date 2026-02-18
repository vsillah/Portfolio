'use client';

import { useState, useEffect } from 'react';
import { FileText, XCircle, Loader2 } from 'lucide-react';
import { getCurrentSession } from '@/lib/auth';
import { formatCurrency } from '@/lib/pricing-model';

export interface ProposalModalProps {
  onClose: () => void;
  onGenerate: (data: {
    clientName: string;
    clientEmail: string;
    clientCompany?: string;
    discountAmount?: number;
    discountDescription?: string;
    validDays: number;
    valueReportId?: string;
  }) => Promise<void>;
  defaultClientName: string;
  defaultClientEmail: string;
  defaultClientCompany: string;
  totalAmount: number;
  contactId: number | null;
  defaultValueReportId: string | null;
}

export function ProposalModal({
  onClose,
  onGenerate,
  defaultClientName,
  defaultClientEmail,
  defaultClientCompany,
  totalAmount,
  contactId,
  defaultValueReportId,
}: ProposalModalProps) {
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [clientCompany, setClientCompany] = useState(defaultClientCompany);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountDescription, setDiscountDescription] = useState('');
  const [validDays, setValidDays] = useState(30);
  const [valueReportId, setValueReportId] = useState<string | null>(defaultValueReportId);
  const [reports, setReports] = useState<Array<{ id: string; title: string | null; total_annual_value: number | null; created_at: string }>>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setReports([]);
      setValueReportId(defaultValueReportId);
      return;
    }
    let cancelled = false;
    setReportsLoading(true);
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return;
      fetch(`/api/admin/value-evidence/reports?contact_id=${contactId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const list = data.reports || [];
          setReports(list);
          setValueReportId((prev) => prev || defaultValueReportId || list[0]?.id || null);
        })
        .finally(() => {
          if (!cancelled) setReportsLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [contactId, defaultValueReportId]);

  useEffect(() => {
    if (defaultValueReportId) setValueReportId(defaultValueReportId);
  }, [defaultValueReportId]);

  const handleGenerate = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      setError('Client name and email are required');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await onGenerate({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientCompany: clientCompany.trim() || undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountDescription: discountDescription.trim() || undefined,
        validDays,
        valueReportId: valueReportId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  const finalAmount = totalAmount - (discountAmount || 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Generate Proposal
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-200">{error}</div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Client Information</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Company</label>
                <input
                  type="text"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  placeholder="Company Inc."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Pricing</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Offer Total</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discount Amount ($)</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  min={0}
                  step={0.01}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              {discountAmount > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Discount Reason</label>
                  <input
                    type="text"
                    value={discountDescription}
                    onChange={(e) => setDiscountDescription(e.target.value)}
                    placeholder="e.g., Early bird, Referral, Loyalty"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
                <span className="text-blue-300 font-medium">Final Amount</span>
                <span className="text-xl font-bold text-blue-400">{formatCurrency(finalAmount)}</span>
              </div>
            </div>
          </div>

          {contactId != null && (
            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Value Report</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Attach value assessment to proposal</label>
                <select
                  value={valueReportId ?? ''}
                  onChange={(e) => setValueReportId(e.target.value || null)}
                  disabled={reportsLoading}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50"
                >
                  <option value="">None</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title ?? 'Report'} {r.total_annual_value != null ? `· $${r.total_annual_value}` : ''} ·{' '}
                      {new Date(r.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Validity</h4>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valid for (days)</label>
              <select
                value={validDays}
                onChange={(e) => setValidDays(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !clientName.trim() || !clientEmail.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generate Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
