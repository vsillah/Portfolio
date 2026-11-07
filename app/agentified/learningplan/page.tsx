import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import { AgentifiedWorkshop } from '../AgentifiedWorkshop'

export const metadata: Metadata = { title: 'Agentified Learning Plan | AmaduTown', description: 'Sixteen lessons and one practical Operating File.' }
export default function Page() { return <main className="min-h-screen bg-background text-foreground"><Navigation /><div className="pt-24"><AgentifiedWorkshop mode="plan" /></div></main> }
