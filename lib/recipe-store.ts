import { promises as fs } from "fs";
import path from "path";
import { RecipeDetail } from "@/types/recipe";

// ── 파일 기반 레시피 저장소 ──────────────────────────────────────────────────
// DB가 없으므로 일반 유저가 생성한 레시피를 data/recipes.json 에 보관한다.
// (로컬 개발 환경 기준. Vercel 등 서버리스에서는 파일시스템이 영속되지 않음)

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "recipes.json");
const MAX_RECORDS = 100;

export interface SavedRecipeRecord {
  id: string;
  name: string;
  emoji: string;
  character: string;
  savedAt: string;
  recipe: RecipeDetail;
  heroImage?: string | null;
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

async function readAll(): Promise<SavedRecipeRecord[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 파일이 없거나 손상된 경우 빈 목록
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
    hasHeroImage: Boolean(r.heroImage),
  };
}

export async function listRecipes(): Promise<SavedRecipeSummary[]> {
  const all = await readAll();
  return all.map(toSummary);
}

export async function getRecipe(id: string): Promise<SavedRecipeRecord | null> {
  const all = await readAll();
  return all.find((r) => r.id === id) ?? null;
}

export async function saveRecipe(input: {
  recipe: RecipeDetail;
  character: string;
  heroImage?: string | null;
}): Promise<SavedRecipeRecord> {
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
    heroImage: input.heroImage ?? null,
  };

  const next = [record, ...filtered].slice(0, MAX_RECORDS);
  await writeAll(next);
  return record;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
