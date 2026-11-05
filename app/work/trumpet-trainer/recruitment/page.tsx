import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navigation from "@/components/Navigation";
import TrumpetRecruitmentCopy from "@/components/TrumpetRecruitmentCopy";

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
  ["Parents or guardians", "Opt-in through the public work page or a rules-permitted community post", "Practice-start friction and adult trust"],
  ["Private trumpet tutors", "Known relationship or individually reviewed public professional channel", "Fit with teaching approach and workload"],
  ["Band educators", "Known relationship or official staff contact path, subject to institution rules", "Classroom constraints and approval path"],
  ["Community music programs", "Public organization contact route after staff review", "Program capacity, access, and adult ownership"],
];

const schedule = [
  ["1–2", "Review page, copy, group rules, and adult-only boundaries. No posting."],
  ["3–4", "If separately approved, one LinkedIn carousel and a small set of known adult invitations."],
  ["5–7", "Review aggregate visits and voluntary adult replies; log objections and stop signals."],
  ["8–10", "If channel rules and approval allow, one community post or educator introduction."],
  ["11–12", "One permitted follow-up to nonresponding adult contacts; none after a decline."],
  ["13–14", "Summarize fit, friction, and privacy signals; decide revise, pause, or propose a pilot."],
];

export default function RecruitmentReviewPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navigation />
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:px-10 lg:px-12">
        <Link href="/work/trumpet-trainer" className="text-sm font-semibold text-radiant-gold underline underline-offset-4">← View the live product study</Link>
        <header className="mt-12 max-w-4xl">
          <p className="font-heading text-xs uppercase tracking-[.2em] text-radiant-gold">Internal review · recruitment inactive</p>
          <h1 className="mt-4 font-premium text-4xl leading-tight sm:text-6xl">A small test of the first practice step.</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">A 14-day, $0 proposal for hearing from the adults around beginner trumpet players. Every message and media asset below is a draft for review. This page sends nothing, stores no contacts, and does not enroll anyone.</p>
        </header>

        <section aria-labelledby="audiences" className="mt-16">
          <h2 id="audiences" className="font-premium text-3xl">Who we want to hear from</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {audiencePlan.map(([name, channel, question]) => <article key={name} className="min-w-0 rounded-2xl border border-border bg-card p-6"><h3 className="font-premium text-2xl">{name}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{channel}</p><p className="mt-3 text-sm leading-6"><strong>Learn:</strong> {question}</p></article>)}
          </div>
        </section>

        <section aria-labelledby="media" className="mt-16">
          <h2 id="media" className="font-premium text-3xl">Approved product media</h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">The screens and video come from Trumpet Trainer commit <code>c19989a3b156ce97326e35b335e169014ca076f3</code> with synthetic audio input. The displayed result is one deterministic test run, not an outcome claim.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-border bg-card p-4"><Image src="/showcases/trumpet-trainer/c19989a3/01-home.webp" alt="Trumpet Trainer home screen from the synthetic gameplay capture" width={824} height={1720} className="mx-auto max-h-96 w-auto rounded-xl" /><p className="mt-3 text-sm text-muted-foreground">First of seven captured product screens. <Link href="/work/trumpet-trainer" className="text-radiant-gold underline">Review the full carousel</Link>.</p></div>
            <div className="min-w-0 self-start rounded-2xl border border-border bg-card p-4"><video controls preload="none" playsInline poster="/showcases/trumpet-trainer/c19989a3/gameplay-poster.jpg" className="aspect-video w-full rounded-xl bg-imperial-navy" aria-label="Synthetic Trumpet Trainer gameplay"><source src="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4" type="video/mp4" /></video><p className="mt-3 text-sm text-muted-foreground">Captioned gameplay. No child or customer recording.</p></div>
          </div>
          <h3 className="mt-8 font-premium text-2xl">Seven-slide social carousel</h3>
          <p className="mt-2 text-sm text-muted-foreground">These are the existing approved review slides, copied byte-for-byte from <code>docs/qa/trumpet-trainer-gameplay/social/</code>. Scroll to inspect each slide. Publication remains gated.</p>
          <div className="mt-4 flex max-w-full snap-x gap-4 overflow-x-auto pb-4" aria-label="Trumpet Trainer social carousel slides">
            {Array.from({ length: 7 }, (_, index) => {
              const slide = String(index + 1).padStart(2, "0");
              return <figure key={slide} className="w-60 shrink-0 snap-start rounded-2xl border border-border bg-card p-2 sm:w-72"><Image src={`/showcases/trumpet-trainer/c19989a3/social/slide-${slide}.png`} alt={`Social carousel slide ${index + 1} of 7`} width={1080} height={1350} className="w-full rounded-xl" /><figcaption className="px-2 py-2 text-sm text-muted-foreground">Slide {index + 1} of 7</figcaption></figure>;
            })}
          </div>
        </section>

        <section aria-labelledby="plan" className="mt-16">
          <h2 id="plan" className="font-premium text-3xl">14-day sequence</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">{schedule.map(([days, activity]) => <div key={days} className="rounded-2xl border border-border bg-card p-5"><strong className="text-radiant-gold">Days {days}</strong><p className="mt-2 leading-7 text-muted-foreground">{activity}</p></div>)}</div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">Targets are learning thresholds, not forecasts: 20 relevant adult page visits, 6 voluntary adult replies, 4 qualified conversations, and 2 clear pilot-fit signals. Count by role and channel in an approved aggregate log only. Pause if replies ask for child data, a group declines promotion, a contact opts out, or the concept fails to fit instruction.</p>
        </section>

        <section aria-labelledby="copy" className="mt-16">
          <h2 id="copy" className="font-premium text-3xl">Message drafts</h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">Copying uses this device’s clipboard only. It does not open a provider or queue a message. Replace bracketed details and review channel rules before any separately authorized use.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">{messages.map((message) => <article key={message.label} className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6"><h3 className="mb-4 font-premium text-2xl">{message.audience}</h3><TrumpetRecruitmentCopy label={message.label} text={message.text} /></article>)}</div>
        </section>

        <section className="mt-16 rounded-3xl border border-radiant-gold/30 bg-card p-6 sm:p-8" aria-labelledby="gate">
          <h2 id="gate" className="font-premium text-3xl">Decision before activation</h2>
          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">The captain must approve exact channels, recipient basis, group rules, copy, adult-only intake, retention, suppression, and pilot capacity. Any publication, outreach send, provider action, database write, or spend needs its own authorization. The existing adult interest form remains on the product study page and prepares a mailto draft for the adult to review.</p>
          <Link href="/work/trumpet-trainer#interest" className="mt-6 inline-block rounded-full border border-radiant-gold px-5 py-3 font-semibold text-radiant-gold">Inspect adult interest form</Link>
        </section>
      </div>
    </main>
  );
}
