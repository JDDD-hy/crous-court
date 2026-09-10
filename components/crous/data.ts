export const tiers = [
  { id: 1, label: "夯", emoji: "🐮", color: "#d88c86" },
  { id: 2, label: "顶级", emoji: "👑", color: "#d5b26f" },
  { id: 3, label: "人上人", emoji: "😎", color: "#d4ca78" },
  { id: 4, label: "NPC", emoji: "🤖", color: "#c4bdb3" },
  { id: 5, label: "拉爆了", emoji: "💩", color: "#b6aaa4" },
] as const;

export type TierId = (typeof tiers)[number]["id"];

export function tierById(id: TierId) {
  return tiers.find((tier) => tier.id === id) ?? tiers[2];
}
