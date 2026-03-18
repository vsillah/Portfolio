import { NextResponse } from 'next/server';
import { getInstallmentFeePercent } from '@/lib/installments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/installments/config
 * Public endpoint returning the current installment fee percent.
 */
export async function GET() {
  try {
    const feePercent = await getInstallmentFeePercent();
    return NextResponse.json({ feePercent });
  } catch (error) {
    console.error('Error fetching installment config:', error);
    return NextResponse.json({ feePercent: 10 });
  }
}
