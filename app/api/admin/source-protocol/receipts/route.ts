import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSourceProtocolBearer } from '@/lib/source-protocol-auth'
import { buildAnswerReceiptInsertRows } from '@/lib/source-respecting-llm-persistence'
import type { AnswerReceipt } from '@/lib/source-respecting-llm-protocol'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const unauthorized = requireSourceProtocolBearer(request.headers.get('authorization'))
  if (unauthorized) return unauthorized

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const receipt = body.receipt as AnswerReceipt | undefined

    if (!receipt?.id || !Array.isArray(receipt.attributedChunks)) {
      return NextResponse.json({ error: 'receipt is required' }, { status: 400 })
    }

    const rows = buildAnswerReceiptInsertRows(receipt)
    const { error: receiptError } = await supabaseAdmin
      .from('answer_receipts')
      .upsert(rows.answerReceipt, { onConflict: 'id' })

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('answer_receipt_chunks')
      .delete()
      .eq('answer_receipt_id', receipt.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (rows.answerReceiptChunks.length > 0) {
      const { error: chunksError } = await supabaseAdmin
        .from('answer_receipt_chunks')
        .insert(rows.answerReceiptChunks)

      if (chunksError) {
        return NextResponse.json({ error: chunksError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      receiptId: receipt.id,
      attributedChunks: rows.answerReceiptChunks.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to persist answer receipt' },
      { status: 500 }
    )
  }
}
