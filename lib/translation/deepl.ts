/** Only English dish labels are retained; interface locale is not input language. */
export function translationCandidate(text: string) {
  return text.length > 0 && text.length <= 80 && /[a-z]/i.test(text) && !/\p{Script=Han}/u.test(text);
}

export async function translateEnglishNames(names: string[], apiKey: string): Promise<Array<string | null>> {
  if (!names.length || names.length > 9 || names.some(name => !translationCandidate(name))) throw new Error("Invalid translation batch");
  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: names, target_lang: "ZH-HANS", context: "Short dish names submitted by diners at a French university cafeteria. Preserve the ingredients and preparation stated in the name." }),
    signal: AbortSignal.timeout(5000),
    redirect: "manual",
  });
  // Do not log response bodies or credentials, including upstream authentication errors.
  if (!response.ok) throw new Error(`Translation unavailable (${response.status})`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("translations" in body) || !Array.isArray(body.translations) || body.translations.length !== names.length) throw new Error("Invalid translation response");
  return body.translations.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("detected_source_language" in item) || !("text" in item) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 500) throw new Error("Invalid translation item");
    return item.detected_source_language === "EN" ? item.text.trim() : null;
  });
}
