import { NextRequest, NextResponse } from "next/server";
import { recipeRepository } from "@/lib/recipe-store";
import { imageStore } from "@/lib/image-store";
import { requireAdmin } from "@/lib/auth/admin";

// GET /api/recipes            → 저장된 레시피 요약 목록
// GET /api/recipes?id=xxx     → 단일 레시피 전체 (heroImage + finishedImage URL 포함)
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const record = await recipeRepository.get(id);
      if (!record) {
        return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
      }
      const [heroImage, finishedImage] = await Promise.all([
        imageStore.resolve(record.heroImageRef),
        imageStore.resolve(record.finishedImageRef),
      ]);
      return NextResponse.json({ recipe: { ...record, heroImage, finishedImage } });
    }
    const recipes = await recipeRepository.list();
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
    const heroImageRef = heroImage ? await imageStore.put(heroImage) : null;
    const saved = await recipeRepository.save({
      recipe,
      character: character ?? "cute_bear",
      heroImageRef,
    });
    return NextResponse.json({ id: saved.id });
  } catch (error) {
    console.error("[recipes] POST error:", error);
    return NextResponse.json({ error: "레시피 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH /api/recipes?id=xxx → 완성 요리 사진 업데이트 { finishedImage: dataUrl }
export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    const { finishedImage } = await req.json();
    if (!finishedImage) {
      return NextResponse.json({ error: "finishedImage가 필요합니다." }, { status: 400 });
    }

    // 기존 완성 사진이 있으면 스토리지에서 삭제 후 새 이미지 저장
    const existing = await recipeRepository.get(id);
    if (!existing) {
      return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
    }
    if (existing.finishedImageRef) {
      await imageStore.remove(existing.finishedImageRef);
    }

    const finishedImageRef = await imageStore.put(finishedImage);
    const ok = await recipeRepository.patch(id, { finishedImageRef });
    if (!ok) {
      return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
    }
    const resolvedUrl = await imageStore.resolve(finishedImageRef);
    return NextResponse.json({ ok: true, finishedImageUrl: resolvedUrl });
  } catch (error) {
    console.error("[recipes] PATCH error:", error);
    return NextResponse.json({ error: "완성 사진 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE /api/recipes?id=xxx → 레시피 + 연결된 이미지 모두 삭제 (관리자 전용)
export async function DELETE(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    const record = await recipeRepository.get(id);
    if (record) {
      await Promise.all([
        imageStore.remove(record.heroImageRef),
        imageStore.remove(record.finishedImageRef),
      ]);
    }
    const ok = await recipeRepository.remove(id);
    if (!ok) {
      return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[recipes] DELETE error:", error);
    return NextResponse.json({ error: "레시피 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
