"use client";

import { useState } from "react";

export default function TrumpetRecruitmentCopy({ label, text }: { label: string; text: string }) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied. Review it before using it anywhere.`);
    } catch {
      setStatus("Clipboard unavailable. Select and copy the text below instead.");
    }
  }

  return (
    <div className="min-w-0">
      <button type="button" onClick={copy} className="rounded-full border border-radiant-gold px-4 py-2 text-sm font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">
        Copy {label}
      </button>
      {status && <p role="status" className="mt-2 text-sm text-muted-foreground">{status}</p>}
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-border bg-background p-5 font-sans text-sm leading-7 text-foreground">{text}</pre>
    </div>
  );
}
