export type Act = "Signals" | "Alignment" | "Momentum" | "Synthesis";
export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  act: Act;
  summary: string;
  exercise: string;
  artifact: string;
};

// Learner copy is derived from the approved 16-lesson outline. Production packets remain in docs.
export const lessons: Lesson[] = [
  {
    id: "L01",
    title: "Build smarter, stay human",
    minutes: 9,
    act: "Signals",
    summary:
      "Spot when faster output is outrunning your team’s ability to decide and learn.",
    exercise:
      "Name one live decision. Sort its inputs into public, approved internal, and restricted.",
    artifact: "Decision-file cover sheet and data-use boundary",
  },
  {
    id: "L02",
    title: "Prioritize before generating",
    minutes: 10,
    act: "Signals",
    summary:
      "Choose one decision worth testing from a crowded list of requests.",
    exercise:
      "Compare three options by customer pain, value, learning, risk, and reversibility.",
    artifact: "Priority decision with two rejected alternatives",
  },
  {
    id: "L03",
    title: "Answer-driven discovery",
    minutes: 9,
    act: "Signals",
    summary: "Ask for evidence that could change a named decision.",
    exercise:
      "Write your current answer, the strongest objection, and one evidence gap.",
    artifact: "Decision question and evidence-gap card",
  },
  {
    id: "L04",
    title: "Build small; keep personas alive",
    minutes: 10,
    act: "Signals",
    summary:
      "Turn a static persona into a customer situation you can test and revisit.",
    exercise:
      "Describe a job, context, observed signal, uncertainty, and validation question.",
    artifact: "Living persona card",
  },
  {
    id: "L05",
    title: "From feedback to signal",
    minutes: 10,
    act: "Alignment",
    summary:
      "Find a pattern in feedback without losing its source or the counterexample.",
    exercise:
      "Code six synthetic comments, name one pattern, and flag what contradicts it.",
    artifact: "Feedback-to-signal ledger",
  },
  {
    id: "L06",
    title: "Roadmap to PRD, without drift",
    minutes: 11,
    act: "Alignment",
    summary:
      "Keep a roadmap choice connected to evidence through the build handoff.",
    exercise:
      "Trace one bet into acceptance criteria and a measure of success.",
    artifact: "Roadmap and PRD trace card",
  },
  {
    id: "L07",
    title: "Commit to learning",
    minutes: 10,
    act: "Alignment",
    summary: "Put answerable questions beside delivery dates.",
    exercise:
      "Turn one milestone into a learning question, review date, and possible adjustment.",
    artifact: "Two-checkpoint learning roadmap",
  },
  {
    id: "L08",
    title: "Metrics and the ten-part learning plan",
    minutes: 12,
    act: "Alignment",
    summary:
      "Set a measure and a stop or pivot threshold before results arrive.",
    exercise:
      "Complete the ten book fields and define the measure tied to your decision.",
    artifact: "Ten-component learning plan",
  },
  {
    id: "L09",
    title: "Map the decision theater",
    minutes: 11,
    act: "Alignment",
    summary:
      "See who can move, slow, or stop a decision and what each person needs.",
    exercise:
      "Map four fictional roles, their objections, and the evidence they need.",
    artifact: "Decision theater map",
  },
  {
    id: "L10",
    title: "Influence before impact",
    minutes: 9,
    act: "Alignment",
    summary:
      "Make a responsible case for a choice while showing its tradeoffs.",
    exercise:
      "Draft a 90-second recommendation and say what would change your mind.",
    artifact: "Stakeholder decision brief",
  },
  {
    id: "L11",
    title: "From the shift to a repeatable loop",
    minutes: 10,
    act: "Momentum",
    summary: "Carry the learning from one decision into the next.",
    exercise:
      "Draw your workflow and mark the missing review or memory handoff.",
    artifact: "Signal-to-decision loop map",
  },
  {
    id: "L12",
    title: "Jobs and synthetic signals",
    minutes: 11,
    act: "Momentum",
    summary:
      "Use synthesis and simulation as hypotheses that need checking with people.",
    exercise:
      "Write a job statement, two simulation questions, and the real evidence needed.",
    artifact: "Jobs and validation card",
  },
  {
    id: "L13",
    title: "Strategic shifts and future concepts",
    minutes: 11,
    act: "Momentum",
    summary: "Explore a business-model change before committing resources.",
    exercise:
      "Choose an alternative, its smallest falsifiable test, and a short concept story.",
    artifact: "Strategic alternatives and concept-test card",
  },
  {
    id: "L14",
    title: "The last mile of influence",
    minutes: 8,
    act: "Momentum",
    summary:
      "Adapt a proposal to its audience while keeping the evidence intact.",
    exercise:
      "Write two short pitches and flag any sentence that outruns the source.",
    artifact: "Two-audience pitch card",
  },
  {
    id: "L15",
    title: "Governance and the system that learns",
    minutes: 12,
    act: "Synthesis",
    summary:
      "Help another team reuse a useful loop with its owner and stop condition intact.",
    exercise: "Name one rule a second team needs before reusing your test.",
    artifact: "Scale-readiness and decision-memory record",
  },
  {
    id: "L16",
    title: "What comes next",
    minutes: 8,
    act: "Synthesis",
    summary:
      "Leave with one accountable learning move for the next seven days.",
    exercise:
      "Choose an action, a review owner, and a condition that changes the plan.",
    artifact: "One-week commitment and assembled decision file",
  },
];

export const DECISION_FILE_VERSION = "accelerated-l01-l16-ed73dee7";
export const DECISION_FILE_STORAGE_KEY =
  "amadutown:accelerated:decision-file:v1";
export type DecisionFileAnswers = Record<string, string>;
export type DecisionFileDraft = {
  version: string;
  worksheetId: string;
  answers: DecisionFileAnswers;
  updatedAt: string;
};

export function emptyDecisionFile(id: string): DecisionFileDraft {
  return {
    version: DECISION_FILE_VERSION,
    worksheetId: id,
    answers: {},
    updatedAt: new Date().toISOString(),
  };
}

export function validateDecisionFile(
  value: unknown,
): { ok: true; draft: DecisionFileDraft } | { ok: false; error: string } {
  if (!value || typeof value !== "object")
    return { ok: false, error: "Invalid decision file" };
  const draft = value as Partial<DecisionFileDraft>;
  if (draft.version !== DECISION_FILE_VERSION)
    return {
      ok: false,
      error:
        "This workshop version has changed. Review the current worksheet before sharing.",
    };
  if (
    typeof draft.worksheetId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      draft.worksheetId,
    )
  )
    return { ok: false, error: "Invalid worksheet identity" };
  if (
    !draft.answers ||
    typeof draft.answers !== "object" ||
    Array.isArray(draft.answers)
  )
    return { ok: false, error: "Invalid answers" };
  const ids = new Set(lessons.map((lesson) => lesson.id));
  for (const [key, answer] of Object.entries(draft.answers)) {
    if (!ids.has(key) || typeof answer !== "string" || answer.length > 4000)
      return { ok: false, error: "A worksheet answer is invalid or too long" };
  }
  if (JSON.stringify(draft.answers).length > 32000)
    return { ok: false, error: "The worksheet is too large to share" };
  if (
    typeof draft.updatedAt !== "string" ||
    Number.isNaN(Date.parse(draft.updatedAt))
  )
    return { ok: false, error: "Invalid worksheet date" };
  return { ok: true, draft: draft as DecisionFileDraft };
}
