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
  if (targets.some((tier) => !Number.isInteger(tier) || tier < 1 || tier > 5)) {
    throw new RangeError("target tier must be an integer from 1 to 5");
  }

  const distribution: Verdict["distribution"] = [0, 0, 0, 0, 0];
  for (const tier of targets) distribution[tier - 1] += 1;
  return verdictFromDistribution(distribution);
}

export function verdictFromDistribution(distribution: Verdict["distribution"]): Verdict {
  if (distribution.some(count => !Number.isSafeInteger(count) || count < 0)) throw new RangeError("Invalid vote count");
  const voteCount = distribution.reduce((sum, count) => sum + count, 0);
  let cumulative = 0;
  const middle = Math.floor(voteCount / 2);
  const index = distribution.findIndex(count => { cumulative += count; return cumulative > middle; });
  return {
    tier: voteCount ? (index + 1) as Tier : null,
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
  const distribution: Verdict["distribution"] = [0, 0, 0, 0, 0];
  const history: TierHistoryEntry[] = [];
  for (const vote of votes) {
    if (!Number.isInteger(vote.tier) || vote.tier < 1 || vote.tier > 5) throw new RangeError("Invalid tier");
    distribution[vote.tier - 1]++;
    const verdict = verdictFromDistribution(distribution);
    if (history.at(-1)?.tier !== verdict.tier) history.push({ tier: verdict.tier!, at: vote.at, voteCount: verdict.voteCount });
  }
  return history;
}

export function previewVote(distribution: Verdict["distribution"], previous: Tier | null, next: Tier): Verdict {
  verdictFromDistribution(distribution);
  if (!Number.isInteger(next) || next < 1 || next > 5) throw new RangeError("Invalid tier");
  const counts: Verdict["distribution"] = [...distribution];
  if (previous !== null && counts[previous - 1] > 0) counts[previous - 1]--;
  counts[next - 1]++;
  return verdictFromDistribution(counts);
}
