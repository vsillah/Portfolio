import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Music2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import TrumpetRecruitmentPersonas from "@/components/TrumpetRecruitmentPersonas";
import TrumpetRecruitmentSocialCarousel from "@/components/TrumpetRecruitmentSocialCarousel";
import TrumpetRecruitmentTimeline from "@/components/TrumpetRecruitmentTimeline";

export const metadata: Metadata = {
  title: "Trumpet Trainer | The first practice step",
  description: "An early look at short, clear practice steps for beginning trumpet players and the adults who support them.",
  robots: { index: false, follow: false },
};

const audiencePlan = [
  { name: "Parents or guardians", role: "Parent or guardian", personName: "Avery", quote: "I need the next note before another reminder.", goal: "Start home practice calmly.", friction: "Reminders can become a struggle.", currentBehavior: "Keeps a timer and practice materials nearby.", proof: "Make the next note easy to find.", imageSrc: "/work/trumpet-trainer/personas/parent-guardian-v2.webp", imageAlt: "Fictional adult guardian arranging a timer beside trumpet practice materials at home" },
  { name: "Private trumpet tutors", role: "Private trumpet tutor", personName: "Morgan", quote: "What happens between lessons?", goal: "Keep practice going between lessons.", friction: "It is hard to know where a student got stuck.", currentBehavior: "Leaves a short assignment after each lesson.", proof: "Give a beginner one step to try alone.", imageSrc: "/work/trumpet-trainer/personas/private-tutor-v3.webp", imageAlt: "Fictional tutor compares annotated music with an almost blank practice record beside an empty student chair" },
  { name: "Band educators", role: "Band educator", personName: "Casey", quote: "One section, many different next steps.", goal: "Guide a room of new players.", friction: "Each student needs a different kind of help.", currentBehavior: "Teaches the section and answers questions as they come.", proof: "Help students find a starting point at home.", imageSrc: "/work/trumpet-trainer/personas/band-educator-v3.webp", imageAlt: "Fictional band educator holds several scores while responding to a crowded beginner rehearsal" },
  { name: "Community music programs", role: "Community program lead", personName: "Jordan", quote: "The instruments and hours are already shared.", goal: "Give more beginners time to practice.", friction: "Instruments, staff, and hours are limited.", currentBehavior: "Shares equipment and coordinates group time.", proof: "Keep the next practice step simple.", imageSrc: "/work/trumpet-trainer/personas/community-program-v3.webp", imageAlt: "Fictional community music organizers balance a thick request stack, limited loaner trumpets, and open cases" },
];

const practicePath = [
  { days: "1–2", title: "Find a starting point", detail: "Choose one short exercise instead of sorting through a whole lesson." },
  { days: "3–4", title: "Try a clear first note", detail: "Focus on a comfortable breath and one steady sound. Pause if playing feels strained." },
  { days: "5–7", title: "Practice a small pattern", detail: "Keep the session short enough to try again another day." },
  { days: "8–10", title: "Listen and adjust", detail: "Notice what feels easier and what still needs a teacher's ear." },
  { days: "11–12", title: "Bring one question", detail: "Ask a tutor, band teacher, or program leader about the part that still feels hard." },
  { days: "13–14", title: "Choose the next note", detail: "Return to a manageable exercise and build from there at your own pace." },
];

export default function TrumpetRecruitmentPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navigation />
      <div className="mx-auto max-w-6xl px-5 pt-28 sm:px-10 lg:px-12">
        <Link href="/work/trumpet-trainer" className="text-sm font-semibold text-bronze dark:text-radiant-gold underline underline-offset-4">← Back to Trumpet Trainer</Link>
        <header className="mt-10">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-bronze dark:text-radiant-gold">Trumpet Trainer</p>
          <h1 className="mt-4 max-w-4xl font-premium text-4xl leading-tight sm:text-6xl">A clearer first step for beginner trumpet practice.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">Opening the case is one step. Knowing what to play next is another. This early concept explores short practice steps a new player can follow between lessons.</p>
        </header>

        <section aria-labelledby="media" className="mt-10 sm:mt-12">
          <div><p className="font-heading text-xs uppercase tracking-[.2em] text-bronze dark:text-radiant-gold">See the practice path</p><h2 id="media" className="mt-2 font-premium text-3xl">Inside Trumpet Trainer</h2></div>
          <div className="mt-5 rounded-2xl border border-border bg-card p-3 sm:p-5"><video controls preload="metadata" playsInline poster="/showcases/trumpet-trainer/c19989a3/gameplay-poster.jpg" className="aspect-video w-full rounded-xl bg-imperial-navy object-contain" aria-label="Illustrative Trumpet Trainer gameplay"><source src="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4" type="video/mp4" />Your browser cannot play this video. The images below show the practice flow.</video><p className="mt-3 text-sm text-muted-foreground">The sound in this preview was generated for the demonstration. It does not show a student&apos;s progress.</p></div>
          <h3 className="mt-8 font-premium text-2xl">Seven moments from the app</h3>
          <TrumpetRecruitmentSocialCarousel />
        </section>

        <section aria-labelledby="audiences" className="mt-16">
          <h2 id="audiences" className="font-premium text-3xl">The adults around a new player</h2>
          <p className="mt-2 text-sm text-muted-foreground">Home, lessons, classrooms, and community programs each shape practice.</p>
          <TrumpetRecruitmentPersonas personas={audiencePlan} />
        </section>

        <section aria-labelledby="plan" className="mt-16">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-bronze dark:text-radiant-gold">One possible practice rhythm</p><h2 id="plan" className="mt-2 font-premium text-3xl">Six small steps over two weeks</h2>
          <div className="mt-6 sm:mt-7"><TrumpetRecruitmentTimeline steps={practicePath} /></div>
        </section>
      </div>
      <section aria-labelledby="cta-heading" className="relative isolate mt-20 overflow-hidden border-t border-radiant-gold/35 bg-imperial-navy text-white sm:mt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(229,185,90,0.16),transparent_45%)]" />
        <svg aria-hidden="true" viewBox="0 0 520 240" fill="none" className="pointer-events-none absolute right-0 top-0 hidden h-full w-[520px] max-w-none text-radiant-gold opacity-20 sm:block" preserveAspectRatio="xMidYMid slice">
          {[84, 102, 120, 138, 156].map((y) => <path key={y} d={`M0 ${y}h520`} stroke="currentColor" strokeWidth="1" />)}
          <path d="M363 114V45l56-13v75" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="348" cy="119" rx="17" ry="11" transform="rotate(-18 348 119)" fill="currentColor" />
          <ellipse cx="404" cy="112" rx="17" ry="11" transform="rotate(-18 404 112)" fill="currentColor" />
        </svg>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-10 sm:py-20 lg:flex-row lg:items-end lg:justify-between lg:px-12">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 font-heading text-xs uppercase tracking-[.2em] text-radiant-gold">Your next note <Music2 aria-hidden="true" className="h-4 w-4 sm:hidden" /></p>
            <h2 id="cta-heading" className="mt-4 font-premium text-4xl leading-tight sm:text-5xl">Ready to hear the next note?</h2>
            <p className="mt-4 text-lg leading-7 text-white/80">Open Trumpet Trainer and try one short practice step.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            <a href="https://trumpet-trainer-zeta.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-radiant-gold px-6 py-3 text-base font-semibold text-imperial-navy shadow-[0_8px_28px_rgba(0,0,0,0.18)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold" aria-label="Try Trumpet Trainer (opens the practice app in a new tab)">Try Trumpet Trainer <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
            <Link href="/work/trumpet-trainer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/45 px-6 py-3 text-base font-semibold text-white transition-colors hover:border-radiant-gold hover:text-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold">See the product story <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
