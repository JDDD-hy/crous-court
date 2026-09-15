import assert from "node:assert/strict";
import test from "node:test";
import { translateEnglishNames, translateChineseNames, chineseTranslationCandidate, translationCandidate } from "../lib/translation/deepl.ts";
import { dishPresentation } from "../lib/i18n/dish-presentation.ts";

test("Chinese and mixed dish names translate to English without replacing confirmed names", async t => {
  assert.equal(chineseTranslationCandidate("草莓酸奶"), true);
  assert.equal(chineseTranslationCandidate("巧克力酱pancake"), true);
  assert.equal(chineseTranslationCandidate("Rice"), false);
  t.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.source_lang, "ZH"); assert.equal(body.target_lang, "EN-GB");
    return Response.json({ translations: [{ detected_source_language: "ZH", text: "Strawberry yoghurt" }] });
  });
  const [name] = await translateChineseNames(["草莓酸奶"], "test-only:fx");
  const dish = { name: "草莓酸奶", zh: "草莓酸奶", originalDescription: "草莓酸奶", machineNameEn: name };
  assert.equal(dishPresentation(dish, "en").primary, "Strawberry yoghurt");
  assert.equal(dishPresentation(dish, "zh").primary, "草莓酸奶");
  assert.equal(dishPresentation({ ...dish, canonicalNameEn: "Confirmed name" }, "en").primary, "Confirmed name");
});

test("DeepL Free batches bounded names, retains only detected English, and never confirms a machine name", async (t) => {
  assert.equal(translationCandidate("Roast chicken"), true);
  assert.equal(translationCandidate("烤鸡 chicken"), false);
  assert.equal(translationCandidate(""), false);
  assert.equal(translationCandidate("x".repeat(81)), false);
  const mockedFetch = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(url, "https://api-free.deepl.com/v2/translate");
    assert.equal(options?.redirect, "manual");
    assert.ok(options?.signal);
    assert.equal(new Headers(options?.headers).get("Authorization"), "DeepL-Auth-Key test-only:fx");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.target_lang, "ZH-HANS");
    assert.equal(body.source_lang, undefined, "Detect input language, not UI locale");
    assert.deepEqual(body.text, ["Roast chicken", "Poulet rôti"]);
    return Response.json({ translations: [{ detected_source_language: "EN", text: "烤鸡" }, { detected_source_language: "FR", text: "烤鸡" }] });
  });
  assert.deepEqual(await translateEnglishNames(["Roast chicken", "Poulet rôti"], "test-only:fx"), ["烤鸡", null]);
  assert.equal(mockedFetch.mock.callCount(), 1);
  const dish = { name: "Roast chicken", zh: "Roast chicken", originalDescription: "Roast chicken", machineNameZh: "烤鸡" };
  assert.deepEqual(dishPresentation(dish, "zh"), { primary: "烤鸡", secondary: "Roast chicken", card: "烤鸡" });
  assert.equal(dishPresentation(dish, "en").primary, "Roast chicken");
  assert.equal(dishPresentation({ ...dish, canonicalNameZh: "人工确认烤鸡" }, "zh").primary, "人工确认烤鸡");
  await assert.rejects(translateEnglishNames(Array(10).fill("Roast chicken"), "test-only:fx"));
  assert.equal(mockedFetch.mock.callCount(), 1);
});

test("DeepL rejects quota/auth failures and malformed responses without exposing upstream bodies", async (t) => {
  const mockedFetch = t.mock.method(globalThis, "fetch", async () => new Response("upstream-secret-must-not-leak", { status: 456 }));
  await assert.rejects(translateEnglishNames(["Rice"], "test-only:fx"), { message: "Translation unavailable (456)" });
  mockedFetch.mock.mockImplementation(async () => Response.json({ translations: [] }));
  await assert.rejects(translateEnglishNames(["Rice"], "test-only:fx"), { message: "Invalid translation response" });
  mockedFetch.mock.mockImplementation(async () => Response.json({ translations: [{ detected_source_language: "EN", text: "" }] }));
  await assert.rejects(translateEnglishNames(["Rice"], "test-only:fx"), { message: "Invalid translation item" });
});
