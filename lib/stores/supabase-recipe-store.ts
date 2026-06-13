import type { RecipeDetail } from "@/types/recipe";
import type {
  RecipeRepository,
  SavedRecipeRecord,
  SavedRecipeSummary,
} from "@/lib/recipe-store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Supabase(Postgres) 기반 RecipeRepository 구현.
 * 스키마는 supabase/schema.sql 참고. 이미지는 여기 저장하지 않고 ref(hero_image_ref)만 보관한다.
 */

const TABLE = "recipes";
const MAX_RECORDS = 100;

interface Row {
  id: string;
  name: string;
  emoji: string;
  character: string;
  saved_at: string;
  recipe: RecipeDetail;
  hero_image_ref: string | null;
}

function rowToRecord(r: Row): SavedRecipeRecord {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    character: r.character,
    savedAt: r.saved_at,
    recipe: r.recipe,
    heroImageRef: r.hero_image_ref,
  };
}

function rowToSummary(r: Row): SavedRecipeSummary {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    character: r.character,
    savedAt: r.saved_at,
    totalTime: r.recipe.totalTime,
    servings: r.recipe.servings,
    difficulty: r.recipe.difficulty,
    hasHeroImage: Boolean(r.hero_image_ref),
  };
}

export const supabaseRecipeRepository: RecipeRepository = {
  async list() {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .order("saved_at", { ascending: false })
      .limit(MAX_RECORDS);
    if (error) throw new Error(`레시피 목록 조회 실패: ${error.message}`);
    return ((data ?? []) as Row[]).map(rowToSummary);
  },

  async get(id) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`레시피 조회 실패: ${error.message}`);
    return data ? rowToRecord(data as Row) : null;
  },

  async save(input) {
    const sb = getSupabaseAdmin();
    // 같은 이름 + 캐릭터 조합은 최신본으로 갱신 (중복 누적 방지)
    await sb.from(TABLE).delete().eq("name", input.recipe.name).eq("character", input.character);

    const record: SavedRecipeRecord = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: input.recipe.name,
      emoji: input.recipe.emoji,
      character: input.character,
      savedAt: new Date().toISOString(),
      recipe: input.recipe,
      heroImageRef: input.heroImageRef ?? null,
    };

    const { error } = await sb.from(TABLE).insert({
      id: record.id,
      name: record.name,
      emoji: record.emoji,
      character: record.character,
      saved_at: record.savedAt,
      recipe: record.recipe,
      hero_image_ref: record.heroImageRef,
    });
    if (error) throw new Error(`레시피 저장 실패: ${error.message}`);
    return record;
  },

  async remove(id) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).delete().eq("id", id).select("id");
    if (error) throw new Error(`레시피 삭제 실패: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  },
};
