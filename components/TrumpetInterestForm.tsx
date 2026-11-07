import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function TrumpetInterestForm() {
  return <div id="interest" className="scroll-mt-28 rounded-3xl border border-radiant-gold/30 bg-card p-6 shadow-xl sm:p-8">
    <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">Adult tester interest</span>
    <h2 className="mt-3 font-premium text-3xl">Start with a clear choice.</h2>
    <p className="mt-4 leading-7 text-muted-foreground">Review the adult contact consent before sharing interest. The Portfolio activation page will tell you whether the pilot is open. No child details are requested.</p>
    <Link href="/activate/trumpet-trainer" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-radiant-gold px-6 py-3 font-semibold text-imperial-navy transition-colors hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold">Review adult interest and consent <ArrowRight aria-hidden size={18} /></Link>
  </div>
}
