export type PromptSummary = {
  key: string;
  title: string;
  category: string;
  version: string;
  status: string;
  statusKey: string;
  stage: string;
  summary: string;
  owner: string;
  review: string;
  platforms: string;
};

const reviewFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatReviewDate(value: Date | null) {
  return value ? reviewFormatter.format(value) : "Not scheduled";
}
