export type ReviewService = {
  id: string | number;
  title: string;
  description?: string | null;
  topics?: string[] | null;
  is_active?: boolean;
  kind: "service" | "product";
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function catalogOfferHref(service: ReviewService): string | null {
  if (service.kind === "service")
    return typeof service.id === "string" && uuid.test(service.id) ? `/services/${service.id}` : null;
  return typeof service.id === "number" && Number.isSafeInteger(service.id) && service.id > 0
    ? `/store/${service.id}` : null;
}
export function parseReviewCatalogOffer(value: unknown, kind: "service" | "product"): ReviewService | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.title !== "string" || !row.title.trim() || row.is_active === false) return null;
  const offer: ReviewService = {
    id: row.id as string | number, kind, title: row.title,
    description: typeof row.description === "string" ? row.description : null,
    topics: Array.isArray(row.topics) ? row.topics.filter((topic): topic is string => typeof topic === "string") : null,
    is_active: true,
  };
  return catalogOfferHref(offer) ? offer : null;
}
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
    .filter((service) => service.is_active !== false && catalogOfferHref(service) !== null)
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
        kind: service.kind,
        href: catalogOfferHref(service)!,
        title: service.title,
        reason: matched.length ? `Shared topics: ${matched.join(", ")}` : "",
        matched,
      };
    })
    .filter((item) => item.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, 5);
}
