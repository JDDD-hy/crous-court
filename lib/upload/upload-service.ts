import { getBindings } from "@/db";
import { todayInParis } from "@/lib/calendar";
import { checkSanitizedImage } from "./image-validation";

type ItemInput = { slot: "main" | `side_${number}`; name: string; tier: number | null; dishId: string | null };

export class UploadInputError extends Error {}

export async function publishMeal(form: FormData, userId: string) {
  const venueId = requiredText(form, "venueId");
  const eatenOn = requiredText(form, "eatenOn");
  const mainTier = tier(form.get("mainTier"), true);
  const items = ([
    { slot: "main", name: text(form, "mainName"), tier: mainTier, dishId: optionalId(form, "mainDishId") },
    { slot: "side_1", name: text(form, "sideOneName"), tier: tier(form.get("sideOneTier"), false), dishId: optionalId(form, "sideOneDishId") },
    { slot: "side_2", name: text(form, "sideTwoName"), tier: tier(form.get("sideTwoTier"), false), dishId: optionalId(form, "sideTwoDishId") },
    ...Array.from({ length: 6 }, (_, index): ItemInput => {
      const slot = index + 3;
      return { slot: `side_${slot}`, name: text(form, `side${slot}Name`), tier: tier(form.get(`side${slot}Tier`), false), dishId: optionalId(form, `side${slot}DishId`) };
    }),
  ] satisfies ItemInput[]).filter((item) => item.slot === "main" || item.tier !== null);
  if (!isIsoDate(eatenOn)) throw new UploadInputError("请选择有效日期");
  if (eatenOn > todayInParis()) throw new UploadInputError("用餐日期不能穿越到未来");
  if (form.get("rightsConfirmed") !== "true") throw new UploadInputError("请确认照片发布权与无人脸信息");

  const canonicalFile = form.get("canonical");
  const thumbnailFile = form.get("thumbnail");
  if (!(canonicalFile instanceof File) || !(thumbnailFile instanceof File)) throw new UploadInputError("请选择并处理一张餐盘照片");
  let canonical;
  let thumbnail;
  try {
    [canonical, thumbnail] = await Promise.all([checkSanitizedImage(canonicalFile), checkSanitizedImage(thumbnailFile)]);
  } catch (error) {
    throw new UploadInputError(error instanceof Error ? error.message : "图片校验失败");
  }
  if (thumbnail.width > canonical.width || thumbnail.height > canonical.height) throw new UploadInputError("缩略图尺寸无效");

  const { db, bucket } = getBindings();
  const contentSha256 = await sha256(canonical.bytes);
  const duplicate = await db.prepare("SELECT meal_id FROM photos WHERE creator_id = ? AND content_sha256 = ?").bind(userId, contentSha256).first();
  if (duplicate) throw new UploadInputError("这张餐盘已经立过案了，请不要重复提交同一文件");
  const venue = await db.prepare("SELECT display_number FROM venues WHERE id = ? AND active = 1").bind(venueId).first<{ display_number: number }>();
  if (!venue) throw new UploadInputError("餐厅不可用");
  const now = Math.floor(Date.now() / 1000);
  const admitted = await db.prepare(`INSERT INTO upload_rate_limits (user_id,window_started_at,attempts) VALUES (?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET
      window_started_at = CASE WHEN upload_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE upload_rate_limits.window_started_at END,
      attempts = CASE WHEN upload_rate_limits.window_started_at <= ? THEN 1 ELSE upload_rate_limits.attempts + 1 END
    WHERE upload_rate_limits.window_started_at <= ? OR upload_rate_limits.attempts < 5
    RETURNING attempts`).bind(userId, now, now - 600, now - 600, now - 600).first();
  if (!admitted) throw new UploadInputError("投稿太频繁，请十分钟后再试");

  const mealId = crypto.randomUUID();
  const translationCandidates: Array<{ id: string; text: string }> = [];
  const photoId = crypto.randomUUID();
  const canonicalKey = `photos/${photoId}/canonical.jpg`;
  const thumbnailKey = `photos/${photoId}/thumbnail.jpg`;
  let committed = false;
  try {
    const writes = await Promise.allSettled([
      bucket.put(canonicalKey, canonical.bytes, { httpMetadata: { contentType: canonical.mediaType } }),
      bucket.put(thumbnailKey, thumbnail.bytes, { httpMetadata: { contentType: thumbnail.mediaType } }),
    ]);
    if (writes.some(result => result.status === "rejected")) throw new Error("Photo storage failed");
    const statements = [
      db.prepare("INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING").bind(userId),
      db.prepare("INSERT INTO daily_case_counters (eaten_on, venue_id, next_sequence) VALUES (?, ?, 1) ON CONFLICT(eaten_on, venue_id) DO UPDATE SET next_sequence = next_sequence + 1").bind(eatenOn, venueId),
      db.prepare("INSERT INTO meals (id, venue_id, creator_id, eaten_on, case_number, display_order) SELECT ?, ?, ?, ?, replace(?, '-', '') || '-' || display_number || '-' || printf('%03d', (SELECT next_sequence FROM daily_case_counters WHERE eaten_on = ? AND venue_id = ?)), (SELECT next_sequence FROM daily_case_counters WHERE eaten_on = ? AND venue_id = ?) FROM venues WHERE id = ?").bind(mealId, venueId, userId, eatenOn, eatenOn, eatenOn, venueId, eatenOn, venueId, venueId),
      db.prepare("INSERT INTO photos (id, meal_id, creator_id, canonical_key, thumbnail_key, media_type, width, height, byte_size, content_sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(photoId, mealId, userId, canonicalKey, thumbnailKey, canonical.mediaType, canonical.width, canonical.height, canonical.bytes.byteLength, contentSha256),
    ];
    for (const item of items) {
      const dishId = item.dishId ?? crypto.randomUUID();
      if (!item.dishId) translationCandidates.push({ id: dishId, text: item.name });
      const servingId = crypto.randomUUID();
      if (item.dishId) {
        const expectedCategory = item.slot === "main" ? "main" : "side";
        const existing = await db.prepare("SELECT id FROM dishes WHERE id = ? AND category = ? AND merged_into_dish_id IS NULL").bind(item.dishId, expectedCategory).first();
        if (!existing) throw new UploadInputError("选择的已有菜品已失效，请重新确认");
      }
      statements.push(
        ...(item.dishId ? [] : [db.prepare("INSERT INTO dishes (id, original_description, category, naming_status) VALUES (?, ?, ?, 'unknown')").bind(dishId, item.name, item.slot === "main" ? "main" : "side")]),
        db.prepare("INSERT INTO servings (id, dish_id, venue_id, served_on, creator_id, original_description, initial_tier) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(servingId, dishId, venueId, eatenOn, userId, item.name, item.tier),
        db.prepare("INSERT INTO meal_items (meal_id, serving_id, slot) VALUES (?, ?, ?)").bind(mealId, servingId, item.slot),
        db.prepare("INSERT INTO votes (id, dish_id, user_id, target_tier, source_serving_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(dish_id,user_id) DO NOTHING").bind(crypto.randomUUID(), dishId, userId, item.tier, servingId),
      );
    }
    await db.batch(statements);
    committed = true;
    const meal = await db.prepare("SELECT case_number FROM meals WHERE id = ?").bind(mealId).first<{ case_number: string }>();
    if (!meal) throw new Error("投稿记录创建失败");
    return { mealId, photoId, caseNumber: meal.case_number, translationCandidates };
  } catch (error) {
    if (!committed) await Promise.allSettled([bucket.delete(canonicalKey), bucket.delete(thumbnailKey)]);
    if (error instanceof Error && error.message.includes("dish_no_longer_active")) throw new UploadInputError("菜品刚刚被合并，请刷新后重新选择");
    throw error;
  }
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > 80) throw new UploadInputError("菜名或临时名称不能超过 80 个字符");
  return trimmed;
}

function requiredText(form: FormData, key: string) {
  const value = text(form, key);
  if (!value) throw new UploadInputError("投稿信息不完整");
  return value;
}

function optionalId(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || !value) return null;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new UploadInputError("已有菜品选择无效");
  return value;
}

async function sha256(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function tier(value: FormDataEntryValue | null, required: boolean) {
  if (!value && !required) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new UploadInputError("请选择有效等级");
  return parsed;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
