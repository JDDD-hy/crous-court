import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { englishMessages, parseLocale, translator } from "../lib/i18n/core.ts";
import { verificationEmail } from "../lib/i18n/email.ts";
import { dishPresentation } from "../lib/i18n/dish-presentation.ts";

test("English copy covers static UI calls and preserves interpolation and Chinese", () => {
  const en = translator("en");
  const zh = translator("zh");
  assert.equal(parseLocale("en"), "en");
  for (const value of [undefined, "fr", "<script>"]) assert.equal(parseLocale(value), "zh");
  assert.equal(en("小菜 {0}", 8), "Side 8");
  assert.equal(zh("小菜 {0}", 8), "小菜 8");
  assert.equal(en(" · 投稿者称“{0}”", "用户的原文 {1}"), " · Submitted as “用户的原文 {1}”");
  assert.equal(en("Crème brûlée"), "Crème brûlée");
  assert.equal(en("未经翻译的投稿原文"), "未经翻译的投稿原文");
  assert.match(en("验证码无效或已过期"), /invalid or has expired/);
  for (const [source, translated] of Object.entries(englishMessages)) {
    assert.equal(zh(source), source);
    assert.deepEqual([...translated.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...source.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), source);
    assert.doesNotMatch(translated, /\p{Script=Han}/u, source);
  }
  const files = ["app", "components/crous"].flatMap(dir => readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".tsx")).map(f => join(dir, String(f))));
  for (const file of files) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        assert.ok(Object.hasOwn(englishMessages, key), `${file}: missing translation: ${key}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const email = verificationEmail("en", "123456");
  assert.match(email.subject, /CROUS Court/);
  assert.match(email.text, /123456/);
  assert.match(email.html, /10 minutes/);
  assert.doesNotMatch(JSON.stringify(email), /\p{Script=Han}/u);
  assert.equal(verificationEmail("zh", "123456").subject, "CROUS法庭登录确认");
  assert.throws(() => verificationEmail("en", "<b>123"));
});

test("Dish labels prefer the matching confirmed language without translating original or legacy names", () => {
  const dish = { name: "Crème brûlée", zh: "焦糖布丁", canonicalNameFr: "Crème brûlée", canonicalNameEn: "Caramel custard", canonicalNameZh: "焦糖布丁", originalDescription: "My caramel dessert" };
  assert.deepEqual(dishPresentation(dish, "zh"), { primary: "焦糖布丁", secondary: null, card: "焦糖布丁" });
  assert.deepEqual(dishPresentation(dish, "en"), { primary: "Caramel custard", secondary: null, card: "Caramel custard" });
  assert.equal(dishPresentation({ ...dish, canonicalNameEn: null }, "en").primary, "My caramel dessert");
  assert.equal(dishPresentation({ ...dish, canonicalNameEn: null, originalDescription: "原始投稿" }, "en").primary, "原始投稿");
  assert.equal(dishPresentation({ ...dish, canonicalNameZh: null }, "zh").primary, "My caramel dessert");
  assert.equal(dishPresentation({ ...dish, canonicalNameEn: null, originalDescription: "" }, "en").primary, "Crème brûlée");
  assert.equal(dishPresentation({ name: "Mystery dish #1234", zh: "等待群众认菜" }, "en").primary, "Mystery dish #1234");
  assert.equal(dish.zh, "焦糖布丁");
  assert.equal(dish.originalDescription, "My caramel dessert");
  assert.equal(dish.canonicalNameFr, "Crème brûlée");
});
