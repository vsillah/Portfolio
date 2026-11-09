import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'
import styles from '@/components/member/CompletionCredential.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Agentified course completion | AmaduTown', robots: { index: false, follow: false }, description: 'Verify an Agentified course completion credential.' }
const tokenPattern = /^[0-9a-f]{64}$/

export default async function VerifyCompletion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = tokenPattern.test(token) ? await supabaseAdmin.from('accelerated_completion_credentials')
    .select('learner_name,completed_at').eq('verification_token', token).eq('content_version', AGENTIFIED_VERSION).maybeSingle() : null
  const credential = result && !result.error ? result.data : null
  return <main className={styles.verificationPage}><div className={styles.verificationCard}>
    <p className="text-sm uppercase tracking-widest text-radiant-gold">AmaduTown · Agentified</p>
    {credential ? <><h1 className="mt-4 text-3xl font-semibold">Course completion verified</h1><p className="mt-5 text-lg">{credential.learner_name} completed all sixteen Agentified lessons.</p><p className="mt-3 text-platinum-white/70">Completed {new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}.</p><p className="mt-5 text-sm text-platinum-white/65">This is a course completion credential. It is not a professional accreditation or certification.</p></> : <><h1 className="mt-4 text-3xl font-semibold">Verification link unavailable</h1><p className="mt-4 text-platinum-white/70">This link may have been revoked or replaced.</p></>}
    <a className="mt-8 inline-block text-radiant-gold underline" href="/agentified/learningplan">Explore Agentified</a>
  </div></main>
}
