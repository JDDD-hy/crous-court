export function normalizeDishName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
}

export function validDishName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim();
  return name && name.length <= 80 ? name : null;
}
