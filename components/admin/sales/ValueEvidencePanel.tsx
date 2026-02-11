'use client';

import { useState, useCallback, useEffect } from 'react';
import { DollarSign, ChevronUp, ChevronDown, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import { getCurrentSession } from '@/lib/auth';

export interface ValueEvidencePanelProps {
  contactId: number | null;
  industry: string | null;
  companySize: string | null;
  companyName: string | null;
  onReportGenerated?: (reportId: string) => void;
}

export function ValueEvidencePanel({
  contactId,
  industry,
  companySize,
  companyName,
  onReportGenerated,
}: ValueEvidencePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculations, setCalculations] = useState<Array<{
    id: string;
    annual_value: number | string;
    confidence_level?: string;
    calculation_method?: string;
    pain_point_categories?: { display_name: string | null };
  }>>([]);
  const [generating, setGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState<string | null>(null);

  const fetchCalculations = useCallback(async () => {
    if (!industry) return;
    setLoading(true);
    try {
      const session = await getCurrentSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams();
      if (industry) params.set('industry', industry);
      if (companySize) params.set('company_size', companySize);

      const res = await fetch(`/api/admin/value-evidence/calculations?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCalculations(data.calculations || []);
      }
    } catch (error) {
      console.error('Value evidence fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [industry, companySize]);

  useEffect(() => {
    if (isExpanded && calculations.length === 0) {
      fetchCalculations();
    }
  }, [isExpanded, fetchCalculations, calculations.length]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const session = await getCurrentSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/value-evidence/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contact_submission_id: contactId,
          industry,
          company_size: companySize,
          company_name: companyName,
          report_type: 'client_facing',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reportId = data.report?.id;
        setReportGenerated(reportId || 'generated');
        if (reportId) onReportGenerated?.(reportId);
      }
    } catch (error) {
      console.error('Report generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const totalValue = calculations.reduce(
    (sum: number, c) => sum + (parseFloat(String(c.annual_value)) || 0),
    0
  );
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="bg-gray-900 rounded-lg border border-green-800/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          <h3 className="font-medium text-white text-sm">Value Evidence</h3>
          {calculations.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-300 rounded-full">
              {formatCurrency(totalValue)}/yr
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : calculations.length > 0 ? (
            <>
              {calculations.slice(0, 5).map((calc) => (
                <div key={calc.id} className="p-2 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-300">
                      {calc.pain_point_categories?.display_name || 'Unknown'}
                    </span>
                    <span className="text-xs font-bold text-green-400">
                      {formatCurrency(parseFloat(String(calc.annual_value)))}/yr
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        calc.confidence_level === 'high'
                          ? 'bg-green-900/50 text-green-400'
                          : calc.confidence_level === 'medium'
                            ? 'bg-yellow-900/50 text-yellow-400'
                            : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {calc.confidence_level}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {calc.calculation_method?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}

              {calculations.length > 5 && (
                <p className="text-xs text-gray-500 text-center">+{calculations.length - 5} more calculations</p>
              )}

              <div className="p-2 bg-green-900/20 border border-green-800/50 rounded-lg text-center">
                <div className="text-xs text-gray-400">Cost of Doing Nothing</div>
                <div className="text-lg font-bold text-green-400">{formatCurrency(totalValue)}/yr</div>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={generating || !!reportGenerated}
                className="w-full px-3 py-2 text-xs bg-green-600/20 border border-green-500/50 rounded-lg text-green-300 hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" /> Generating...
                  </>
                ) : reportGenerated ? (
                  <>
                    <CheckCircle className="w-3 h-3" /> Report Generated
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3" /> Generate Client Report
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="text-xs text-gray-500">
                {industry ? 'No calculations for this industry yet.' : 'Industry not detected.'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                Generate calculations in the Value Evidence admin page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
