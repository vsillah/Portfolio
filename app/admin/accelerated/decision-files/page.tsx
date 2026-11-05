import DecisionFilesReview from "./DecisionFilesReview";

export default async function DecisionFilesPage({ searchParams }: { searchParams: Promise<{ qa_fixture?: string }> }) {
  const params = await searchParams;
  const fixture = process.env.NODE_ENV === "development" && params.qa_fixture === "accelerated_decision_file_v1";
  return <DecisionFilesReview fixture={fixture} />;
}
