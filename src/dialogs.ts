/** Finds a chat by its title among the user's dialogs. Pure. */

export interface Titled {
  title: string;
}

export type MatchResult<T> =
  | { type: "found"; item: T }
  | { type: "notFound" }
  | { type: "ambiguous"; titles: string[] };

const MAX_SUGGESTIONS = 5;

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function pick<T extends Titled>(candidates: T[]): MatchResult<T> | null {
  const [first, second] = candidates;
  if (!first) return null;
  if (!second) return { type: "found", item: first };
  return {
    type: "ambiguous",
    titles: candidates.slice(0, MAX_SUGGESTIONS).map((c) => c.title),
  };
}

/** Exact (normalized) title wins; otherwise a unique substring match. */
export function matchDialog<T extends Titled>(dialogs: readonly T[], query: string): MatchResult<T> {
  const q = normalizeTitle(query);
  if (q === "") return { type: "notFound" };

  const exact = dialogs.filter((d) => normalizeTitle(d.title) === q);
  const partial = dialogs.filter((d) => normalizeTitle(d.title).includes(q));
  return pick(exact) ?? pick(partial) ?? { type: "notFound" };
}
