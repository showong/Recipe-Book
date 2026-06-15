import { promises as fs } from "fs";
import path from "path";
import { RecipeDetail } from "@/types/recipe";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { supabaseRecipeRepository } from "@/lib/stores/supabase-recipe-store";

export interface SavedRecipeRecord {
  id: string;
  name: string;
  emoji: string;
  character: string;
  savedAt: string;
  recipe: RecipeDetail;
  heroImageRef?: string | null;
  finishedImageRef?: string | null;
  detailImageRef?: string | null;
}

export interface SavedRecipeSummary {
  id: string;
  name: string;
  emoji: string;
  character: string;
  savedAt: string;
  totalTime: string;
  servings: number;
  difficulty: string;
  hasHeroImage: boolean;
  hasFinishedImage: boolean;
  hasDetailImage: boolean;
}

export interface SaveRecipeInput {
  recipe: RecipeDetail;
  character: string;
  heroImageRef?: string | null;
  finishedImageRef?: string | null;
}

export interface PatchRecipeInput {
  finishedImageRef?: string | null;
  detailImageRef?: string | null;
}

export interface RecipeRepository {
  list(): Promise<SavedRecipeSummary[]>;
  get(id: string): Promise<SavedRecipeRecord | null>;
  save(input: SaveRecipeInput): Promise<SavedRecipeRecord>;
  patch(id: string, update: PatchRecipeInput): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

// ── 파일 기반 구현 ───────────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "recipes.json");
const MAX_RECORDS = 100;

async function readAll(): Promise<SavedRecipeRecord[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records: SavedRecipeRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

function toSummary(r: SavedRecipeRecord): SavedRecipeSummary {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    character: r.character,
    savedAt: r.savedAt,
    totalTime: r.recipe.totalTime,
    servings: r.recipe.servings,
    difficulty: r.recipe.difficulty,
    hasHeroImage: Boolean(r.heroImageRef),
    hasFinishedImage: Boolean(r.finishedImageRef),
    hasDetailImage: Boolean(r.detailImageRef),
  };
}

const fileRecipeRepository: RecipeRepository = {
  async list() {
    const all = await readAll();
    return all.map(toSummary);
  },

  async get(id) {
    const all = await readAll();
    return all.find((r) => r.id === id) ?? null;
  },

  async save(input) {
    const all = await readAll();
    const filtered = all.filter(
      (r) => !(r.name === input.recipe.name && r.character === input.character),
    );
    const record: SavedRecipeRecord = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: input.recipe.name,
      emoji: input.recipe.emoji,
      character: input.character,
      savedAt: new Date().toISOString(),
      recipe: input.recipe,
      heroImageRef: input.heroImageRef ?? null,
      finishedImageRef: input.finishedImageRef ?? null,
      detailImageRef: null,
    };
    const next = [record, ...filtered].slice(0, MAX_RECORDS);
    await writeAll(next);
    return record;
  },

  async patch(id, update) {
    const all = await readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    all[idx] = { ...all[idx], ...update };
    await writeAll(all);
    return true;
  },

  async remove(id) {
    const all = await readAll();
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    await writeAll(next);
    return true;
  },
};

// 🔌 Supabase 환경변수가 설정되면 자동으로 Supabase(Postgres) 구현을 사용한다.
//    (미설정 시 data/recipes.json 파일 기반으로 동작 → 로컬 개발 흐름 유지)
export const recipeRepository: RecipeRepository = isSupabaseConfigured()
  ? supabaseRecipeRepository
  : fileRecipeRepository;
