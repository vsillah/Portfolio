import type { Metadata } from 'next'
import { AcceleratedLearningPlan } from '@/app/service-prototypes/[slug]/AcceleratedLearningPlan'
import { AcceleratedHeader } from '../AcceleratedHeader'
import styles from '../accelerated.module.css'

export const metadata: Metadata = { title: 'Accelerated Learning Plan | AmaduTown', description: 'Sixteen guided lessons and one practical Decision File.' }

export default function AcceleratedLearningPlanPage() {
  return <main className={styles.coursePage}><AcceleratedHeader /><div className={styles.courseSurface}><AcceleratedLearningPlan /></div></main>
}
