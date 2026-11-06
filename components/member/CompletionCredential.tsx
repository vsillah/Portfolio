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
const botanicalMarkup = (color: string) => `
  <g stroke="${color}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M14 150 C24 108 46 74 88 47 C111 32 132 24 153 18" fill="none" stroke-width="1.7"/>
    <path d="M22 127 C17 111 18 96 25 82 M50 77 C54 58 67 44 86 34" fill="none" stroke-width="1"/>
    <path d="M29 111 C10 103 4 85 11 67 C31 77 39 94 29 111Z M43 87 C37 68 47 52 66 45 C68 65 59 80 43 87Z M65 64 C67 44 82 33 102 31 C99 51 86 61 65 64Z" fill="${color}" fill-opacity=".13" stroke-width="1.15"/>
    <path d="M36 103 C56 94 72 100 79 118 C58 119 43 114 36 103Z M58 76 C76 68 91 73 99 89 C81 92 66 87 58 76Z M87 50 C104 43 118 48 125 62 C107 65 94 60 87 50Z" fill="${color}" fill-opacity=".13" stroke-width="1.15"/>
    <path d="M16 76 29 107 M44 85 63 50 M66 63 97 35 M39 103 75 116 M61 76 94 87 M91 50 121 60" fill="none" stroke-width=".75" opacity=".8"/>
    <g fill="${color}" fill-opacity=".16" stroke-width="1.1">
      <ellipse cx="128" cy="29" rx="6" ry="13" transform="rotate(-18 128 29)"/>
      <ellipse cx="143" cy="34" rx="6" ry="13" transform="rotate(52 143 34)"/>
      <ellipse cx="145" cy="50" rx="6" ry="13" transform="rotate(122 145 50)"/>
      <ellipse cx="129" cy="54" rx="6" ry="13" transform="rotate(192 129 54)"/>
      <ellipse cx="120" cy="42" rx="6" ry="13" transform="rotate(258 120 42)"/>
    </g>
    <circle cx="133" cy="42" r="5.5" fill="${color}" fill-opacity=".72" stroke-width="1"/>
    <circle cx="80" cy="26" r="2" fill="${color}"/><circle cx="89" cy="22" r="1.5" fill="${color}"/>
  </g>`

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
    const paper = dark ? '#112a38' : '#faf6ea'
    const ink = dark ? '#f3ecdb' : '#25343b'
    const muted = dark ? '#c9c9bf' : '#5c6461'
    const gold = dark ? '#d9bd78' : '#9d783f'
    let logoData = ''
    try {
      const logoResponse = await fetch('/amadutown-logo-upscaled.png')
      if (!logoResponse.ok) throw new Error('Certificate crest unavailable')
      const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
      logoData = await toDataUrl(await logoResponse.blob())
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
      return `<image href="${canvas.toDataURL('image/png')}" x="${600 - width / 2}" y="${baseline - 16 - metrics.actualBoundingBoxAscent}" width="${width}" height="${height}"/>`
    }
    const corner = (transform: string) => `<g transform="${transform}" opacity=".88">${botanicalMarkup(gold)}</g>`
    let titleArtwork = ''
    let learnerArtwork = ''
    try {
      titleArtwork = serifImage('CERTIFICATE OF COMPLETION', 65, 327, 910)
      learnerArtwork = serifImage(credential.learner_name, 91, 482, 900)
    } catch { setNotice('The certificate artwork could not be drawn. Try downloading again.'); return }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
      <title>Accelerated Certificate of Completion</title><desc>Certificate awarded to ${escapeXml(credential.learner_name)} on ${escapeXml(date)} by AmaduTown.</desc>
      <rect width="1200" height="850" fill="${paper}"/><rect x="27" y="27" width="1146" height="796" fill="none" stroke="${gold}" stroke-width="1.6"/><rect x="38" y="38" width="1124" height="774" fill="none" stroke="${gold}" stroke-width=".7" opacity=".65"/>
      ${corner('translate(45 40)')}${corner('translate(1155 40) scale(-1 1)')}${corner('translate(45 810) scale(.7 -.7)')}${corner('translate(1155 810) scale(-.7 -.7)')}
      <image href="${logoData}" x="565" y="67" width="70" height="86" preserveAspectRatio="xMidYMid meet"/>
      <text x="600" y="180" fill="${gold}" font-family="Arial,sans-serif" font-size="18" text-anchor="middle" letter-spacing="7">AMADUTOWN</text>
      <text x="600" y="205" fill="${muted}" font-family="Arial,sans-serif" font-size="15" text-anchor="middle" letter-spacing="6">ACCELERATED</text>
      <line x1="433" y1="229" x2="767" y2="229" stroke="${gold}" stroke-width="1.2"/>
      ${titleArtwork}
      <text x="600" y="384" fill="${muted}" font-family="Arial,sans-serif" font-size="16" text-anchor="middle" letter-spacing="4">THIS CERTIFIES THAT</text>
      ${learnerArtwork}
      <text x="600" y="530" fill="${muted}" font-family="Georgia,serif" font-size="25" text-anchor="middle">has completed all sixteen lessons of Accelerated</text>
      <text x="600" y="588" fill="${gold}" font-family="Arial,sans-serif" font-size="17" text-anchor="middle" letter-spacing="3">${escapeXml(date.toUpperCase())}</text>
      <line x1="445" y1="618" x2="755" y2="618" stroke="${gold}" stroke-width="1.3"/>
      <text x="215" y="686" fill="${muted}" font-family="Arial,sans-serif" font-size="14" letter-spacing="3">ISSUED BY</text><text x="215" y="722" fill="${ink}" font-family="Georgia,serif" font-size="29">AmaduTown</text>
      <line x1="780" y1="686" x2="1093" y2="686" stroke="${gold}" stroke-width="1.5"/>
      <text x="785" y="718" fill="${ink}" font-family="Georgia,serif" font-size="23">Vambah Sillah</text><text x="785" y="742" fill="${muted}" font-family="Arial,sans-serif" font-size="14">Owner, AmaduTown · Author, Accelerated</text>
      <text x="600" y="789" fill="${muted}" font-family="Arial,sans-serif" font-size="14" text-anchor="middle">Course completion · No professional accreditation or certification</text>
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
        <BotanicalCorner className={`${styles.botanical} ${styles.topLeft}`} />
        <BotanicalCorner className={`${styles.botanical} ${styles.topRight}`} />
        <BotanicalCorner className={`${styles.botanical} ${styles.bottomLeft}`} />
        <BotanicalCorner className={`${styles.botanical} ${styles.bottomRight}`} />
        <div className={styles.artworkBody}>
          <Image className={styles.logo} src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" width={70} height={86} />
          <span className={styles.certificateBrand}>AMADUTOWN <span>ACCELERATED</span></span>
          <span className={styles.divider} aria-hidden="true" />
          <strong className={styles.certificateTitle}>Certificate of Completion</strong>
          <span className={styles.presented}>THIS CERTIFIES THAT</span>
          <strong className={styles.learner}>{credential?.learner_name || name.trim() || 'Your name'}</strong>
          <span className={styles.certificateCourse}>has completed all sixteen lessons of <em>Accelerated</em></span>
          <span className={styles.certificateDate}>{credential ? new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'Completion date added when claimed'}</span>
          <span className={styles.lowerDivider} aria-hidden="true" />
          <div className={styles.certification}>
            <div className={styles.issuer}><span>ISSUED BY</span><strong>AmaduTown</strong></div>
            <div className={styles.signature}><span className={styles.signatureLine} aria-hidden="true" /><strong>Vambah Sillah</strong><span>Owner, AmaduTown · Author, Accelerated</span></div>
          </div>
          <small>Course completion · No professional accreditation or certification</small>
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
    </> : status?.eligible ? <><p>All sixteen lessons are complete. Choose the name that will appear on your certificate. You cannot change it after claiming.</p><label className={styles.name}>Name on certificate<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" /></label><button type="button" className={styles.claim} disabled={busy || !name.trim()} onClick={() => void command('claim')}>Claim certificate</button></> : <p>Complete and save all sixteen lessons to claim your certificate. Your worksheet answers can stay private. <Link href="/accelerated/learningplan">Continue lessons</Link></p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>
}

function windowOrigin() { return typeof window === 'undefined' ? 'https://amadutown.com' : window.location.origin }

function BotanicalCorner({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 170 170" aria-hidden="true" dangerouslySetInnerHTML={{ __html: botanicalMarkup('currentColor') }} />
}
