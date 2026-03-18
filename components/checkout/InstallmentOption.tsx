'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Calendar, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

interface InstallmentOptionProps {
  baseAmount: number;
  defaultInstallments?: number;
  minInstallments?: number;
  maxInstallments?: number;
  onSelect: (mode: 'full' | 'installments', numInstallments?: number) => void;
  selectedMode: 'full' | 'installments';
}

interface InstallmentCalc {
  feePercent: number;
  feeAmount: number;
  totalWithFee: number;
  installmentAmount: number;
}

function calculateLocal(baseAmount: number, numInstallments: number, feePercent: number): InstallmentCalc {
  const feeAmount = Math.round(baseAmount * (feePercent / 100) * 100) / 100;
  const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
  const installmentAmount = Math.floor((totalWithFee / numInstallments) * 100) / 100;
  return { feePercent, feeAmount, totalWithFee, installmentAmount };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount);

export default function InstallmentOption({
  baseAmount,
  defaultInstallments = 3,
  minInstallments = 2,
  maxInstallments = 12,
  onSelect,
  selectedMode,
}: InstallmentOptionProps) {
  const [numInstallments, setNumInstallments] = useState(defaultInstallments);
  const [feePercent, setFeePercent] = useState<number>(10);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    fetch('/api/installments/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.feePercent != null) setFeePercent(data.feePercent);
      })
      .catch(() => {});
  }, []);

  const calc = calculateLocal(baseAmount, numInstallments, feePercent);

  const handleInstallmentCountChange = useCallback(
    (count: number) => {
      const clamped = Math.max(minInstallments, Math.min(maxInstallments, count));
      setNumInstallments(clamped);
      if (selectedMode === 'installments') {
        onSelect('installments', clamped);
      }
    },
    [minInstallments, maxInstallments, selectedMode, onSelect]
  );

  const schedule = Array.from({ length: numInstallments }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const isLast = i === numInstallments - 1;
    const lastAmount = Math.round((calc.totalWithFee - calc.installmentAmount * (numInstallments - 1)) * 100) / 100;
    return {
      number: i + 1,
      date,
      amount: isLast ? lastAmount : calc.installmentAmount,
    };
  });

  return (
    <div className="space-y-3">
      {/* Pay in Full option */}
      <button
        type="button"
        onClick={() => onSelect('full')}
        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
          selectedMode === 'full'
            ? 'border-green-500 bg-green-900/20 ring-1 ring-green-500/30'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }`}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selectedMode === 'full' ? 'border-green-500' : 'border-gray-600'
        }`}>
          {selectedMode === 'full' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-white">Pay in Full</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">One-time payment of {formatCurrency(baseAmount)}</p>
        </div>
        <span className="text-lg font-bold text-white">{formatCurrency(baseAmount)}</span>
      </button>

      {/* Installments option */}
      <div
        className={`rounded-xl border transition-all ${
          selectedMode === 'installments'
            ? 'border-blue-500 bg-blue-900/20 ring-1 ring-blue-500/30'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect('installments', numInstallments)}
          className="w-full flex items-center gap-4 p-4 text-left"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selectedMode === 'installments' ? 'border-blue-500' : 'border-gray-600'
          }`}>
            {selectedMode === 'installments' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-white">Pay in Installments</span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              {numInstallments} monthly payments of {formatCurrency(calc.installmentAmount)}
            </p>
          </div>
          <span className="text-lg font-bold text-white">{formatCurrency(calc.totalWithFee)}</span>
        </button>

        {selectedMode === 'installments' && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-3 ml-9">
            {/* Installment count selector */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Number of Payments</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={minInstallments}
                  max={maxInstallments}
                  value={numInstallments}
                  onChange={(e) => handleInstallmentCountChange(parseInt(e.target.value, 10))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-sm font-medium text-white w-8 text-center">{numInstallments}</span>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Base amount</span>
                <span>{formatCurrency(baseAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Installment fee ({feePercent}%)</span>
                <span>+{formatCurrency(calc.feeAmount)}</span>
              </div>
              <div className="flex justify-between text-white font-medium pt-1.5 border-t border-gray-700/50">
                <span>Total</span>
                <span>{formatCurrency(calc.totalWithFee)}</span>
              </div>
              <div className="flex justify-between text-blue-400 font-medium">
                <span>{numInstallments} monthly payments of</span>
                <span>{formatCurrency(calc.installmentAmount)}/mo</span>
              </div>
            </div>

            {/* Schedule toggle */}
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <DollarSign className="w-3 h-3" />
              View payment schedule
              {showSchedule ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showSchedule && (
              <div className="space-y-1">
                {schedule.map((item) => (
                  <div key={item.number} className="flex justify-between text-xs text-gray-400">
                    <span>
                      Payment {item.number} &middot;{' '}
                      {item.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-600">
              A card will be saved on file and charged automatically each month.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
