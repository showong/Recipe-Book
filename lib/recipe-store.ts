import { promises as fs } from "fs";
import path from "path";
import { RecipeDetail } from "@/types/recipe";

/**
 * 레시피 영속 계층 (Repository).
 *
 * - 현재(MVP): data/recipes.json 파일 기반.
 * - 배포 시: RecipeRepository 인터페이스를 DB 구현(Postgres / Supabase / Turso 등)으로
 *   교체하고, 파일 맨 아래의 `recipeRepository` export만 바꾸면 된다.
 *
 * 이미지는 여기 저장하지 않는다. base64 대신 ImageStore가 반환한 ref(heroImageRef)만
 * 보관하므로, 이미지는 오브젝트 스토리지로 따로 옮기기 쉽다.
 */

export interface SavedRecipeRecord {
  id: string;
  name: string;
  emoji: string;
  character: string;
  savedAt: string;
  recipe: RecipeDetail;
  heroImageRef?: string | null;
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
}

export interface SaveRecipeInput {
  recipe: RecipeDetail;
  character: string;
  heroImageRef?: string | null;
}

export interface RecipeRepository {
  list(): Promise<SavedRecipeSummary[]>;
  get(id: string): Promise<SavedRecipeRecord | null>;
  save(input: SaveRecipeInput): Promise<SavedRecipeRecord>;
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
    // 같은 이름 + 캐릭터 조합은 최신본으로 갱신 (중복 누적 방지)
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
    };
    const next = [record, ...filtered].slice(0, MAX_RECORDS);
    await writeAll(next);
    return record;
  },

  async remove(id) {
    const all = await readAll();
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    await writeAll(next);
    return true;
  },
};

// 🔌 배포 시 여기만 DB 구현으로 교체
export const recipeRepository: RecipeRepository = fileRecipeRepository;
