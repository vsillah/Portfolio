"use client";

import { useRef, useState } from "react";
import TrumpetRecruitmentCopy from "./TrumpetRecruitmentCopy";

type Message = { label: string; audience: string; text: string };

export default function TrumpetRecruitmentMessages({ messages }: { messages: Message[] }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  function move(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % messages.length : event.key === "ArrowLeft" ? (index + messages.length - 1) % messages.length : event.key === "Home" ? 0 : event.key === "End" ? messages.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }
  return <div>
    <div role="tablist" aria-label="Choose a message draft" className="flex max-w-full gap-2 overflow-x-auto pb-3">
      {messages.map((message, index) => <button key={message.label} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab" id={`recruitment-tab-${index}`} aria-controls={`recruitment-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => move(event, index)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold ${selected === index ? "border-radiant-gold bg-radiant-gold text-imperial-navy" : "border-border bg-card text-foreground hover:border-radiant-gold"}`}>{message.label}</button>)}
    </div>
    {messages.map((message, index) => <article key={message.label} role="tabpanel" id={`recruitment-panel-${index}`} aria-labelledby={`recruitment-tab-${index}`} hidden={selected !== index} tabIndex={0} className="mt-3 min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-7" >
      <h3 className="font-premium text-2xl">{message.audience}</h3>
      <TrumpetRecruitmentCopy label={message.label} text={message.text} />
    </article>)}
  </div>;
}
