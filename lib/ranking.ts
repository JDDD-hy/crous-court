export type Tier = 1 | 2 | 3 | 4 | 5;
export type VerdictStatus = "pending" | "provisional" | "official";

export type Verdict = {
  tier: Tier | null;
  voteCount: number;
  status: VerdictStatus;
  distribution: [number, number, number, number, number];
};

export type TierHistoryEntry = { tier: Tier; at: string; voteCount: number };

export function calculateVerdict(targets: readonly number[]): Verdict {
  const sorted = [...targets].sort((a, b) => a - b);
  if (sorted.some((tier) => !Number.isInteger(tier) || tier < 1 || tier > 5)) {
    throw new RangeError("target tier must be an integer from 1 to 5");
  }

  const voteCount = sorted.length;
  const distribution: Verdict["distribution"] = [0, 0, 0, 0, 0];
  for (const tier of sorted) distribution[tier - 1] += 1;

  return {
    tier: voteCount ? sorted[Math.floor(voteCount / 2)] as Tier : null,
    voteCount,
    status: voteCount >= 15 ? "official" : voteCount >= 5 ? "provisional" : "pending",
    distribution,
  };
}

export function compareVerdicts(a: Verdict, b: Verdict) {
  if (a.tier === null) return b.tier === null ? 0 : 1;
  if (b.tier === null) return -1;
  return a.tier - b.tier || b.voteCount - a.voteCount;
}

export function buildTierHistory(votes: readonly { tier: Tier; at: string }[]): TierHistoryEntry[] {
  const targets: Tier[] = [];
  const history: TierHistoryEntry[] = [];
  for (const vote of votes) {
    targets.push(vote.tier);
    const tier = calculateVerdict(targets).tier!;
    if (history.at(-1)?.tier !== tier) history.push({ tier, at: vote.at, voteCount: targets.length });
  }
  return history;
}

export function previewVote(distribution: Verdict["distribution"], previous: Tier | null, next: Tier): Verdict {
  const targets = distribution.flatMap((count, index) => Array<Tier>(count).fill((index + 1) as Tier));
  if (previous !== null) {
    const index = targets.indexOf(previous);
    if (index >= 0) targets.splice(index, 1);
  }
  targets.push(next);
  return calculateVerdict(targets);
}
