import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navigation from "@/components/Navigation";
import TrumpetRecruitmentMessages from "@/components/TrumpetRecruitmentMessages";
import { BookOpen, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Trumpet Trainer | Recruitment review packet",
  description: "Internal review packet for a proposed adult-only Trumpet Trainer study. No campaign is active.",
  robots: { index: false, follow: false },
};

const workUrl = "https://amadutown.com/work/trumpet-trainer";
const messages = [
  {
    label: "page blurb",
    audience: "Landing-page share",
    text: `“Go practice” is easy to say. Starting can be harder. Trumpet Trainer is an early web app concept built around short beginner trumpet sessions, a clear next note, and room to move at a comfortable pace. We are asking adults who support new players to review the concept and tell us what works or gets in the way. There is no enrollment or purchase on the page. ${workUrl}`,
  },
  {
    label: "LinkedIn caption",
    audience: "LinkedIn carousel companion",
    text: `“Go practice.” A beginner gets home, opens the case, and still has to decide where to start.\n\nA parent may not play trumpet. A tutor may see the student once a week. The next few minutes still matter.\n\nI built Trumpet Trainer around a small question: can a short, visible practice step make starting easier without adding work for the adults around a new player? The carousel shows the current product flow, captured with synthetic audio. It does not prove learning outcomes.\n\nI am looking for candid feedback from parents or guardians, private trumpet tutors, band educators, and community music program leads. What part of between-lesson practice is hardest to support?\n\nReview the concept: ${workUrl}\n\n#MusicEducation #Trumpet #ProductDesign`,
  },
  {
    label: "community post",
    audience: "Parent or community group, only where rules allow",
    text: `A beginner can enjoy trumpet and still get stuck when it is time to practice at home. I am working on Trumpet Trainer, a small web app concept with short steps for those first few minutes.\n\nI would value feedback from adults who support a new trumpet player: what makes practice hard to start, and what would make a tool like this useful? The page shows the current flow and prepares an optional email draft for adults. There is no purchase or enrollment. Please share no child details in replies.\n\n${workUrl}`,
  },
  {
    label: "educator email",
    audience: "Private tutor or band educator email",
    text: `Subject: A question about beginner trumpet practice between lessons\n\nHello [adult name],\n\nI am shaping Trumpet Trainer around a short practice path for beginning players. I would value your critique of the flow: where might it help a student start, and where might it conflict with the way you teach?\n\nThe current product study is here: ${workUrl}\n\nThis is an exploratory request for adult feedback. I am not asking for student data, a school endorsement, or a rollout. If it is relevant, would you be open to a brief conversation?\n\nVambah Sillah\nAmaduTown Advisory Solutions\nAmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.\nhttps://amadutown.com`,
  },
  {
    label: "direct message",
    audience: "Short message to a known adult contact",
    text: `I am exploring a short beginner-trumpet practice path and would value your honest read of the concept. Where does between-lesson practice usually get stuck? The current flow is here: ${workUrl} No commitment, and please share no student details.`,
  },
  {
    label: "follow-up",
    audience: "One follow-up, only where permitted",
    text: `Following up once on the Trumpet Trainer concept I shared. If you support a beginner player, I would welcome one practical reaction: which step looks useful, and which would you change? If it is not relevant, no reply is needed and I will leave it there. ${workUrl}`,
  },
];

const audiencePlan = [
  { name: "Parents or guardians", headline: "Practice can start before the reminder turns into an argument.", support: "See whether one clear next note makes home practice easier to begin.", channel: "Opt-in through the public work page or a rules-permitted community post." },
  { name: "Private trumpet tutors", headline: "Keep the lesson moving after the lesson ends.", support: "Test a short practice path beginners can follow between sessions.", channel: "Known relationship or individually reviewed public professional channel." },
  { name: "Band educators", headline: "Give first-year players one clear next note between rehearsals.", support: "See whether guided, bite-sized practice fits your program.", channel: "Known relationship or official staff contact path, subject to institution rules." },
  { name: "Community music programs", headline: "Help more beginners practice without adding another complicated system.", support: "Review a browser-based path for short sessions and adult oversight.", channel: "Public organization contact route after staff review." },
];

const schedule = [
  { days: "1–2", title: "Check the score", detail: "Verify the live product page and media. Review copy, group rules, and adult-only boundaries. No posting." },
  { days: "3–4", title: "Share, if approved", detail: "After separate approval, consider one organic LinkedIn carousel and up to five individual invitations to known adults. No automated invitations." },
  { days: "5–7", title: "Listen for friction", detail: "Review aggregate visits and volunteered adult replies. Ask broad practice questions; log objections and stop signals without child details." },
  { days: "8–10", title: "Try one more channel", detail: "Only if rules and approval allow: one community post with admin permission, or up to three tutor, educator, or program introductions through legitimate staff channels." },
  { days: "11–12", title: "Follow up once", detail: "At most one respectful follow-up after 5–7 days, only where channel rules and the prior relationship allow. Never follow up after a decline." },
  { days: "13–14", title: "Choose the next note", detail: "Summarize role and channel counts, fit, friction, access, and privacy signals. Decide whether to revise, pause, or propose a separately approved pilot." },
];

export default function RecruitmentReviewPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navigation />
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:px-10 lg:px-12">
        <Link href="/work/trumpet-trainer" className="text-sm font-semibold text-radiant-gold underline underline-offset-4">← View the live product study</Link>
        <header className="mt-10">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-radiant-gold">Internal review · recruitment inactive</p>
          <h1 className="mt-4 max-w-4xl font-premium text-4xl leading-tight sm:text-6xl">A small test of the first practice step.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-muted-foreground">Can a clearer first note make practice easier to start? We want the adults around beginner players to tell us.</p>
          <div aria-label="Pilot at a glance" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["14", "days proposed"], ["$0", "budget"], ["4", "adult perspectives"], ["Off", "no recruitment active"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-radiant-gold/30 bg-card px-4 py-4"><strong className="block font-premium text-3xl text-radiant-gold">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></div>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">This page sends nothing, stores no contacts, and enrolls no one.</p>
        </header>

        <section aria-labelledby="media" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-heading text-xs uppercase tracking-[.2em] text-radiant-gold">See the practice path</p><h2 id="media" className="mt-2 font-premium text-3xl">Actual product screens</h2></div><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Synthetic test input · review only</span></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-border bg-card p-4"><Image src="/showcases/trumpet-trainer/c19989a3/01-home.webp" alt="Trumpet Trainer home screen from the synthetic gameplay capture" width={824} height={1720} className="mx-auto max-h-96 w-auto rounded-xl" /><p className="mt-3 text-sm text-muted-foreground">First of seven captured screens. <Link href="/work/trumpet-trainer" className="text-radiant-gold underline">Review the full carousel</Link>.</p></div>
            <div className="min-w-0 self-start rounded-2xl border border-border bg-card p-4"><video controls preload="none" playsInline poster="/showcases/trumpet-trainer/c19989a3/gameplay-poster.jpg" className="aspect-video w-full rounded-xl bg-imperial-navy" aria-label="Synthetic Trumpet Trainer gameplay"><source src="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4" type="video/mp4" /></video><p className="mt-3 text-sm text-muted-foreground">Captioned gameplay. No child or customer recording.</p></div>
          </div>
          <details className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Media source and claim limits</summary><p className="mt-3 leading-6">Screens and video come from Trumpet Trainer commit <code>c19989a3b156ce97326e35b335e169014ca076f3</code> with synthetic audio input. The displayed result is one deterministic test run, not a learning outcome claim. Publication remains gated.</p></details>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-premium text-2xl">Seven-slide social carousel</h3><span className="text-xs text-muted-foreground">Approved review assets · scroll to inspect</span></div>
          <div className="mt-4 flex max-w-full snap-x gap-4 overflow-x-auto pb-4" aria-label="Trumpet Trainer social carousel slides">
            {Array.from({ length: 7 }, (_, index) => {
              const slide = String(index + 1).padStart(2, "0");
              return <figure key={slide} className="w-60 shrink-0 snap-start rounded-2xl border border-border bg-card p-2 sm:w-72"><Image src={`/showcases/trumpet-trainer/c19989a3/social/slide-${slide}.png`} alt={`Social carousel slide ${index + 1} of 7`} width={1080} height={1350} className="w-full rounded-xl" /><figcaption className="px-2 py-2 text-sm text-muted-foreground">Slide {index + 1} of 7</figcaption></figure>;
            })}
          </div>
          <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Carousel provenance</summary><p className="mt-2">These slides are the existing approved review assets, copied byte-for-byte from <code>docs/qa/trumpet-trainer-gameplay/social/</code>. No publication is active.</p></details>
        </section>

        <section aria-labelledby="audiences" className="mt-16">
          <h2 id="audiences" className="font-premium text-3xl">Four adult perspectives</h2>
          <p className="mt-2 text-sm text-muted-foreground">Each role sees a different part of the same practice moment.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audiencePlan.map(({ name, headline, support, channel }) => <article key={name} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5"><h3 className="font-heading text-xs uppercase tracking-[.1em] text-radiant-gold">{name}</h3><p className="mt-5 font-premium text-xl leading-snug">{headline}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{support}</p><details className="mt-auto pt-5 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer">Contact path</summary><p className="mt-2">{channel}</p></details></article>)}
          </div>
        </section>

        <section aria-labelledby="plan" className="mt-16">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-radiant-gold">A proposed rhythm, pending approval</p><h2 id="plan" className="mt-2 font-premium text-3xl">14 days, six steps</h2>
          <div className="relative mt-8">
            <span aria-hidden="true" className="pointer-events-none absolute -top-10 left-2 z-0 font-serif text-[8rem] leading-none text-radiant-gold/30 lg:left-1/2 lg:-translate-x-1/2">𝄞</span>
            <svg aria-hidden="true" viewBox="0 0 100 600" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-5 top-0 h-full w-10 text-radiant-gold/50 lg:left-1/2 lg:w-14 lg:-translate-x-1/2"><path d="M54 2 C5 52 9 113 55 125 C104 138 98 193 51 206 C5 220 8 280 53 293 C96 309 96 366 51 380 C9 393 10 446 54 461 C97 477 88 526 51 542 L50 600" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><path d="M10 67 H92 M10 79 H92 M10 91 H92 M10 103 H92 M10 115 H92" stroke="currentColor" strokeWidth="1.3" opacity=".5" /></svg>
            <ol className="relative space-y-5">
              {schedule.map(({ days, title, detail }, index) => <li key={days} className={`relative grid min-h-36 grid-cols-[3.5rem_1fr] items-center gap-3 lg:grid-cols-[1fr_5rem_1fr] lg:gap-5`}>
                <div className={`hidden lg:block ${index % 2 === 0 ? "col-start-1 row-start-1" : "col-start-3 row-start-1"}`}>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Days {days}</span><h3 className="mt-1 font-premium text-xl">{title}</h3><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Review details</summary><p className="mt-2 leading-6">{detail}</p></details></div>
                </div>
                <span aria-hidden="true" className="relative z-10 col-start-1 row-start-1 mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-radiant-gold bg-background font-premium text-lg text-radiant-gold lg:col-start-2">{index + 1}</span>
                <div className="col-start-2 row-start-1 rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden"><span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Days {days}</span><h3 className="mt-1 font-premium text-xl">{title}</h3><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Review details</summary><p className="mt-2 leading-6">{detail}</p></details></div>
              </li>)}
            </ol>
          </div>
          <details className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Operating boundaries and stop signals</summary><p className="mt-3 leading-6">Start the clock only after exact channels, copy, adult recipient basis, and retention are approved. Count by role and channel in an approved aggregate log only. Pause for child data, a declined post, an opt-out, a request to contact a minor, institutional approval needs, unexpected cost, or a flow that conflicts with teaching. One nonresponse follow-up maximum; none after a decline. No scraped lists, student rosters, contact import, or paid ads.</p></details>
        </section>

        <section aria-labelledby="signals" className="mt-16">
          <h2 id="signals" className="font-premium text-3xl">Notes we are listening for</h2><p className="mt-2 text-sm text-muted-foreground">Day-14 learning thresholds, not forecasts or permission to send more.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[["20", "relevant adult visits"], ["6", "voluntary replies"], ["4", "qualified conversations"], ["2", "pilot-fit signals"]].map(([count, label]) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><strong className="font-premium text-4xl text-radiant-gold">{count}</strong><p className="mt-1 text-sm">{label}</p></div>)}</div>
          <p className="mt-3 text-xs text-muted-foreground">A visit is not a lead. Missing a threshold calls for revision, not automatic follow-up.</p>
        </section>

        <section aria-labelledby="copy" className="mt-16">
          <h2 id="copy" className="font-premium text-3xl">Message drafts</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Choose one channel to inspect. Copy stays on this device; it opens no provider or queue. Replace bracketed details and review channel rules before any separately authorized use. Share no child details.</p>
          <div className="mt-5"><TrumpetRecruitmentMessages messages={messages} /></div>
        </section>

        <section className="mt-16 rounded-3xl border border-radiant-gold/30 bg-card p-6 sm:p-8" aria-labelledby="gate">
          <div className="flex items-center gap-3 text-radiant-gold"><ShieldCheck aria-hidden="true" size={28} /><span className="font-heading text-xs uppercase tracking-[.2em]">Conductor’s check</span></div><h2 id="gate" className="mt-3 font-premium text-3xl">Decision before activation</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">{["Approve exact channels and copy", "Confirm adult-only intake and contact basis", "Set retention, suppression, and pilot capacity"].map((item) => <li key={item} className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-sm"><BookOpen aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-radiant-gold" />{item}</li>)}</ul>
          <details className="mt-5 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Full activation boundary</summary><p className="mt-2 leading-6">The captain must approve exact channels, recipient basis, group rules, copy, adult-only intake, retention, suppression, and pilot capacity. Publication, outreach sends, provider actions, database writes, and spending each require separate authorization. The product study’s adult interest form prepares a mailto draft that the adult reviews and sends.</p></details>
          <Link href="/work/trumpet-trainer#interest" className="mt-6 inline-block rounded-full border border-radiant-gold px-5 py-3 font-semibold text-radiant-gold">Inspect adult interest form</Link>
        </section>
      </div>
    </main>
  );
}
