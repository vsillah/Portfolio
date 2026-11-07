import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import TrumpetInterestForm from "@/components/TrumpetInterestForm";
import TrumpetGameplayCarousel from "@/components/TrumpetGameplayCarousel";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Music2,
  Timer,
  BookOpen,
  HeartHandshake,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Trumpet Trainer | Beginner practice, one step at a time",
  description:
    "Explore a small founding-family pilot for beginner trumpet practice. Adults can review the concept and prepare a non-binding tester interest note.",
};

const steps = [
  {
    icon: Timer,
    title: "A short session",
    text: "A beginner opens a focused practice activity instead of facing an entire method book at once.",
  },
  {
    icon: Music2,
    title: "A clear next note",
    text: "Small prompts help the student work through the basics at a pace an adult can support.",
  },
  {
    icon: BookOpen,
    title: "A reason to return",
    text: "The practice path makes the next session easier to start. A teacher still guides technique and musical growth.",
  },
];

export default function TrumpetTrainerPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navigation />
      <div className="mx-auto max-w-6xl px-5 pt-28 sm:px-10 lg:px-12">
        <Link
          href="/work"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
        >
          <ArrowLeft size={16} /> Back to Work
        </Link>
      </div>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-16 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-12">
        <div>
          <span className="font-heading text-xs uppercase tracking-[.22em] text-radiant-gold">
            AmaduTown product study · founding-family pilot
          </span>
          <h1 className="mt-6 max-w-3xl font-premium text-5xl leading-[1.08] sm:text-6xl lg:text-7xl">
            Make the first few minutes of trumpet practice easier to start.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
            A beginner can love music and still get stuck between lessons.
            Trumpet Trainer is a web app being shaped around short, clear
            practice sessions that families and tutors can use together.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#interest"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-radiant-gold px-6 py-3 font-semibold text-imperial-navy transition-colors hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
            >
              Explore tester interest <ArrowRight size={18} />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center rounded-full border border-radiant-gold/40 px-6 py-3 font-semibold transition-colors hover:border-radiant-gold hover:text-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
            >
              See the practice concept
            </a>
          </div>
        </div>
        <TrumpetGameplayCarousel />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-10 lg:px-12" aria-labelledby="gameplay-video-heading">
        <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
          <div>
            <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">See it move</span>
            <h2 id="gameplay-video-heading" className="mt-4 font-premium text-4xl">From first step to feedback.</h2>
            <p className="mt-5 leading-7 text-muted-foreground">This short capture follows a real product session using synthetic test input. It shows the lesson path, a No Rush start, on-screen note guidance, and the result.</p>
          </div>
          <div>
            <video className="aspect-video w-full rounded-2xl border border-border bg-imperial-navy object-cover" controls preload="none" playsInline poster="/showcases/trumpet-trainer/c19989a3/gameplay-poster.jpg" aria-label="Trumpet Trainer gameplay walkthrough with captions">
              <source src="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4" type="video/mp4" />
              <a href="/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4">Open the gameplay walkthrough</a>
            </video>
            <p className="mt-2 text-xs text-muted-foreground">Captions are in the video. No microphone recording or child data is shown.</p>
          </div>
        </div>
      </section>
      <section className="border-y border-border bg-card/70 px-5 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">
            The gap between lessons
          </span>
          <h2 className="mt-4 max-w-3xl font-premium text-4xl sm:text-5xl">
            “Go practice” can be a hard instruction to act on.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Parents may want to help but cannot always tell whether a note or
            routine is on track. Tutors and band educators have limited time
            between sessions. A useful practice tool should make the next step
            clear without asking the adult to become a trumpet teacher.
          </p>
        </div>
      </section>
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-5 py-24 sm:px-10 lg:px-12"
      >
        <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">
          The practice concept
        </span>
        <h2 className="mt-4 font-premium text-4xl sm:text-5xl">
          One approachable step at a time.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-3xl border border-border bg-card/80 p-7"
            >
              <Icon aria-hidden className="text-radiant-gold" size={28} />
              <h3 className="mt-5 font-premium text-2xl">{title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="border-y border-border bg-card/70 px-5 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">What feels different</span>
          <h2 className="mt-4 font-premium text-4xl sm:text-5xl">A beginner path with room to breathe.</h2>
          <p className="mt-5 max-w-3xl leading-8 text-muted-foreground">Music practice apps take different routes. Tonestro emphasizes a broad lesson and song library. Tomplay centers interactive sheet music and accompaniment. Trumpet Trainer is being tested around a visible first step, a No Rush start, and immediate practice feedback. These are differences in focus, not a claim that one tool produces better results.</p>
          <a href="#interest" className="mt-7 inline-flex items-center gap-2 font-semibold text-radiant-gold underline underline-offset-4">Explore the adult tester pilot <ArrowRight aria-hidden size={17} /></a>
        </div>
      </section>
      <section className="border-y border-border bg-card/70 px-5 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div>
            <HeartHandshake className="text-radiant-gold" size={32} />
            <h2 className="mt-5 font-premium text-4xl">
              A small pilot, built with adults.
            </h2>
            <p className="mt-5 leading-8 text-muted-foreground">
              We are exploring a founding-family tester group with parents or
              guardians, private trumpet tutors, band educators, and community
              music programs. Interest is non-binding. We would first confirm
              fit, access, timing, and consent with the adult contact.
            </p>
            <p className="mt-4 leading-8 text-muted-foreground">
              If invited to a pilot, adults may be asked to try short practice
              sessions, describe where a student gets stuck, and share what
              worked or caused friction. There is no school endorsement or
              commitment implied by expressing interest.
            </p>
          </div>
          <div className="rounded-3xl border border-radiant-gold/25 bg-background p-8">
            <h3 className="font-premium text-3xl">A good fit may be...</h3>
            <ul className="mt-5 space-y-4 leading-7 text-muted-foreground">
              <li>
                • A parent or guardian supporting a beginner trumpet student.
              </li>
              <li>
                • A private tutor who wants a clearer between-lesson routine.
              </li>
              <li>
                • A band educator or community program exploring a low-burden
                practice aid.
              </li>
            </ul>
            <h3 className="mt-8 font-premium text-2xl">
              What is still being tested
            </h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Lesson fit, usability, and the right amount of adult support. Any
              image-assisted music reading should be treated as experimental;
              accuracy is not guaranteed. The app does not replace a teacher or
              provide a performance outcome.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-10 lg:grid-cols-[.9fr_1.1fr] lg:px-12">
        <div>
          <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">
            Before you raise your hand
          </span>
          <h2 className="mt-4 font-premium text-4xl">
            Clear boundaries help us learn responsibly.
          </h2>
          <div className="mt-7 space-y-5 leading-7 text-muted-foreground">
            <p>
              <strong className="text-foreground">Privacy:</strong> This
              interest step is for adults. Please share no child name, photo,
              school, exact age, address, or practice recording. The adult
              consent page explains whether interest intake is open. Interest
              does not enroll a child.
            </p>
            <p>
              <strong className="text-foreground">Price research:</strong> We
              may ask adults what a useful practice tool would be worth. There
              is no checkout, paid entitlement, price offer, or obligation in
              this pilot-interest step.
            </p>
            <p>
              <strong className="text-foreground">Pilot status:</strong>{" "}
              Invitations, availability, and the exact tester activities are
              still to be confirmed. Expressing interest does not guarantee a
              place.
            </p>
          </div>
        </div>
        <TrumpetInterestForm />
      </section>
      <section className="border-t border-border bg-card/70 px-5 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-premium text-4xl">Common questions</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[
              [
                "Is this a music lesson?",
                "No. It is a practice aid for use alongside instruction from a qualified teacher or tutor.",
              ],
              [
                "Does interest mean we are enrolled?",
                "No. An adult may review the contact terms and express interest when intake opens. We would review fit separately before any invitation.",
              ],
              [
                "Will a school need to approve it?",
                "Educators should follow their school or program rules. We have not claimed school approval or an institutional partnership.",
              ],
              [
                "Does it read sheet music from a photo?",
                "Image-assisted reading may be explored, but accuracy is not guaranteed. Any such feature needs adult review and careful testing.",
              ],
            ].map(([question, answer]) => (
              <article
                key={question}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="font-semibold">{question}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{answer}</p>
              </article>
            ))}
          </div>
          <a
            href="#interest"
            className="mt-9 inline-flex items-center gap-2 font-semibold text-radiant-gold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
          >
            Review adult interest <ArrowRight size={17} />
          </a>
        </div>
      </section>
    </main>
  );
}
