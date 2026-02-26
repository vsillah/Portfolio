import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import DocViewer from '@/components/DocViewer'
import BackToTopLink from '@/components/BackToTopLink'
import Navigation from '@/components/Navigation'

const DOC_PATH = path.join(process.cwd(), 'docs', 'user-help-guide.md')

export default async function HelpPage() {
  let content: string
  try {
    content = await readFile(DOC_PATH, 'utf-8')
  } catch {
    content = '# Help\n\nDocument could not be loaded. Ensure `docs/user-help-guide.md` exists.'
  }

  return (
    <main className="min-h-screen bg-imperial-navy relative overflow-hidden">
      <Navigation />
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-radiant-gold/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-bronze/5 blur-[120px] rounded-full pointer-events-none" />

      <section className="relative z-10 pt-28 pb-20 px-6 sm:px-10 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-platinum-white/50 hover:text-radiant-gold transition-colors text-sm font-heading uppercase tracking-widest mb-8"
          >
            <ArrowLeft size={14} />
            <span>Home</span>
          </Link>
          <Breadcrumbs
            items={[
              { label: 'Help' },
            ]}
          />
          <div id="help-top" className="mt-6 p-8 sm:p-10 rounded-2xl bg-silicon-slate/20 backdrop-blur-md border border-radiant-gold/10">
            <DocViewer content={content} topAnchorId="help-top" />
            <p className="mt-8 pt-6 border-t border-radiant-gold/10">
              <BackToTopLink anchorId="help-top" />
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
