import type { Metadata } from 'next'
import { AcceleratedLearningPlan } from '@/app/service-prototypes/[slug]/AcceleratedLearningPlan'
import { AcceleratedHeader } from '../AcceleratedHeader'
import styles from '../accelerated.module.css'

export const metadata: Metadata = { title: 'Accelerated Decision File | AmaduTown', description: 'A sixteen-page working file for carrying one decision through the Accelerated workshop.' }

export default function AcceleratedDecisionFilePage() {
  return <main className={styles.coursePage}><AcceleratedHeader /><div className={styles.courseSurface}><AcceleratedLearningPlan mode="decision-file" /></div></main>
}
