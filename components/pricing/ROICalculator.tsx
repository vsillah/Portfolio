'use client';

import { useState, useCallback } from 'react';
import { formatCurrency } from '@/lib/pricing-model';

interface ROICalculatorProps {
  className?: string;
}

const INDUSTRIES = [
  { value: 'technology', label: 'Technology', hourlyRate: 55, dealSize: 8000, employeeCost: 85000 },
  { value: 'professional_services', label: 'Professional Services', hourlyRate: 65, dealSize: 10000, employeeCost: 75000 },
  { value: 'healthcare', label: 'Healthcare', hourlyRate: 50, dealSize: 6000, employeeCost: 65000 },
  { value: 'financial_services', label: 'Financial Services', hourlyRate: 70, dealSize: 15000, employeeCost: 90000 },
  { value: 'retail', label: 'Retail / E-Commerce', hourlyRate: 35, dealSize: 3000, employeeCost: 45000 },
  { value: 'manufacturing', label: 'Manufacturing', hourlyRate: 40, dealSize: 12000, employeeCost: 55000 },
  { value: 'real_estate', label: 'Real Estate', hourlyRate: 45, dealSize: 8000, employeeCost: 60000 },
  { value: 'education', label: 'Education', hourlyRate: 35, dealSize: 4000, employeeCost: 50000 },
  { value: 'other', label: 'Other', hourlyRate: 40, dealSize: 5000, employeeCost: 60000 },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees', hoursWasted: 10, missedLeads: 30, fteRedirect: 0.1, savingsRate: 0.40 },
  { value: '11-50', label: '11-50 employees', hoursWasted: 25, missedLeads: 75, fteRedirect: 0.3, savingsRate: 0.50 },
  { value: '51-200', label: '51-200 employees', hoursWasted: 60, missedLeads: 150, fteRedirect: 0.8, savingsRate: 0.55 },
  { value: '201-1000', label: '201-1000 employees', hoursWasted: 120, missedLeads: 300, fteRedirect: 2.0, savingsRate: 0.60 },
];

export function ROICalculator({ className = '' }: ROICalculatorProps) {
  const [industry, setIndustry] = useState('technology');
  const [size, setSize] = useState('11-50');
  const [showResults, setShowResults] = useState(false);

  const getResults = useCallback(() => {
    const ind = INDUSTRIES.find(i => i.value === industry) || INDUSTRIES[0];
    const sz = COMPANY_SIZES.find(s => s.value === size) || COMPANY_SIZES[1];

    const manualProcessWaste = sz.hoursWasted * ind.hourlyRate * 52;
    const missedLeadValue = sz.missedLeads * ind.dealSize * 0.20;
    const redirectedLabor = sz.fteRedirect * ind.employeeCost;
    const totalWaste = manualProcessWaste + missedLeadValue + redirectedLabor;
    const potentialSavings = Math.round(totalWaste * sz.savingsRate);

    // Recommend investment level based on company size
    const investmentMap: Record<string, number> = {
      '1-10': 7497,
      '11-50': 14997,
      '51-200': 29997,
      '201-1000': 29997,
    };
    const investment = investmentMap[size] || 14997;
    const roiMultiple = Math.round((potentialSavings / investment) * 10) / 10;
    const paybackMonths = Math.round((investment / (potentialSavings / 12)) * 10) / 10;

    return {
      totalWaste: Math.round(totalWaste),
      breakdown: {
        manualProcess: Math.round(manualProcessWaste),
        missedLeads: Math.round(missedLeadValue),
        redirectedLabor: Math.round(redirectedLabor),
      },
      potentialSavings,
      investment,
      roiMultiple,
      paybackMonths: Math.min(paybackMonths, 24), // cap display at 24
    };
  }, [industry, size]);

  const results = showResults ? getResults() : null;

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        Free ROI Calculator
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        See how much AI automation could save your business annually.
      </p>

      <div className="mt-6 space-y-4">
        {/* Industry Select */}
        <div>
          <label htmlFor="roi-industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Your Industry
          </label>
          <select
            id="roi-industry"
            value={industry}
            onChange={e => { setIndustry(e.target.value); setShowResults(false); }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {INDUSTRIES.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>

        {/* Company Size Select */}
        <div>
          <label htmlFor="roi-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Company Size
          </label>
          <select
            id="roi-size"
            value={size}
            onChange={e => { setSize(e.target.value); setShowResults(false); }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {COMPANY_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Calculate Button */}
        <button
          onClick={() => setShowResults(true)}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Calculate My ROI
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="mt-6 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          {/* Annual Waste */}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Estimated Annual Waste
            </p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(results.totalWaste)}
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p>Manual processes: {formatCurrency(results.breakdown.manualProcess)}</p>
              <p>Missed opportunities: {formatCurrency(results.breakdown.missedLeads)}</p>
              <p>Redirectable labor: {formatCurrency(results.breakdown.redirectedLabor)}</p>
            </div>
          </div>

          {/* Potential Savings */}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Potential Annual Savings with AI
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(results.potentialSavings)}
            </p>
          </div>

          {/* ROI Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{results.roiMultiple}x</p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70">First Year ROI</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{results.paybackMonths} mo</p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70">Payback Period</p>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Estimates based on industry benchmarks. Actual results depend on your specific situation.{' '}
            <a href="#contact" className="text-blue-500 underline hover:text-blue-600">
              Schedule a free AI audit
            </a>{' '}
            for personalized projections.
          </p>
        </div>
      )}
    </div>
  );
}
