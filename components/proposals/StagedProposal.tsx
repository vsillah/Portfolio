'use client'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, FileText, Lock, CreditCard, ArrowRight } from 'lucide-react'
import SiteThemeCorner from '@/components/SiteThemeCorner'
import type { StagedEvidence, StagedPolicy } from '@/lib/proposal-staged-policy'
interface View {
  signatures: { proposal: { name: string; at: string } | null; agreement: { name: string; at: string } | null }
  actionsEnabled: boolean
  proposal: { id: string; client_name: string; bundle_name: string; terms_text: string; valid_until: string | null }
  policy: StagedPolicy; evidence: StagedEvidence; agreement: string; digest: string; deliveryVersion: string | null; deliveryNote: string | null
  depositBlocker: string | null; balanceBlocker: string | null; dashboardPath: string; proposalPath: string
}
export default function StagedProposal({ id, credential, dashboard = false }: { id: string; credential: string; dashboard?: boolean }) {
  const [data, setData] = useState<View | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/proposals/${id}/staged`, { headers: { 'x-proposal-access': credential }, cache: 'no-store' })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    setData(d)
  }, [id, credential])
  useEffect(() => { refresh().catch(e => setMessages({ load: e.message })) }, [refresh])
  async function action(key: string, body: Record<string, unknown>) {
    setBusy(true); setMessages(m => ({ ...m, [key]: '' }))
    try {
      const r = await fetch(`/api/proposals/${id}/staged`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-proposal-access': credential }, body: JSON.stringify(body) })
      if (r.ok && r.headers.get('content-type')?.includes('application/pdf')) {
        const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = 'agreement-signature-record.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return
      }
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (d.url) { window.location.assign(d.url); return }
      setConfirmed(c => ({ ...c, [key]: false })); setMessages(m => ({ ...m, [key]: 'Recorded successfully.' })); await refresh()
    } catch (e) { setMessages(m => ({ ...m, [key]: e instanceof Error ? e.message : 'Please try again.' })) }
    finally { setBusy(false) }
  }
  const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100)
  const btn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-3 font-semibold text-imperial-navy disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed'
  const secondary = 'inline-flex items-center gap-2 rounded-lg border border-platinum-white/30 px-4 py-3 text-platinum-white'
  const box = 'rounded-lg border border-platinum-white/20 bg-imperial-navy p-4 sm:p-6'
  const msg = (key: string) => messages[key] && <p role="status" className="mt-3 text-amber-200">{messages[key]}</p>
  const allSigned = data?.evidence.proposalSigned && data.evidence.agreementSigned
  const expired = !!data?.proposal.valid_until && Date.parse(data.proposal.valid_until) < Date.now() && !data?.evidence.depositPaid
  const nextAnchor = !allSigned ? '#review' : !data?.evidence.depositPaid ? '#deposit' : !data?.evidence.deliveryAccepted ? '#delivery' : '#balance'
  const next = !allSigned ? 'Review and sign the proposal and agreement' : !data?.evidence.depositPaid ? 'Pay your deposit when ready to proceed' : !data.evidence.delivered ? 'Await delivery and an agreed kickoff' : !data.evidence.deliveryAccepted ? 'Review the delivered work' : !data.evidence.balancePaid ? 'Pay the final balance' : 'All payments confirmed'
  return <div className="min-h-screen bg-imperial-navy text-platinum-white"><SiteThemeCorner /><main className="mx-auto max-w-4xl p-4 sm:p-8">
    <header className="flex items-center gap-4 border-b border-radiant-gold/30 pb-6 pr-10"><Image src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" priority unoptimized width={40} height={55} className="h-auto w-10" /><div><p className="text-sm text-radiant-gold">AmaduTown Advisory Solutions, LLC</p><h1 className="text-2xl font-semibold">{dashboard ? 'Client dashboard' : 'Proposal and agreement'}</h1></div></header>
    {!data ? <div className="my-6">{msg('load')}<button className={secondary} onClick={() => refresh().catch(e => setMessages({ load: e.message }))}>Reload package</button></div> : <>
      <section className="my-6"><h2 className="text-xl">{data.proposal.bundle_name}</h2><p className="mt-2 text-platinum-white/70">Prepared for {data.proposal.client_name}</p></section>
      <section className={`${box} my-6`}><p className="text-sm uppercase tracking-wide text-radiant-gold">Next step</p><h2 className="my-2 text-lg">{next}</h2>
        {dashboard && <a className={btn} href={data.proposalPath + nextAnchor}>{!allSigned ? 'Review and sign' : !data.evidence.depositPaid ? 'Pay deposit' : !data.evidence.deliveryAccepted ? 'Review delivery' : !data.evidence.balancePaid ? 'Pay final balance' : 'View agreement'} <ArrowRight size={18} /></a>}
        {!data.actionsEnabled && <p className="mt-3 text-amber-200">New signatures and payments are paused. Your documents and payment history remain available.</p>}
      </section>
      {dashboard && <section className="grid gap-4 sm:grid-cols-3 mb-6">{[['Contract total',data.policy.totalCents],['Confirmed paid',(data.evidence.depositPaid?data.policy.depositCents:0)+(data.evidence.balancePaid?data.policy.balanceCents:0)],['Remaining',(data.evidence.depositPaid?0:data.policy.depositCents)+(data.evidence.balancePaid?0:data.policy.balanceCents)]].map(([label,n])=><div key={label} className={box}><p className="text-sm text-platinum-white/70">{label}</p><p className="mt-2 text-xl">{money(Number(n))}</p></div>)}</section>}
      {!dashboard && <>
        <a className="inline-flex gap-2 text-radiant-gold underline mb-6" href={data.dashboardPath}>Open client dashboard <ArrowRight size={18} /></a>
        <p className="mb-4">Fixed total {money(data.policy.totalCents)} · No recurring payments{data.proposal.valid_until ? ` · Valid until ${new Date(data.proposal.valid_until).toLocaleDateString()}` : ''}</p>
        <label className="block mb-6">Your full name<input className="mt-2 block w-full rounded-lg border border-platinum-white/30 bg-imperial-navy p-3" value={name} onChange={e => setName(e.target.value)} /></label>
      </>}
      <div id="review" className="space-y-4">{(['proposal','agreement'] as const).map(document => {
        const signed = document==='proposal'?data.evidence.proposalSigned:data.evidence.agreementSigned
        const title = document==='proposal'?'Scope and proposal':'Customer agreement'
        return <section className={box} key={document}><h3 className="flex items-center gap-2 font-semibold"><FileText size={18} />{title}{signed && <span className="ml-auto text-sm text-green-300">Signed</span>}</h3>
          <div className="mt-4 flex flex-wrap gap-3"><button className={secondary} disabled={busy} onClick={() => action(document,{action:'document',document})}>Original PDF</button>{signed && <button className={secondary} disabled={busy} onClick={() => action(document,{action:'document',document:'signature-record'})}>Download signature record</button>}</div>{signed && <p className="mt-3 text-sm text-platinum-white/70">Signed by {data.signatures[document]?.name} · {new Date(data.signatures[document]?.at || '').toLocaleString()}</p>}
          {!dashboard && <><details className="my-4"><summary className="cursor-pointer text-radiant-gold">Read {title.toLowerCase()}</summary><p className="mt-4 whitespace-pre-wrap leading-relaxed">{document==='proposal'?data.proposal.terms_text:data.agreement}</p></details>
            {expired && <p className="my-3 text-amber-200">Proposal expired. Contact your advisor before signing or paying.</p>}<p className="text-xs text-platinum-white/60">Document version {data.digest.slice(0,12)}</p>
            {!signed && <label className="my-4 flex gap-3"><input type="checkbox" checked={!!confirmed[document]} onChange={e=>setConfirmed(c=>({...c,[document]:e.target.checked}))} />I have reviewed and agree to this {document}, version {data.digest.slice(0,12)}.</label>}
            <button className={btn} disabled={busy||expired||signed||!data.actionsEnabled||!name.trim()||!confirmed[document]} onClick={()=>action(document,{action:'sign',document,digest:data.digest,name,confirm:confirmed[document]})}>{signed?<><CheckCircle size={18}/>Signed</>:`Sign ${document}`}</button>
          </>}{msg(document)}</section>
      })}</div>
      <section className="my-6 grid gap-4 sm:grid-cols-2">{(['deposit','balance'] as const).map(stage=>{
        const paid=stage==='deposit'?data.evidence.depositPaid:data.evidence.balancePaid
        const blocker=stage==='deposit'?data.depositBlocker:data.balanceBlocker
        return <div id={stage} className={box} key={stage}><h3 className="flex items-center gap-2 font-semibold">{paid?<CheckCircle size={18}/>:blocker?<Lock size={18}/>:<CreditCard size={18}/>} {stage==='deposit'?'Deposit':'Final balance'} · {money(stage==='deposit'?data.policy.depositCents:data.policy.balanceCents)}</h3><p className="my-3 text-sm text-platinum-white/75">{paid?'Payment confirmed.':blocker||'Ready for your one-time payment.'}</p>
          {!dashboard && <button className={btn} disabled={busy||(expired&&stage==='deposit')||paid||!data.actionsEnabled||!!blocker} onClick={()=>action(stage,{action:'checkout',stage})}>{paid?'Paid':`Pay ${stage==='deposit'?'deposit':'final balance'}`}</button>}{msg(stage)}</div>
      })}</section>
      <button className={secondary} onClick={()=>refresh().catch(e=>setMessages(m=>({...m,refresh:e.message})))}>Refresh payment status</button>{msg('refresh')}
      <section id="delivery" className={`${box} my-6`}><h3 className="text-lg font-semibold">Delivery review</h3><p className="my-3">{data.deliveryNote||'Your advisor will confirm kickoff and submit delivery here when it is ready.'}</p>
        <details><summary className="cursor-pointer text-radiant-gold">Acceptance criteria</summary><ul className="list-disc pl-5 my-3">{data.policy.acceptanceCriteria.map(c=><li key={c}>{c}</li>)}</ul></details>
        {data.evidence.deliveryAccepted?<p className="mt-4 text-green-300">Delivery accepted.</p>:!dashboard&&data.evidence.delivered&&<><label className="my-4 flex gap-3"><input type="checkbox" checked={!!confirmed.delivery} onChange={e=>setConfirmed(c=>({...c,delivery:e.target.checked}))}/>I have reviewed the delivered work and confirm that every acceptance criterion is met.</label><button className={btn} disabled={busy||!data.actionsEnabled||!confirmed.delivery||!name.trim()||!data.evidence.depositPaid} onClick={()=>action('delivery',{action:'accept-delivery',name,deliveryVersion:data.deliveryVersion,digest:data.digest,confirm:confirmed.delivery})}>Accept delivered work</button><p className="mt-3 text-sm">If a criterion is unmet, contact your advisor before accepting. The final balance remains locked.</p></>}{msg('delivery')}
      </section>
    </>}
  </main></div>
}
