'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
type Item = { proposal_id: string; proposals: { client_name: string; bundle_name: string; status: string } }
export default function StagedProposalList() {
  const [error, setError] = useState('')
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => { let active = true; (async () => {
    const session = await getCurrentSession()
    if (!session) return
    const r = await fetch('/api/admin/proposals/prepare-staged', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Could not load prepared proposals.')
    if (active) setItems(data.packages)
  })().catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  if (error) return <p role="status" className="my-4 text-muted-foreground">{error}</p>
  if (!items.length) return null
  return <section className="my-6 rounded-lg border border-radiant-gold/20 p-4"><h2 className="mb-3 font-semibold">Prepared proposals</h2><ul className="space-y-3">{items.map(p => <li key={p.proposal_id}><Link className="flex flex-wrap items-center gap-2 text-radiant-gold underline" href={`/admin/sales/proposals/prepare?proposalId=${p.proposal_id}`}><FileText size={16} />{p.proposals.client_name} · {p.proposals.bundle_name}<span className="text-sm text-muted-foreground">{p.proposals.status.replaceAll('_',' ')}</span></Link></li>)}</ul></section>
}
