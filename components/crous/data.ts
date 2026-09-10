export const tiers = [
  { id: 1, label: "夯", emoji: "🐮", color: "#d88c86" },
  { id: 2, label: "顶级", emoji: "👑", color: "#d5b26f" },
  { id: 3, label: "人上人", emoji: "😎", color: "#d4ca78" },
  { id: 4, label: "NPC", emoji: "🤖", color: "#c4bdb3" },
  { id: 5, label: "拉爆了", emoji: "💩", color: "#b6aaa4" },
] as const;

export type TierId = (typeof tiers)[number]["id"];

export const meals = [
  { id: "couscous-boulettes", name: "Couscous aux boulettes", zh: "肉丸古斯古斯", venue: "学校 CROUS · Escoffier", date: "2026-09-10", image: "/meals/couscous.jpg", tier: 2 as TierId, votes: 18, category: "main" as const },
  { id: "lentilles-saucisse", name: "Lentilles & saucisse", zh: "扁豆香肠", venue: "宿舍 CROUS · L’Expérimental", date: "2026-09-09", image: "/meals/lentilles-saucisse.jpg", tier: 4 as TierId, votes: 11, category: "main" as const },
  { id: "mystery-dessert", name: "神秘菜品 #42", zh: "巧克力？慕斯？案情复杂", venue: "学校 CROUS · Escoffier", date: "2026-09-08", image: "/meals/poulet-haricots.jpg", tier: 3 as TierId, votes: 4, category: "side" as const },
];

export function tierById(id: TierId) {
  return tiers.find((tier) => tier.id === id) ?? tiers[2];
}
