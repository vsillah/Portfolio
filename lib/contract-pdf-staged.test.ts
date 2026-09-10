// @vitest-environment node
import { expect, it } from 'vitest'
import { generateContractPDF } from './contract-pdf'
it('renders a reviewed agreement to a real PDF in Node', async () => {
 const result = await generateContractPDF({ client_name: 'Synthetic Reviewer', total_amount: 997, reviewed_text: 'Synthetic agreement. Deposit $498.50; balance $498.50 after delivery acceptance.' })
 expect(result.subarray(0,4).toString()).toBe('%PDF')
 expect(result.length).toBeGreaterThan(1000)
})
