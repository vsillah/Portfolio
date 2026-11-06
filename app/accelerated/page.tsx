import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, FileText, PlayCircle } from 'lucide-react'
import { AcceleratedHeader } from './AcceleratedHeader'
import styles from './accelerated.module.css'

export const metadata: Metadata = {
  title: 'Accelerated: Building Smarter Products with AI | AmaduTown',
  description: 'Read the ideas, take the sixteen-lesson learning plan, and build a practical Decision File with AmaduTown.',
}

const acts = [
  { name: 'Signals', line: 'Turn noise, feedback, and open questions into something your team can test.' },
  { name: 'Alignment', line: 'Carry the evidence into a shared plan, a clear owner, and a decision.' },
  { name: 'Momentum', line: 'Build a learning loop that makes the next decision better than the last.' },
]

export default function AcceleratedPage() {
  return <main className={styles.page}>
    <AcceleratedHeader />
    <section className={styles.hero} aria-labelledby="accelerated-title">
      <Image className={styles.heroImage} src="/showcases/service-photographic/accelerated-cohort-workshop-hero.jpg" alt="A diverse workshop group working together around laptops and printed materials" fill priority sizes="100vw" />
      <div className={styles.heroShade} />
      <div className={styles.heroContent}>
        <div className={styles.bookLockup}><Image src="/accelerated_cover_ebook.jpg" alt="Accelerated: Building Smarter Products with AI book cover" width={210} height={315} priority /></div>
        <div>
          <p className={styles.eyebrow}>A book and working system from AmaduTown</p>
          <h1 id="accelerated-title">Accelerated</h1>
          <p className={styles.subtitle}>Building Smarter Products with AI</p>
          <p className={styles.heroCopy}>AI can make output faster. The harder work is helping a team decide what matters, learn from evidence, and keep people responsible for the judgment.</p>
          <div className={styles.heroActions}><a className={styles.primary} href="https://www.amazon.com/Accelerated-Building-Smarter-Products-AI/dp/B0GQPK27TH" target="_blank" rel="noopener noreferrer"><BookOpen size={18} />Get the book on Amazon</a><Link className={styles.secondaryLight} href="/accelerated/learningplan"><PlayCircle size={18} />Start the learning plan</Link><Link className={styles.secondaryLight} href="/accelerated/decision-file"><FileText size={18} />Open your Decision File</Link></div>
        </div>
      </div>
    </section>

    <section className={styles.bookSection}>
      <div className={styles.sectionLabel}>The book</div>
      <div className={styles.bookGrid}><h2>Move from faster output to <em>better decisions.</em></h2><div><p>Accelerated is for product leaders, builders, and teams trying to use AI without losing the people, evidence, and operating discipline that make the work trustworthy.</p><p>The book follows three connected acts. Each one becomes a practical part of the workshop and the Decision File you carry through it.</p></div></div>
      <div className={styles.actList}>{acts.map((act, index) => <article key={act.name}><span>0{index + 1}</span><h3>{act.name}</h3><p>{act.line}</p></article>)}</div>
    </section>

    <section className={styles.systemSection}>
      <div className={styles.systemImage}><Image src="/showcases/service-prototypes/accelerated-sam-infographic.png" alt="Signals, Alignment, Momentum framework from Accelerated" fill sizes="(max-width: 800px) 100vw, 48vw" /></div>
      <div className={styles.systemCopy}><p className={styles.eyebrow}>Read it. Work it. Keep it.</p><h2>The book becomes a learning system.</h2><p>Sixteen guided lessons help you work through one decision. The Decision File keeps the questions, evidence, tradeoffs, and next move together as you go.</p><div className={styles.pathList}><Link href="/accelerated/learningplan"><PlayCircle size={21} /><span><strong>Learning plan</strong><small>Watch the lessons and work through the exercises.</small></span><ArrowRight size={18} /></Link><Link href="/accelerated/decision-file"><FileText size={21} /><span><strong>Decision File</strong><small>See all sixteen workbook pages in one place.</small></span><ArrowRight size={18} /></Link><Link href="/services"><BookOpen size={21} /><span><strong>Work with AmaduTown</strong><small>Explore guided workshops, advising, and implementation support.</small></span><ArrowRight size={18} /></Link></div></div>
    </section>

    <footer className={styles.footer}><div><Image src="/amadutown-logo-upscaled.png" alt="AmaduTown" width={38} height={50} /><p>Practical systems for building with AI while keeping human judgment in the work.</p></div><Link href="/accelerated/learningplan">Begin with one decision <ArrowRight size={18} /></Link></footer>
  </main>
}
