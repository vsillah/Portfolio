'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { WEBSITE_COMPANY_NAME } from '@/lib/website-brand'
import { evolution, glossary, guideSections, roleChecklists, toolGroups, workday } from './staff-guide-content'
import styles from './staff-guide.module.css'

function GuideSection({ index, printMode, children }: { index: number; printMode: boolean; children: ReactNode }) {
  const section = guideSections[index]
  const heading = <><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span><span className={styles.sectionTitle}>{section.title}</span><span className={styles.hint}>{section.hint}</span></span></>
  return printMode ? (
    <section id={section.id} className={styles.section}><h2 className={styles.sectionHeading}>{heading}</h2><div className={styles.sectionBody}>{children}</div></section>
  ) : (
    <details id={section.id} className={styles.section}><summary>{heading}</summary><div className={styles.sectionBody}>{children}</div></details>
  )
}

export default function StaffGuide({ printMode = false }: { printMode?: boolean }) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const openHash = () => {
      const section = root.current?.querySelector<HTMLDetailsElement>(`details[id="${window.location.hash.slice(1).replace(/[^a-z-]/g, '')}"]`)
      if (section) { section.open = true; section.scrollIntoView({ block: 'start' }) }
    }
    let closed: HTMLDetailsElement[] = []
    const beforePrint = () => {
      closed = Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('details:not([open])') ?? [])
      closed.forEach(section => { section.open = true })
    }
    const afterPrint = () => { closed.forEach(section => { section.open = false }); closed = [] }
    openHash()
    window.addEventListener('hashchange', openHash)
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('hashchange', openHash)
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [])

  return (
    <article ref={root} className={styles.guide} aria-label="Staff onboarding guide">
      <div className={styles.toolbar}>
        <Link href={printMode ? '/help/staff' : '/help'}>{printMode ? '← Interactive guide' : '← Help center'}</Link>
        {printMode ? <button type="button" onClick={() => window.print()}>Print / Save as PDF</button> : <Link href="/help/staff/print" className={styles.printLink}>Print / Save as PDF</Link>}
      </div>
      <header className={styles.welcome}>
        <div className={styles.brand}><Image src="/amadutown-logo-upscaled.png" alt="AmaduTown shield" width={55} height={80} priority className={styles.logo} /><p>{WEBSITE_COMPANY_NAME}</p></div>
        <p className={styles.eyebrow}>STAFF FIELD GUIDE · START HERE</p>
        <h1>A place to learn.<br />A clear way to help.</h1>
        <p className={styles.lead}>Portfolio is our shared business workspace. We use it to organize client work, review AI-assisted drafts, and track what happened.</p>
        <p>Start by reading, checking, and asking questions. Your supervisor will guide your first assignment.</p>
        <div className={styles.startRow}><a href="#first-week" onClick={() => { const section = root.current?.querySelector<HTMLDetailsElement>('#first-week'); if (section && !printMode) section.open = true }}>Start your first week <span aria-hidden>↗</span></a><span>Read first. Practice with your supervisor.</span></div>
      </header>
      <aside className={styles.reminder}><strong>Your first responsibility: check before acting.</strong><p>This guide grants no account access or approval authority. Use practice examples until your supervisor assigns real work.</p></aside>
      {printMode && <p className={styles.printNote}>All sections are expanded. Choose Print / Save as PDF, select your browser’s PDF destination, and save locally. Checklist marks are for this reading session only.</p>}
      <div className={styles.sections}>
        <GuideSection index={0} printMode={printMode}>
          <p>Portfolio grew around the work the business needed to do. Read this as a map of capabilities, rather than a dated company history.</p>
          <ol className={styles.evolution}>{evolution.map(([title, text], i) => <li key={title}><span className={styles.stepLabel}>Stage {i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
          <div className={styles.relationship}><strong>Today’s working loop</strong><p>People and requests → Portfolio → assigned agents or n8n workflows → human review → authorized execution → receipt back in Portfolio.</p><p>Supabase holds operational records. Approved learning can move into Open Brain. Communication and payment tools carry out their own bounded parts of the work.</p></div>
        </GuideSection>
        <GuideSection index={1} printMode={printMode}>
          <p>A practice example: helping a fictional client organize follow-up. Read each step with your supervisor before trying a real request.</p>
          <ol className={styles.flow}>{workday.map(([title, text], i) => <li key={title}><span className={styles.number}>{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
          <p className={styles.callout}>If a step is blocked, keep the work there and ask its owner. A missing receipt is a reason to investigate before retrying.</p>
        </GuideSection>
        <GuideSection index={2} printMode={printMode}>
          <div className={styles.twoColumn}>
            <div><h3>Safe ways to begin</h3><ul><li>Read assigned material and compare a draft with its source.</li><li>Practice with synthetic examples and record clear review notes.</li><li>Ask who owns the next decision and what evidence they need.</li></ul></div>
            <div><h3>Separate permission is required</h3><ul><li>Creating a Gmail draft, sending email or SMS, posting a public reply, publishing, and scheduling.</li><li>Activating a provider, changing credentials, billing, access permissions, or production data.</li><li>Moving private material into another tool, public content, or durable memory.</li></ul></div>
          </div>
          <h3>What never follows automatically from a draft</h3><p>An AI recommendation, a “ready” label, a test result, or a general “proceed” does not grant send authority. Approval must match the action and its scope. An approved workflow may later execute automatically within those limits.</p>
          <h3>When work is marked “no egress”</h3><p>Keep that task’s information and actions inside its stated boundary. Do not send messages, upload client material, or call an outside provider from that task. Ask the owner before changing its scope.</p>
          <p className={styles.callout}>Keep passwords, tokens, private chats, and raw client details out of review notes and screenshots. Use the approved access process and share only the minimum information needed.</p>
        </GuideSection>
        <GuideSection index={3} printMode={printMode}>
          <p>Begin with Support and coordination unless your supervisor assigns another role. These checklists describe practice, not new permissions. Marks reset when you leave or reload this page.</p>
          {Object.entries(roleChecklists).map(([role, tasks]) => <section className={styles.role} key={role}><h3>{role}</h3><ul className={styles.checklist}>{tasks.map(task => <li key={task}><label><input type="checkbox" /><span>{task}</span></label></li>)}</ul></section>)}
          <p className={styles.callout}>Ready for real work? Have your supervisor confirm your scope, access, and escalation contact before the first assignment.</p>
        </GuideSection>
        <GuideSection index={4} printMode={printMode}>
          <p>Each tool has a job. You do not need to learn every tool to help with the work.</p>
          <div className={styles.stackMap} aria-label="System relationships"><div><strong>People</strong><span>Request · review · authorize</span></div><span aria-hidden>↓</span><div><strong>Portfolio</strong><span>Coordinate work and inspect outcomes</span></div><span aria-hidden>↕</span><div><strong>Records + workflows + services</strong><span>Supabase · n8n · approved providers</span></div><p>GitHub and Codex support changes → Vercel hosts the app.<br />Reviewed learning → Open Brain → Portfolio’s memory view.</p></div>
          <p className={styles.callout}>Repo evidence reviewed October 1, 2026. This is a capability map, not a live service-status report. Account access, provider activation, and availability must be confirmed by the owner.</p>
          <div className={styles.toolGrid}>{toolGroups.map(group => <section key={group.category} className={styles.toolGroup}><h3>{group.category}</h3><dl>{group.tools.map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}</dl></section>)}</div>
        </GuideSection>
        <GuideSection index={5} printMode={printMode}>
          <div className={styles.recovery}><h3>Cannot sign in or see a workspace?</h3><p>Confirm you opened the link your supervisor provided and used the assigned account. Ask your supervisor to confirm your role and invitation. Never request someone else’s password.</p><h3>An action is blocked or a result is missing?</h3><p>Read the reason shown. Note the page, time, safe item ID, expected result, and exact error without private data. Send those details through your approved internal support channel to the work owner or Vambah. If a send or payment may have happened, wait for the owner to check its receipt before retrying.</p><h3>Something looks private or unsafe?</h3><p>Stop the action. Avoid copying or forwarding the material. Ask Vambah or the assigned supervisor to review the access or privacy concern.</p><h3>Need a printable copy?</h3><p>Open Print / Save as PDF at the top of this guide, then choose your browser’s PDF destination. Save locally; review the file before sharing it.</p></div>
          <h3>Words you will see</h3><dl className={styles.glossary}>{glossary.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl>
          <p><Link href="/help">General site help</Link> · <Link href="/admin/help">Operator procedures (admin access required)</Link></p>
        </GuideSection>
      </div>
      <footer className={styles.footer}><p>{WEBSITE_COMPANY_NAME} · Staff onboarding</p><p>Client-safe orientation. No client records, credentials, or live operational data are included.</p></footer>
    </article>
  )
}
