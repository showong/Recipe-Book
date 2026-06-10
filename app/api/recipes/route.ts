import { NextRequest, NextResponse } from "next/server";
import {
  listRecipes,
  getRecipe,
  saveRecipe,
  deleteRecipe,
} from "@/lib/recipe-store";

// GET /api/recipes            → 저장된 레시피 요약 목록
// GET /api/recipes?id=xxx     → 단일 레시피 전체 (상세 + heroImage)
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const record = await getRecipe(id);
      if (!record) {
        return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({ recipe: record });
    }
    const recipes = await listRecipes();
    return NextResponse.json({ recipes });
  } catch (error) {
    console.error("[recipes] GET error:", error);
    return NextResponse.json({ error: "레시피 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST /api/recipes → 레시피 저장 { recipe, character, heroImage? }
export async function POST(req: NextRequest) {
  try {
    const { recipe, character, heroImage } = await req.json();
    if (!recipe || !recipe.name || !Array.isArray(recipe.steps)) {
      return NextResponse.json({ error: "유효한 레시피 데이터가 아닙니다." }, { status: 400 });
    }
    const saved = await saveRecipe({
      recipe,
      character: character ?? "cute_bear",
      heroImage: heroImage ?? null,
    });
    return NextResponse.json({ id: saved.id });
  } catch (error) {
    console.error("[recipes] POST error:", error);
    return NextResponse.json({ error: "레시피 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE /api/recipes?id=xxx → 레시피 삭제
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    const ok = await deleteRecipe(id);
    if (!ok) {
      return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[recipes] DELETE error:", error);
    return NextResponse.json({ error: "레시피 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
