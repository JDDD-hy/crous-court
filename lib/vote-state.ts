import type { DishSummary } from "./dish-types.ts";
import { previewVote, type Tier } from "./ranking.ts";

export type VoteViewState = { dish: DishSummary; myVote: Tier | null; error: string };
export type VoteAction =
  | { type: "optimistic"; target: Tier }
  | { type: "confirmed"; dish: DishSummary; myVote: Tier }
  | { type: "rollback"; snapshot: VoteViewState; error: string };

export function reduceVoteState(state: VoteViewState, action: VoteAction): VoteViewState {
  if (action.type === "confirmed") return { dish: { ...action.dish, venue: state.dish.venue, date: state.dish.date, image: state.dish.image, initialTier: state.dish.initialTier }, myVote: action.myVote, error: "" };
  if (action.type === "rollback") return { ...action.snapshot, error: action.error };
  if (state.myVote !== null) return state;
  const verdict = previewVote(state.dish.distribution, state.myVote, action.target);
  return { dish: { ...state.dish, tier: verdict.tier, votes: verdict.voteCount, distribution: verdict.distribution, status: verdict.status }, myVote: action.target, error: "" };
}
