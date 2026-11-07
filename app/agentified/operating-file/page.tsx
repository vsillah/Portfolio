import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import { AgentifiedWorkshop } from '../AgentifiedWorkshop'

export const metadata: Metadata = { title: 'Agentified Operating File | AmaduTown', description: 'Carry each lesson output into one working file.' }
export default function Page() { return <main className="min-h-screen bg-background text-foreground"><Navigation /><div className="pt-24"><AgentifiedWorkshop mode="file" /></div></main> }
