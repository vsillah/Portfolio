'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Download, ExternalLink, Link2, RotateCcw, Share2, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import styles from './CompletionCredential.module.css'

type Credential = { learner_name: string; completed_at: string; verification_token: string | null; revision: number }
type Status = { available?: boolean; eligible: boolean; completedCount: number; credential: Credential | null }
const courseUrl = 'https://amadutown.com/accelerated/learningplan'
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character)
const recordLabel = (credential: Credential | null | undefined) => credential?.verification_token
  ? `AT-ACC-${credential.verification_token.slice(0, 4).toUpperCase()}-${credential.verification_token.slice(4, 8).toUpperCase()}`
  : 'AT-ACC-0000-0000'

export default function CompletionCredential({ token, completedCount, profileName }: { token?: string | null; completedCount?: number; profileName?: string | null }) {
  const [authToken, setAuthToken] = useState<string | null>(token ?? null)
  const [status, setStatus] = useState<Status | null>(null)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const nameEdited = useRef(false)
  useEffect(() => {
    if (!nameEdited.current && profileName?.trim()) setName(profileName.trim())
  }, [profileName])
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
  const certificateName = credential?.learner_name || name.trim() || 'Your name'
  const certificateNameSize = Math.max(3.2, Math.min(7, 63 / Math.max(certificateName.length, 9)))
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
    const ink = '#0b3047'
    const muted = '#263b47'
    const gold = '#a57413'
    let logoData = ''
    let frameData = ''
    let signatureData = ''
    try {
      const [logoResponse, frameResponse, signatureResponse] = await Promise.all([
        fetch('/amadutown-logo-upscaled.png'),
        fetch('/accelerated/certificate-frame.png'),
        fetch('/accelerated/vambah-signature.png'),
      ])
      if (!logoResponse.ok || !frameResponse.ok || !signatureResponse.ok) throw new Error('Certificate artwork unavailable')
      const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
      logoData = await toDataUrl(await logoResponse.blob())
      frameData = await toDataUrl(await frameResponse.blob())
      signatureData = await toDataUrl(await signatureResponse.blob())
      await document.fonts.ready
    } catch { setNotice('The certificate artwork could not be loaded. Try downloading again.'); return }
    const titleElement = document.querySelector(`.${styles.certificateTitle}`)
    const fontFamily = titleElement ? getComputedStyle(titleElement).fontFamily : 'Georgia, serif'
    const serifImage = (value: string, initialSize: number, baseline: number, maxWidth: number) => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Certificate drawing unavailable')
      let fontSize = initialSize
      context.font = `600 ${fontSize}px ${fontFamily}`
      while (context.measureText(value).width > maxWidth && fontSize > 42) {
        fontSize -= 2
        context.font = `600 ${fontSize}px ${fontFamily}`
      }
      const metrics = context.measureText(value)
      const width = Math.ceil(metrics.width + 32)
      const height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 32)
      const scale = 3
      canvas.width = width * scale
      canvas.height = height * scale
      context.scale(scale, scale)
      context.font = `600 ${fontSize}px ${fontFamily}`
      context.fillStyle = ink
      context.textBaseline = 'alphabetic'
      context.fillText(value, 16, 16 + metrics.actualBoundingBoxAscent)
      return `<image href="${canvas.toDataURL('image/png')}" x="${712 - width / 2}" y="${baseline - 16 - metrics.actualBoundingBoxAscent}" width="${width}" height="${height}"/>`
    }
    let titleArtwork = ''
    let learnerArtwork = ''
    try {
      titleArtwork = serifImage('CERTIFICATE OF COMPLETION', 72, 379, 1050)
      learnerArtwork = serifImage(credential.learner_name, 100, 589, 1030)
    } catch { setNotice('The certificate artwork could not be drawn. Try downloading again.'); return }
    const verifyLabel = verificationUrl
      ? `/accelerated/verify/${credential.verification_token?.slice(0, 8)}...`
      : 'Verification link unavailable'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1424" height="1104" viewBox="0 0 1424 1104">
      <title>Accelerated Certificate of Completion</title><desc>Certificate awarded to ${escapeXml(credential.learner_name)} on ${escapeXml(date)} by AmaduTown.</desc>
      <image href="${frameData}" x="0" y="0" width="1424" height="1104" preserveAspectRatio="none"/>
      <image href="${logoData}" x="670" y="105" width="84" height="104" preserveAspectRatio="xMidYMid meet"/>
      <text x="712" y="257" fill="${ink}" font-family="Arial,sans-serif" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="8">AMADUTOWN</text>
      ${titleArtwork}
      <line x1="394" y1="412" x2="1030" y2="412" stroke="${gold}" stroke-width="1.4"/><path d="M690 412l22-20 22 20-22 20z" fill="none" stroke="${gold}" stroke-width="2"/>
      <text x="712" y="488" fill="${muted}" font-family="Georgia,serif" font-size="25" font-weight="600" text-anchor="middle">This certifies that</text>
      ${learnerArtwork}
      <line x1="340" y1="618" x2="1084" y2="618" stroke="${gold}" stroke-width="1.2"/>
      <text x="712" y="678" fill="${muted}" font-family="Georgia,serif" font-size="25" text-anchor="middle">has successfully completed the course</text>
      <text x="712" y="755" fill="${ink}" font-family="Georgia,serif" font-size="45" font-weight="700" text-anchor="middle" letter-spacing="12">ACCELERATED</text>
      <text x="712" y="794" fill="${ink}" font-family="Georgia,serif" font-size="27" font-weight="600" text-anchor="middle">Building Smarter Products with AI</text>
      <text x="184" y="840" fill="${gold}" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3">ISSUE DATE</text><text x="184" y="874" fill="${ink}" font-family="Georgia,serif" font-size="21">${escapeXml(date)}</text>
      <image href="${signatureData}" x="517" y="785" width="390" height="112" preserveAspectRatio="xMidYMid meet"/>
      <line x1="518" y1="886" x2="906" y2="886" stroke="${ink}" stroke-width="1.3"/>
      <text x="712" y="919" fill="${ink}" font-family="Georgia,serif" font-size="25" font-weight="700" text-anchor="middle">Vambah Sillah</text><text x="712" y="950" fill="${ink}" font-family="Georgia,serif" font-size="18" text-anchor="middle">Owner, AmaduTown · Author, Accelerated</text>
      <text x="1040" y="828" fill="${gold}" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2">CREDENTIAL RECORD ID</text><text x="1040" y="861" fill="${ink}" font-family="Georgia,serif" font-size="18">${escapeXml(recordLabel(credential))}</text>
      <text x="1040" y="897" fill="${gold}" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2">VERIFICATION REFERENCE</text><text x="1040" y="928" fill="${ink}" font-family="Georgia,serif" font-size="14">${escapeXml(verifyLabel)}</text>
    </svg>`
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
      <span className={styles.certificateState}>{credential ? 'CLAIMED CERTIFICATE' : 'PREVIEW · UNCLAIMED'}</span>
      <div className={styles.artwork}>
        <div className={styles.artworkBody}>
          <Image className={styles.logo} src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" width={70} height={86} />
          <span className={styles.certificateBrand}>AMADUTOWN</span>
          <strong className={styles.certificateTitle}>Certificate of Completion</strong>
          <span className={styles.titleRule} aria-hidden="true" />
          <span className={styles.presented}>This certifies that</span>
          <strong className={styles.learner} style={{ fontSize: `${certificateNameSize}cqw` }}>{certificateName}</strong>
          <span className={styles.nameRule} aria-hidden="true" />
          <span className={styles.certificateCourse}>has successfully completed the course</span>
          <strong className={styles.courseName}>ACCELERATED</strong>
          <span className={styles.courseSubtitle}>Building Smarter Products with AI</span>
          <div className={styles.certification}>
            <div className={styles.issue}><span>ISSUE DATE</span><strong>{credential ? new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'Month DD, YYYY'}</strong></div>
            <div className={styles.signature}><Image className={styles.signatureImage} src="/accelerated/vambah-signature.png" alt="" width={360} height={130} /><span className={styles.signatureLine} aria-hidden="true" /><strong>Vambah Sillah</strong><span>Owner, AmaduTown · Author, Accelerated</span></div>
            <div className={styles.record}><span>CREDENTIAL RECORD ID</span><strong>{recordLabel(credential)}</strong><span>VERIFICATION REFERENCE</span><strong>{verificationUrl ? verificationUrl.replace(/^https?:\/\//, '') : 'Available after claiming'}</strong></div>
          </div>
        </div>
      </div>
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
    </> : status?.eligible ? <><p>All sixteen lessons are complete. Confirm the name that will appear on your certificate. You cannot change it after claiming.</p><label className={styles.name}>Name on certificate<input value={name} onChange={(event) => { nameEdited.current = true; setName(event.target.value) }} maxLength={120} autoComplete="name" /></label><button type="button" className={styles.claim} disabled={busy || !name.trim()} onClick={() => void command('claim')}>Claim certificate</button></> : <p>Complete and save all sixteen lessons to claim your certificate. Your worksheet answers can stay private. <Link href="/accelerated/learningplan">Continue lessons</Link></p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>
}

function windowOrigin() { return typeof window === 'undefined' ? 'https://amadutown.com' : window.location.origin }
