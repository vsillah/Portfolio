export type ReviewService = {
  id: number;
  title: string;
  description?: string | null;
  topics?: string[] | null;
  is_active?: boolean;
  kind?: "service" | "product";
};
const stopWords = new Set(
  "about after again their there these those would could should which where while through with from into your have this that what when then than them they were been will also each some more need work team teams decision decisions learning evidence customer customers business product products service services".split(
    " ",
  ),
);
const words = (text: string) =>
  new Set(
    (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
      (word) => !stopWords.has(word),
    ),
  );
export function reviewServiceCandidates(
  answers: Record<string, string>,
  services: ReviewService[],
) {
  const learnerWords = words(Object.values(answers).join(" "));
  return services
    .filter((service) => service.is_active !== false)
    .map((service) => {
      const topics = Array.isArray(service.topics) ? service.topics : [];
      const matched = [
        ...words(
          [service.title, service.description, ...topics]
            .filter(Boolean)
            .join(" "),
        ),
      ]
        .filter((word) => learnerWords.has(word))
        .slice(0, 5);
      return {
        id: service.id,
        kind: service.kind || "service",
        title: service.title,
        reason: matched.length ? `Shared topics: ${matched.join(", ")}` : "",
        matched,
      };
    })
    .filter((item) => item.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, 5);
}
