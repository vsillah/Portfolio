'use client'

import { useEffect, useRef, useState } from 'react'
import { certificateShare, certificateSharePayload, type CertificateShareCourse } from '@/lib/course-certificate-share'
import { SocialBrandMark } from './social-brand-marks'
import styles from './CourseCertificateShare.module.css'

export default function CourseCertificateShare({ course }: { course: CertificateShareCourse }) {
  const config = certificateShare[course]
  const { message, links } = certificateSharePayload(config)
  const [status, setStatus] = useState('')
  const [retryPlatform, setRetryPlatform] = useState<'LinkedIn' | 'Facebook' | null>(null)
  const [manualCopy, setManualCopy] = useState(false)
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const handoff = useRef(0)
  const retryInFlight = useRef(false)
  useEffect(() => { setNativeAvailable(typeof navigator.share === 'function') }, [])

  async function nativeShare() {
    const attempt = ++handoff.current
    setRetryPlatform(null); setManualCopy(false); setStatus('')
    try {
      await navigator.share({ title: config.title, text: config.achievementText, url: config.publicUrl })
      if (attempt === handoff.current) setStatus('Share handoff completed. Review your destination to confirm the post.')
    } catch (error) {
      if (attempt === handoff.current) setStatus(error instanceof DOMException && error.name === 'AbortError' ? 'Sharing canceled.' : `Sharing is unavailable here. Choose a platform to share the ${config.linkLabel}.`)
    }
  }
  function platformShare(platform: 'LinkedIn' | 'Facebook') {
    const attempt = ++handoff.current
    setRetryPlatform(null); setManualCopy(false)
    setStatus(`Opening ${platform} with the ${config.linkLabel}. Trying to copy your message…`)
    const copied = () => { if (attempt === handoff.current) setStatus(`Message copied. Paste and review it before posting on ${platform}.`) }
    const failed = () => { if (attempt === handoff.current) { setRetryPlatform(platform); setStatus(`Message could not be copied. ${platform} opened with the ${config.linkLabel}. Retry copying your message below.`) } }
    try { void navigator.clipboard.writeText(message).then(copied, failed) } catch { failed() }
  }
  async function retryCopy() {
    if (!retryPlatform || retryInFlight.current) return
    retryInFlight.current = true
    const platform = retryPlatform
    const attempt = ++handoff.current
    setRetryPlatform(null); setStatus('Trying to copy your message again…')
    try {
      await navigator.clipboard.writeText(message)
      if (attempt === handoff.current) setStatus(`Message copied. Paste and review it before posting on ${platform}.`)
    } catch {
      if (attempt === handoff.current) { setManualCopy(true); setStatus('Automatic copy is still unavailable. Select the message below to copy it manually.') }
    } finally { retryInFlight.current = false }
  }
  return <div className={styles.share} aria-label="Share your achievement">
    <h4>Share your achievement</h4>
    <p>{config.invitation}</p>
    <div className={styles.actions}>
      {nativeAvailable && <button type="button" onClick={() => void nativeShare()}>Share achievement</button>}
      <a href={links.linkedin} aria-label="Share on LinkedIn" title="Share on LinkedIn (opens a new tab)" data-tooltip="Share on LinkedIn" target="_blank" rel="noopener noreferrer" onClick={() => platformShare('LinkedIn')}><SocialBrandMark platform="linkedin" /></a>
      <a href={links.facebook} aria-label="Share on Facebook" title="Share on Facebook (opens a new tab)" data-tooltip="Share on Facebook" target="_blank" rel="noopener noreferrer" onClick={() => platformShare('Facebook')}><SocialBrandMark platform="facebook" /></a>
      <a href={links.x} aria-label="Share on X" title="Share on X (opens a new tab)" data-tooltip="Share on X" target="_blank" rel="noopener noreferrer" onClick={() => { ++handoff.current; setRetryPlatform(null); setManualCopy(false); setStatus(`X opens with a shorter message and the ${config.linkLabel}. Review it before posting.`) }}><SocialBrandMark platform="x" /></a>
    </div>
    <p className={styles.hint}>LinkedIn and Facebook receive only the {config.linkLabel}. Your message is copied to your clipboard when possible; paste and review it yourself.</p>
    {status && <p className={styles.status} role="status" aria-live="polite">{status}</p>}
    {retryPlatform && <button type="button" className={styles.retry} onClick={() => void retryCopy()}>Retry copying message</button>}
    {manualCopy && <label className={styles.manual}>Message to copy<textarea readOnly value={message} onFocus={(event) => event.currentTarget.select()} /></label>}
  </div>
}
