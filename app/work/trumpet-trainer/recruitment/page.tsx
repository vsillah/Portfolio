import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:px-10 lg:px-12">
        <Link href="/work/trumpet-trainer" className="text-sm font-semibold text-bronze dark:text-radiant-gold underline underline-offset-4">← Back to Trumpet Trainer</Link>
        <header className="mt-10">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-bronze dark:text-radiant-gold">Trumpet Trainer</p>
          <h1 className="mt-4 max-w-4xl font-premium text-4xl leading-tight sm:text-6xl">A clearer first step for beginner trumpet practice.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">Opening the case is one step. Knowing what to play next is another. This early concept explores short practice steps a new player can follow between lessons.</p>
          <p className="mt-5 max-w-2xl rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">This is a concept preview for adults who support beginner players. Tester sign-ups are not open.</p>
        </header>

        <section aria-labelledby="media" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-heading text-xs uppercase tracking-[.2em] text-bronze dark:text-radiant-gold">See the practice path</p><h2 id="media" className="mt-2 font-premium text-3xl">Inside Trumpet Trainer</h2></div><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Illustrative gameplay</span></div>
          <div className="mt-5 rounded-2xl border border-border bg-card p-3 sm:p-5"><video controls preload="metadata" playsInline poster="/showcases/trumpet-trainer/c19989a3/gameplay-poster.jpg" className="aspect-video w-full rounded-xl bg-imperial-navy object-contain" aria-label="Illustrative Trumpet Trainer gameplay"><source src="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4" type="video/mp4" />Your browser cannot play this video. The images below show the practice flow.</video><p className="mt-3 text-sm text-muted-foreground">This example uses synthetic audio. No student or customer was recorded, and the result shown is one test run.</p></div>
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
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">An example path, not a fixed schedule or a promise of progress.</p>
          <div className="mt-8"><TrumpetRecruitmentTimeline steps={practicePath} /></div>
        </section>

        <footer className="mt-16 border-t border-border pt-8">
          <Link href="/work/trumpet-trainer" className="text-sm font-semibold text-bronze dark:text-radiant-gold underline underline-offset-4">Back to Trumpet Trainer →</Link>
        </footer>
      </div>
    </main>
  );
}
