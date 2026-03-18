import { supabaseAdmin } from './supabase';

export interface InstallmentScheduleItem {
  number: number;
  amount: number;
  dueDate: Date;
}

export interface InstallmentPlanCalculation {
  baseAmount: number;
  feePercent: number;
  feeAmount: number;
  totalWithFee: number;
  numInstallments: number;
  installmentAmount: number;
  schedule: InstallmentScheduleItem[];
}

/**
 * Calculate an installment plan with fee markup.
 * The last installment absorbs any rounding difference.
 */
export function calculateInstallmentPlan(
  baseAmount: number,
  numInstallments: number,
  feePercent: number
): InstallmentPlanCalculation {
  const feeAmount = Math.round(baseAmount * (feePercent / 100) * 100) / 100;
  const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
  const perInstallment = Math.floor((totalWithFee / numInstallments) * 100) / 100;
  const lastInstallment = Math.round((totalWithFee - perInstallment * (numInstallments - 1)) * 100) / 100;

  const now = new Date();
  const schedule: InstallmentScheduleItem[] = [];
  for (let i = 0; i < numInstallments; i++) {
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + i);
    schedule.push({
      number: i + 1,
      amount: i === numInstallments - 1 ? lastInstallment : perInstallment,
      dueDate,
    });
  }

  return {
    baseAmount,
    feePercent,
    feeAmount,
    totalWithFee,
    numInstallments,
    installmentAmount: perInstallment,
    schedule,
  };
}

/**
 * Fetch the installment fee percent from site_settings.
 * Falls back to 10% if not configured.
 */
export async function getInstallmentFeePercent(): Promise<number> {
  if (!supabaseAdmin) return 10;

  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', 'installment_fee_percent')
    .single();

  if (data?.value != null) {
    const parsed = parseFloat(String(data.value));
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  return 10;
}
