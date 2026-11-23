'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Link2, RotateCcw, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { agentifiedCertificateSvg, certificateRecordId, type CertificateDetails } from './agentified-certificate-artwork'
import { COURSE_CERTIFICATE_FRAME } from './course-certificate-template'
import { AGENTIFIED_SHARE_LINKS, AGENTIFIED_SHARE_MESSAGE, AGENTIFIED_SHARE_TEXT, AGENTIFIED_SHARE_URL } from './agentified-certificate-share'
import styles from './AgentifiedCompletionCredential.module.css'

type Credential = CertificateDetails & { revision: number }
type Status = { available: boolean; eligible: boolean; completedCount: number; credential: Credential | null }
const demoDate = '2026-11-05T12:00:00.000Z'
const demoToken = 'f'.repeat(64)

function previewState(profileName: string | null | undefined): Status {
  const scene = new URLSearchParams(window.location.search).get('certificate')
  const learner = scene === 'long-name' ? 'Alexandria Nia Okafor-Washington Mensah-Diop Adeyemi Johnson-McKenzie Rivera' : (profileName?.trim() || 'Course Learner')
  if (scene === 'blocked') return { available: true, eligible: false, completedCount: 15, credential: null }
  if (['claimed', 'verified', 'revoked', 'long-name'].includes(scene || '')) return { available: true, eligible: true, completedCount: 16, credential: { learner_name: learner, completed_at: demoDate, verification_token: scene === 'verified' ? demoToken : null, revision: 1 } }
  return { available: true, eligible: true, completedCount: 16, credential: null }
}

export default function AgentifiedCompletionCredential({ profileName, preview = false }: { profileName?: string | null; preview?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [name, setName] = useState(profileName ?? '')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [manualCopy, setManualCopy] = useState(false)
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false)
  useEffect(() => { setNativeShareAvailable(typeof navigator.share === 'function') }, [])
  useEffect(() => {
    if (!preview || process.env.NODE_ENV === 'production') return
    const theme = new URLSearchParams(window.location.search).get('certificateTheme')
    if (theme !== 'dark' && theme !== 'light') return
    const wasDark = document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
    return () => { document.documentElement.classList.toggle('dark', wasDark) }
  }, [preview])
  useEffect(() => { if (profileName && !name) setName(profileName) }, [profileName, name])
  useEffect(() => {
    if (preview) { setStatus(previewState(profileName)); return }
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const response = await fetch('/api/agentified/member/credential', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (!response.ok) throw new Error('status')
        if (active) setStatus(await response.json())
      } catch { if (active) setNotice('Completion status is unavailable.') }
    }
    void load()
    return () => { active = false }
  }, [preview, profileName])
  async function command(action: 'claim' | 'revoke' | 'rotate') {
    if (preview) {
      if (action === 'claim') setStatus({ available: true, eligible: true, completedCount: 16, credential: { learner_name: name.trim() || 'Course Learner', completed_at: demoDate, verification_token: null, revision: 1 } })
      else setStatus((current) => current?.credential ? { ...current, credential: { ...current.credential, verification_token: action === 'rotate' ? demoToken : null, revision: current.credential.revision + 1 } } : current)
      setNotice(action === 'claim' ? 'Certificate ready to review.' : 'Verification state updated for this preview.')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setNotice('Sign in to manage your credential.'); return }
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/agentified/member/credential', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name: name.trim(), expectedRevision: status?.credential?.revision }),
      })
      const result = await response.json()
      if (!response.ok) { setNotice(result.error || 'Credential action could not be saved.'); return }
      const refresh = await fetch('/api/agentified/member/credential', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      if (!refresh.ok) throw new Error('refresh')
      setStatus(await refresh.json())
      setNotice(action === 'claim' ? 'Completion credential claimed.' : 'Verification link updated.')
    } catch { setNotice('Credential status is unavailable. Reload before trying again.') }
    finally { setBusy(false) }
  }
  if (status?.available === false) return null
  const credential = status?.credential
  const verificationUrl = credential?.verification_token ? `/agentified/verify/${credential.verification_token}` : null
  const certificate = agentifiedCertificateSvg(credential ?? null, name)
  async function download() {
    if (!credential) return
    setBusy(true); setNotice('')
    try {
      const [frameResponse, logoResponse, signatureResponse] = await Promise.all([fetch(COURSE_CERTIFICATE_FRAME), fetch('/amadutown-logo-upscaled.png'), fetch('/accelerated/vambah-signature.png')])
      if (!frameResponse.ok || !logoResponse.ok || !signatureResponse.ok) throw new Error('asset')
      const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const [frame, logo, signature] = await Promise.all([toDataUrl(await frameResponse.blob()), toDataUrl(await logoResponse.blob()), toDataUrl(await signatureResponse.blob())])
      const svg = agentifiedCertificateSvg(credential, name, { frame, logo, signature })
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'agentified-certificate-of-completion.svg'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Certificate downloaded.')
    } catch { setNotice('Certificate artwork could not be loaded. Try again.') }
    finally { setBusy(false) }
  }
  async function copyLink() {
    if (!verificationUrl || preview) return
    try { await navigator.clipboard.writeText(new URL(verificationUrl, window.location.origin).toString()); setNotice('Verification link copied.') }
    catch { setNotice('Copy is unavailable in this browser.') }
  }
  async function shareAchievement() {
    if (!credential || typeof navigator.share !== 'function') return
    setShareStatus(''); setManualCopy(false)
    try {
      await navigator.share({ title: 'Agentified workshop completion', text: AGENTIFIED_SHARE_TEXT, url: AGENTIFIED_SHARE_URL })
      setShareStatus('Share handoff completed. Review your destination to confirm the post.')
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === 'AbortError' ? 'Sharing canceled.' : 'Sharing is unavailable here. Copy the message or choose a platform.')
    }
  }
  async function copyAchievement() {
    if (!credential) return
    setShareStatus(''); setManualCopy(false)
    try {
      await navigator.clipboard.writeText(AGENTIFIED_SHARE_MESSAGE)
      setShareStatus('Complete message copied. Paste and review it before posting.')
    } catch {
      setManualCopy(true)
      setShareStatus('Automatic copy is unavailable. Select the message below to copy it manually.')
    }
  }
  return <section className={styles.card} aria-label="Agentified completion credential">
    <div className={styles.heading}><div><p className={styles.eyebrow}>AMADUTOWN · AGENTIFIED</p><h3>Workshop completion</h3></div><span className={styles.count}>{status?.completedCount ?? 0} / 16 lessons</span></div>
    {credential || status?.eligible ? <>
      <p className={styles.helper}>{credential ? 'Your completion is recorded. Download your certificate or manage its verification link.' : 'All sixteen lessons are complete. Review the name before you claim.'}</p>
      <div className={styles.certificate} role="img" aria-label={credential ? `Claimed Agentified completion certificate for ${credential.learner_name}` : 'Unclaimed Agentified completion certificate preview'} dangerouslySetInnerHTML={{ __html: certificate }} />
      <div className={styles.mobileDetails} aria-label="Certificate details"><strong>{credential?.learner_name || name.trim() || 'Your name'}</strong><span>Agentified · sixteen lessons</span><span>{credential ? new Date(credential.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date assigned when claimed'}</span></div>
      {credential ? <>
        <p className={styles.reference}>Certificate record ID <strong>{certificateRecordId(credential)}</strong></p>
        <div className={styles.actions} aria-label="Certificate actions">
          <button type="button" onClick={() => void download()} disabled={busy}><Download aria-hidden="true" /> Download certificate</button>
          {verificationUrl && !preview ? <><Link href={verificationUrl}>View verification</Link><button type="button" onClick={() => void copyLink()}><Link2 aria-hidden="true" /> Copy verification link</button></> : null}
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => void command(verificationUrl ? 'revoke' : 'rotate')}>{verificationUrl ? <ShieldOff aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}{verificationUrl ? 'Turn off verification link' : 'Create verification link'}</button>
        </div>
        <div className={styles.share} aria-label="Share your achievement">
          <h4>Share your achievement</h4>
          <p>Invite someone to learn how to build governed agent systems.</p>
          <div className={styles.shareActions}>
            {nativeShareAvailable && <button type="button" onClick={() => void shareAchievement()}>Share achievement</button>}
            <button type="button" onClick={() => void copyAchievement()}>{nativeShareAvailable ? 'Copy complete message' : 'Copy message to share'}</button>
            <a href={AGENTIFIED_SHARE_LINKS.linkedin} target="_blank" rel="noopener noreferrer" onClick={() => setShareStatus('LinkedIn opens with the workshop link. Paste the copied message if you want to include it.')}>LinkedIn <span className={styles.external} aria-hidden="true">↗</span></a>
            <a href={AGENTIFIED_SHARE_LINKS.facebook} target="_blank" rel="noopener noreferrer" onClick={() => setShareStatus('Facebook opens with the workshop link. Paste the copied message if you want to include it.')}>Facebook <span className={styles.external} aria-hidden="true">↗</span></a>
            <a href={AGENTIFIED_SHARE_LINKS.x} target="_blank" rel="noopener noreferrer" onClick={() => setShareStatus('X opens with a shorter message and the workshop link. Review it before posting.')}>X <span className={styles.external} aria-hidden="true">↗</span></a>
          </div>
          <p className={styles.shareHint}>LinkedIn and Facebook receive only the workshop link. Copy the complete message first if you want to include it.</p>
          {manualCopy && <label className={styles.manualCopy}>Message to copy<textarea readOnly value={AGENTIFIED_SHARE_MESSAGE} onFocus={(event) => event.currentTarget.select()} /></label>}
          {shareStatus && <p className={styles.shareStatus} role="status" aria-live="polite">{shareStatus}</p>}
        </div>
      </> : <><label className={styles.name}>Name on certificate<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" /></label><p className={styles.helper}>This name is fixed after you claim.</p><button type="button" className={styles.claim} disabled={busy || !name.trim()} onClick={() => void command('claim')}>Claim certificate</button></>}
      <p className={styles.disclaimer}>This records workshop completion. It is not a professional accreditation or certification.</p>
    </> : <p className={styles.helper}>Complete and save all sixteen Agentified lessons to claim your certificate. Your Operating File answers can stay private. <Link href="/agentified/learningplan">Continue lessons</Link></p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>
}
