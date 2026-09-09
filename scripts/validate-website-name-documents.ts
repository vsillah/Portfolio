import { mkdir, writeFile } from 'node:fs/promises'
import { generateInvoicePDFBuffer } from '../lib/invoice-pdf'

async function main() {
  const output = 'docs/qa/website-llc-naming'
  await mkdir(output, { recursive: true })
  const invoice = await generateInvoicePDFBuffer({
    id: 7,
    created_at: '2026-09-09T12:00:00Z',
    total_amount: 100,
    final_amount: 100,
    status: 'paid',
    order_items: [{ id: 1, quantity: 1, price_at_purchase: 100, products: null, services: { title: 'Synthetic consulting item' } }],
  }, { logoUrl: `${process.cwd()}/public/amadutown-logo-upscaled.png` })
  await writeFile(`${output}/invoice-synthetic.pdf`, invoice)
  console.log('Synthetic invoice generated locally; no customer data or external requests.')
}

void main()
