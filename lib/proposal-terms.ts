/** Layout only: retain literal source text; never interpret HTML or rewrite terms. */
export type ProposalTermBlock = {
  kind: "heading" | "paragraph" | "ordered" | "bullet" | "payment";
  text: string;
};

// Known document labels are deliberately narrower than arbitrary short prose.
const headingPattern =
  /^(What we will deliver|Proposed fee and schedule|Scope and completion|A small and controlled starting point|How we will confirm completion|What we need from each other|Deliverables|Payment terms|Pricing|Schedule|Scope|Acceptance criteria)$/i;

export function parseProposalTerms(source: string): ProposalTermBlock[] {
  let payment = false;
  let acceptanceSection = false;
  let criteriaRemaining = 0;
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((text): ProposalTermBlock[] => {
      const trimmed = text.trim();
      if (!trimmed) {
        criteriaRemaining = 0;
        return [];
      }
      if (headingPattern.test(trimmed)) {
        payment = /fee|payment|pricing/i.test(trimmed);
        acceptanceSection = /^How we will confirm completion$/i.test(trimmed);
        criteriaRemaining = 0;
        return [{ kind: "heading", text }];
      }
      if (/^\s*\d+(?:[.)]\s+|\s{2,})/.test(text))
        return [{ kind: "ordered", text }];
      if (/^\s*[-*•]\s+/.test(text)) return [{ kind: "bullet", text }];
      if (payment && /\$\d/.test(text)) {
        payment = false;
        return [{ kind: "payment", text }];
      }
      // The reviewed completion section has four explicit unmarked criteria.
      // Only these recognizable criterion openings become list items.
      if (
        criteriaRemaining > 0 &&
        /^(Each case|Closing a case|Your reviewer|The workflow map)\b/.test(
          trimmed,
        )
      ) {
        criteriaRemaining--;
        return [{ kind: "bullet", text }];
      }
      criteriaRemaining =
        acceptanceSection && /Completion means:\s*$/.test(trimmed) ? 4 : 0;
      return [{ kind: "paragraph", text }];
    });
}
