import Link from "next/link";
import type { PromptSummary } from "@/lib/prompt-summary";

export function PromptCard({ prompt }: { prompt: PromptSummary }) {
  return <article className="prompt-card">
    <div className="prompt-card__meta">
      <span className="eyebrow">{prompt.category}</span>
      <span className={`status status--${prompt.statusKey}`}>{prompt.status}</span>
    </div>
    <h3>{prompt.title}</h3>
    <div className="prompt-card__version">V{prompt.version} · {prompt.stage}</div>
    <p>{prompt.summary}</p>
    <div className="prompt-card__platforms">{prompt.platforms}</div>
    <div className="prompt-card__footer">
      <div><span>Owner</span><strong>{prompt.owner}</strong></div>
      <div><span>Review</span><strong>{prompt.review}</strong></div>
    </div>
    <div className="prompt-card__actions">
      <Link className="button button--ghost" href={`/library/${prompt.key}`}>Open</Link>
      <Link className="button" href={`/library/${prompt.key}`}>Use Prompt</Link>
    </div>
  </article>;
}
