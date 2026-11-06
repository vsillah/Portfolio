'use client'

import { useEffect, useState } from 'react'
import { Copy, Download, ExternalLink, Link2, RotateCcw, Share2, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import styles from './CompletionCredential.module.css'

type Credential = { learner_name: string; completed_at: string; verification_token: string | null; revision: number }
type Status = { available?: boolean; eligible: boolean; completedCount: number; credential: Credential | null }
const courseUrl = 'https://amadutown.com/accelerated/learningplan'
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character)

export default function CompletionCredential({ token, completedCount }: { token?: string | null; completedCount?: number }) {
  const [authToken, setAuthToken] = useState<string | null>(token ?? null)
  const [status, setStatus] = useState<Status | null>(null)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    let active = true
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('qa') === 'completion-ready') {
      setPreview(true)
      setStatus({ eligible: true, completedCount: 16, credential: null })
      return () => { active = false }
    }
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('qa') === 'completion-blocked') {
      setPreview(true)
      setStatus({ eligible: false, completedCount: 15, credential: null })
      return () => { active = false }
    }
    async function load() {
      const currentToken = token ?? (await supabase.auth.getSession()).data.session?.access_token
      if (!active || !currentToken) return
      setAuthToken(currentToken)
      try {
        const response = await fetch('/api/accelerated/member/credential', { headers: { Authorization: `Bearer ${currentToken}` }, cache: 'no-store' })
        if (!response.ok) throw new Error()
        const result = await response.json() as Status
        if (active) setStatus(result)
      } catch { if (active) setNotice('Completion status is unavailable. Try again shortly.') }
    }
    void load()
    return () => { active = false }
  }, [token])
  const credential = status?.credential
  const verificationUrl = credential?.verification_token ? `${process.env.NODE_ENV === 'development' ? windowOrigin() : 'https://amadutown.com'}/accelerated/verify/${credential.verification_token}` : null
  if (status?.available === false) return null
  async function command(action: 'claim' | 'revoke' | 'rotate') {
    if (preview) {
      if (action === 'claim') setStatus({ eligible: true, completedCount: 16, credential: { learner_name: name.trim() || 'Course learner', completed_at: new Date().toISOString(), verification_token: 'f'.repeat(64), revision: 1 } })
      setNotice(action === 'claim' ? 'Certificate ready to review.' : 'Link settings are available after sign in.')
      return
    }
    if (!authToken) { setNotice('Sign in to manage your certificate.'); return }
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/accelerated/member/credential', { method: 'POST', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, name: name.trim(), expectedRevision: credential?.revision }) })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || 'Could not update the certificate.'); return }
      if (action === 'claim') setStatus({ eligible: true, completedCount: 16, credential: result.credential })
      else if (credential) setStatus({ eligible: true, completedCount: 16, credential: { ...credential, verification_token: result.link.verification_token, revision: result.link.revision } })
      setNotice(action === 'claim' ? 'Your course completion is recorded.' : action === 'revoke' ? 'The old verification link is now unavailable.' : 'A new verification link is ready. The old link is unavailable.')
    } catch { setNotice('Could not connect. Try again shortly.') }
    finally { setBusy(false) }
  }
  async function download() {
    if (!credential) return
    const date = new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
    const dark = document.documentElement.classList.contains('dark')
    const canvas = dark ? '#112a3a' : '#f8f5e9'
    const ink = dark ? '#f7f7f0' : '#172d35'
    const muted = dark ? '#c8d8d6' : '#4c6468'
    const goldInk = dark ? '#e7c66d' : '#ad7c21'
    let logo = ''
    try {
      const blob = await (await fetch('/amadutown-logo-upscaled.png')).blob()
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
      logo = `<image href="${dataUrl}" x="560" y="74" width="80" height="100"/>`
    } catch { setNotice('The certificate logo could not be loaded. Try downloading again.'); return }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850"><rect width="1200" height="850" fill="${canvas}"/><rect x="26" y="26" width="1148" height="798" fill="none" stroke="#b78d34" stroke-width="4"/><rect x="39" y="39" width="1122" height="772" fill="none" stroke="#b78d34" stroke-width="1"/><path d="M72 92V72h20 M1108 72h20v20 M72 758v20h20 M1108 778h20v-20" fill="none" stroke="#b78d34" stroke-width="3"/><path d="M470 212h92m76 0h92M470 525h92m76 0h92" stroke="#b78d34" stroke-width="2"/><path d="M600 204l8 8-8 8-8-8zM600 517l8 8-8 8-8-8z" fill="#b78d34"/>${logo}<text x="600" y="195" fill="${goldInk}" font-family="Arial" font-size="20" text-anchor="middle" letter-spacing="4">AMADUTOWN · ACCELERATED</text><text x="600" y="298" fill="${ink}" font-family="Georgia" font-size="60" text-anchor="middle">Certificate of Completion</text><text x="600" y="365" fill="${muted}" font-family="Arial" font-size="24" text-anchor="middle">Presented to</text><text x="600" y="444" fill="${ink}" font-family="Georgia" font-size="56" text-anchor="middle">${escapeXml(credential.learner_name)}</text><text x="600" y="493" fill="${muted}" font-family="Arial" font-size="24" text-anchor="middle">For completing all sixteen Accelerated lessons</text><text x="600" y="568" fill="${goldInk}" font-family="Arial" font-size="22" text-anchor="middle">${escapeXml(date)}</text><line x1="100" y1="615" x2="1100" y2="615" stroke="#b78d34" stroke-width="1"/><text x="100" y="658" fill="${muted}" font-family="Arial" font-size="17" letter-spacing="2">ISSUED BY AMADUTOWN</text><text x="100" y="689" fill="${ink}" font-family="Georgia" font-size="24">Accelerated</text><line x1="790" y1="679" x2="1090" y2="679" stroke="#b78d34" stroke-width="2"/><text x="790" y="706" fill="${ink}" font-family="Georgia" font-size="23">Vambah Sillah</text><text x="790" y="730" fill="${muted}" font-family="Arial" font-size="14">Owner, AmaduTown · Author, Accelerated</text><text x="600" y="786" fill="${muted}" font-family="Arial" font-size="16" text-anchor="middle">Course completion · No professional accreditation or certification</text></svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'accelerated-certificate-of-completion.svg'; anchor.click(); URL.revokeObjectURL(url)
  }
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`) } catch { setNotice('Copy is unavailable in this browser.') } }
  async function webShare() {
    if (!verificationUrl) return
    if (!navigator.share) { setNotice('Web Share is unavailable here. Copy the verification link instead.'); return }
    try { await navigator.share({ title: 'Accelerated course completion', text: 'I completed the Accelerated course.', url: verificationUrl }) } catch { /* The learner may cancel the native share sheet. */ }
  }
  const social = (platform: 'linkedin' | 'facebook') => {
    if (!verificationUrl) return
    const url = platform === 'linkedin' ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verificationUrl)}` : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(verificationUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return <section className={styles.card} aria-label="Accelerated Certificate of Completion">
    <div className={styles.top}><div><p className={styles.eyebrow}>ACCELERATED · COMPLETION</p><h3>Certificate of Completion</h3></div><span className={styles.count}>{status?.completedCount ?? completedCount ?? 0} / 16 lessons</span></div>
    {(credential || status?.eligible) && <div className={styles.certificate} aria-label={credential ? 'Claimed Accelerated completion certificate' : 'Unclaimed Accelerated completion certificate preview'}>
      <span className={styles.cornerTopLeft} aria-hidden="true" /><span className={styles.cornerTopRight} aria-hidden="true" /><span className={styles.cornerBottomLeft} aria-hidden="true" /><span className={styles.cornerBottomRight} aria-hidden="true" />
      <span className={styles.certificateState}>{credential ? 'Claimed certificate' : 'Preview · unclaimed'}</span>
      <Image className={styles.logo} src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" width={48} height={60} />
      <span className={styles.certificateBrand}>AMADUTOWN · ACCELERATED</span>
      <span className={styles.ornament} aria-hidden="true">◆</span>
      <strong className={styles.certificateTitle}>Certificate of Completion</strong>
      <span className={styles.presented}>Presented to</span>
      <strong className={styles.learner}>{credential?.learner_name || name.trim() || 'Your name'}</strong>
      <span className={styles.certificateCourse}>For completing all sixteen Accelerated lessons</span>
      <span className={styles.certificateDate}>{credential ? new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'Completion date added when claimed'}</span>
      <div className={styles.certification}>
        <div className={styles.issuer}><span>ISSUED BY AMADUTOWN</span><strong>Accelerated</strong></div>
        <div className={styles.signature}><span className={styles.signatureLine} aria-hidden="true" /><strong>Vambah Sillah</strong><span>Owner, AmaduTown · Author, Accelerated</span></div>
      </div>
      <small>Course completion · No professional accreditation or certification</small>
    </div>}
    {!authToken && !preview ? <p>Sign in and save your completed lessons to claim a certificate. <Link href="/auth/login?redirect=%2Faccelerated%2Fdecision-file">Sign in</Link></p> : credential ? <>
      <p><strong>{credential.learner_name}</strong> completed all sixteen lessons on {new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      <p className={styles.detail}>This records course completion. It does not require sharing your Decision File and is not a professional accreditation or certification.</p>
      <div className={styles.controls} aria-label="Certificate actions">
        <button type="button" title="Download certificate" aria-label="Download certificate" onClick={download}><Download aria-hidden="true" /></button>
        <button type="button" title="Share with your device" aria-label="Share with your device" disabled={!verificationUrl} onClick={() => void webShare()}><Share2 aria-hidden="true" /></button>
        <button type="button" title="Open LinkedIn share composer" aria-label="Open LinkedIn share composer" disabled={!verificationUrl} onClick={() => social('linkedin')}>in<ExternalLink aria-hidden="true" /></button>
        <button type="button" title="Open Facebook share composer" aria-label="Open Facebook share composer" disabled={!verificationUrl} onClick={() => social('facebook')}>f<ExternalLink aria-hidden="true" /></button>
        <button type="button" title="Copy verification link" aria-label="Copy verification link" disabled={!verificationUrl} onClick={() => verificationUrl && void copy(verificationUrl, 'Verification link')}><Link2 aria-hidden="true" /></button>
        <button type="button" title="Copy course link" aria-label="Copy course link" onClick={() => void copy(courseUrl, 'Course link')}><Copy aria-hidden="true" /></button>
      </div>
      <div className={styles.linkActions}>{verificationUrl ? <button type="button" disabled={busy || preview} onClick={() => void command('revoke')}><ShieldOff aria-hidden="true" /> Turn off verification link</button> : <button type="button" disabled={busy || preview} onClick={() => void command('rotate')}><RotateCcw aria-hidden="true" /> Create verification link</button>}</div>
    </> : status?.eligible ? <><p>All sixteen lessons are complete. Choose the name that will appear on your certificate. You cannot change it after claiming.</p><label className={styles.name}>Name on certificate<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" /></label><button type="button" className={styles.claim} disabled={busy || !name.trim()} onClick={() => void command('claim')}>Claim certificate</button></> : <p>Complete and save all sixteen lessons to claim your certificate. Your worksheet answers can stay private. <Link href="/accelerated/learningplan">Continue lessons</Link></p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>
}

function windowOrigin() { return typeof window === 'undefined' ? 'https://amadutown.com' : window.location.origin }
