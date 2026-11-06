import Image from 'next/image'
import Link from 'next/link'
import styles from './accelerated.module.css'

export function AcceleratedHeader() {
  return <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="AmaduTown home">
      <Image src="/amadutown-logo-upscaled.png" alt="" width={29} height={38} priority />
      <span>AmaduTown<small>Accelerated</small></span>
    </Link>
    <nav aria-label="Accelerated navigation">
      <Link href="/accelerated">The book</Link>
      <Link href="/accelerated/learningplan">Learning plan</Link>
      <Link href="/accelerated/decision-file">Decision File</Link>
      <Link href="/services">Services</Link>
    </nav>
  </header>
}
