import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── 공통 디자인 시스템 (한국어 / 영어 공통 적용) ─────────────────────────────
const STEP_DESIGN_BASE = `
=== FIXED DESIGN SYSTEM (apply identically to every image in this series) ===

CANVAS: Square 1:1 ratio, 1080×1080px equivalent.

BACKGROUND: Solid flat color #FFF8F0 (warm cream). No gradients, no textures.

OUTER FRAME: 24px rounded rectangle border, color #FF6B35 (coral orange), inset 16px from edge.

LAYOUT — always exactly 3 equal-width vertical panels side by side, separated by 8px gaps in #FF6B35.
  Each panel: white (#FFFFFF) fill, 12px inner padding.

ILLUSTRATION STYLE:
  - Flat vector cartoon. Zero photo-realism. No shading, no drop shadows.
  - Outlines: 3px uniform #1A1A1A strokes only.
  - Color palette (locked):
      Coral    #FF6B35  · Mint  #4ECDC4  · Lemon  #FFE66D
      Lavender #C7CEEA  · Cream #FFF8F0  · Dark   #1A1A1A  · White #FFFFFF

CHARACTER: Use the exact bear chef from the reference image.
  - Light golden-brown fluffy teddy bear, large sparkling dark eyes.
  - Tall white puffy toque blanche chef hat (from reference). NEVER omit the hat.
  - Beige/cream apron (from reference). Rosy cheeks, small dark nose, gentle smile.
  - Paw-shaped hands holding cooking utensils for each action.
  - Identical look across every panel: same proportions, colors, hat.

STEP BADGE: Top-left corner, circle 64px, fill #FF6B35, white bold number, 2px black stroke.

PROGRESS BAR: Bottom edge, inside frame. Height 20px, background #FFE66D.
  Filled = (stepNumber / totalSteps × 100)%, fill #FF6B35.

PANEL CONTENT: Each panel = one sequential micro-action. Arrow (→) between panels, 24px, #FF6B35.
=== END DESIGN SYSTEM ===
`;

// 한국어 텍스트 레이블 규칙
const KO_TEXT_RULE = `
TEXT LABELS (Korean — mandatory):
  - Each panel: short Korean action label (2–6자) in a #FFE66D pill badge at panel bottom-center.
  - Below the 3 panels: full Korean step instruction in one line, white box with #FF6B35 border 2px.
  - ALL text must be 한국어. No English, Chinese, or Japanese.
`;

// 영어 텍스트 레이블 규칙 (외국인 친화적)
const EN_TEXT_RULE = `
TEXT LABELS (English — mandatory):
  - Each panel: short English action verb phrase (2–4 words) in a #FFE66D pill badge at panel bottom-center.
    Use simple, clear verbs a cooking beginner understands (e.g. "Chop onions", "Stir gently", "Heat pan").
  - Below the 3 panels: the step instruction rewritten in plain English (max 15 words), white box with #FF6B35 border 2px.
    • Use everyday vocabulary, no jargon.
    • Include quantities in BOTH metric and US units where applicable (e.g. "200g / 7oz", "1 tbsp / 15ml").
  - ALL text must be English. No Korean, Chinese, or Japanese.
`;

export async function POST(req: NextRequest) {
  try {
    const {
      recipeName, type, language,
      stepTitle, stepDescription, stepNumber, stepTime, totalSteps,
      ingredients, steps, kickSteps, highlight,
      uploadedImageBase64, uploadedImageMimeType,
      cookingTime, servings, taste, pairings,
    } = await req.json();

    const isEn = language === "en";

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름이 필요합니다." }, { status: 400 });
    }

    let prompt = "";

    // ── Recipe card ──────────────────────────────────────────────────────────
    if (type === "recipe-card") {
      prompt = `A beautiful, appetizing professional food photography of Korean dish "${recipeName}".
Overhead shot, natural lighting, minimal props, clean white background, restaurant quality presentation.
Highly detailed, vibrant colors, mouth-watering. 4K quality.`;

    // ── Ingredients (1:1, 한/영 공통 구조) ────────────────────────────────────
    } else if (type === "ingredients") {
      const ingList = Array.isArray(ingredients)
        ? ingredients.map((i: { name: string; amount: string; unit: string }) =>
            isEn
              ? `${i.name} — ${i.amount}${i.unit}`
              : `${i.name} ${i.amount}${i.unit}`
          ).join(", ")
        : "";

      if (isEn) {
        prompt = `Create a square 1:1 Instagram flat-lay ingredients photo for Korean recipe "${recipeName}" aimed at international home cooks.

CANVAS: 1080×1080px square.
BACKGROUND: Clean white marble surface, soft natural daylight from top-left.

LAYOUT: Arrange each ingredient as a real, beautiful food item in a neat flat-lay grid. Every item clearly visible.

INGREDIENTS: ${ingList}

LABELS (mandatory for every ingredient):
  - Rounded pill label directly below each item. White background, thin #FF6B35 border.
  - Line 1: English ingredient name, bold, #1A1A1A, 18px. Use common English grocery store names.
  - Line 2: quantity in BOTH metric and US units (e.g. "200g / 7oz", "2 tbsp / 30ml"), #FF6B35, 16px.
  - All text in English. No Korean.

STYLE: Professional food photography, warm tones, Instagram-worthy. Beginner-friendly layout.`;
      } else {
        prompt = `Create a square 1:1 Instagram flat-lay ingredients photo for Korean recipe "${recipeName}".

CANVAS: 1080×1080px square.
BACKGROUND: Clean white marble surface, soft natural daylight from top-left.

LAYOUT: Arrange each ingredient as a real, beautiful food item in a neat flat-lay grid. Every item clearly visible.

INGREDIENTS: ${ingList}

LABELS (mandatory for every ingredient):
  - Rounded pill label directly below each item. White background, thin #FF6B35 border.
  - Line 1: Korean ingredient name (한국어), bold, #1A1A1A, 18px.
  - Line 2: quantity + unit (예: "200g", "2큰술"), #FF6B35, 16px.
  - All text must be Korean (한국어).

STYLE: Professional food photography, warm appetizing tones, Instagram-worthy.`;
      }

    // ── Step (simple photo) ──────────────────────────────────────────────────
    } else if (type === "step") {
      prompt = `Step-by-step cooking illustration showing "${stepTitle}" for Korean recipe "${recipeName}".
Close-up shot of hands cooking, natural kitchen setting, warm lighting.
Realistic, detailed, instructional food photography style.`;

    // ── Summary photo ────────────────────────────────────────────────────────
    } else if (type === "summary") {
      prompt = `Award-winning food photography of finished Korean dish "${recipeName}", beautifully plated.
Dark moody background, dramatic side lighting, fine dining presentation.
Steam rising, garnished, highly detailed. Magazine cover quality.`;

    // ── Instagram food photo (legacy) ────────────────────────────────────────
    } else if (type === "instagram") {
      const ingredientList = Array.isArray(ingredients)
        ? ingredients.map((i: { name: string; amount: string; unit: string }) => `${i.name} ${i.amount}${i.unit}`).join(", ")
        : "";
      const stepList = Array.isArray(steps)
        ? steps.map((s: { number: number; title: string }) => `${s.number}. ${s.title}`).join(" → ")
        : "";
      prompt = `Vertical portrait Instagram food post photo of Korean dish "${recipeName}".
Key ingredients: ${ingredientList}. Cooking steps: ${stepList}.
Vibrant, warm-toned professional food photography. Beautifully plated on a rustic wooden table.
Shallow depth of field, bokeh background, natural window light. Instagram-worthy. Magazine quality.`;

    // ── Kick / Success-points infographic (1:1) ───────────────────────────────
    } else if (type === "kick-instagram") {
      const kickList = Array.isArray(kickSteps)
        ? kickSteps.map((s: { number: number; title: string; kickReason: string }) =>
            isEn
              ? `• Step ${s.number} — ${s.title}: ${s.kickReason}`
              : `• 단계 ${s.number} — ${s.title}: ${s.kickReason}`
          ).join("\n")
        : "";

      if (isEn) {
        prompt = `Create a square 1:1 Instagram infographic poster — "Success Tips" for the recipe "${recipeName}", designed for international home cooks.

=== DESIGN SPEC ===
CANVAS: 1080×1080px square. Background: solid #FFF8F0 (warm cream).

HEADER (top 20%):
  Gradient banner #FF6B35 → #FFC857. Title: "✨ Success Tips" white bold 48px centered.
  Subtitle: "${recipeName}" white semi-bold 28px.

TIPS LIST (middle 62%):
  Each tip as a card: left accent bar #FF6B35 8px, step number circle badge #FF6B35, white fill #FFFFFF, 12px rounded corners.
  - Title: English bold #1A1A1A 24px. Use simple, encouraging cooking language.
  - Body: English plain text #555555 20px — rewrite the tip so a beginner clearly understands WHY it matters.
    Include measurements in metric + US units where relevant.
  Cards:
${kickList}

HIGHLIGHT STRIP: pill badge #FFE66D border #FF6B35 3px.
  Text: "💡 Key Point: ${highlight}" English bold #1A1A1A 20px.

FOOTER (bottom 8%): #FF6B35 background. White "Recipe Book" centered 22px bold.

STYLE: Flat design, friendly, encouraging tone. All text in English. No Korean.
=== END SPEC ===`;
      } else {
        prompt = `Create a square 1:1 Instagram infographic poster — 성공 포인트 for the Korean recipe "${recipeName}".

=== DESIGN SPEC ===
CANVAS: 1080×1080px square. Background: solid #FFF8F0 (warm cream).

HEADER (top 20%):
  Gradient banner #FF6B35 → #FFC857. Title: "⭐ 성공 포인트" white bold 48px centered.
  Subtitle: "${recipeName}" white semi-bold 28px.

KICK POINTS LIST (middle 62%):
  Each kick point as a card: left accent bar #FF6B35 8px, step number circle badge #FF6B35, white #FFFFFF fill, 12px rounded corners.
  - Title: Korean bold #1A1A1A 24px.
  - Body: Korean regular text #555555 20px, wrapped to card width.
  Cards:
${kickList}

HIGHLIGHT STRIP: pill badge #FFE66D border #FF6B35 3px.
  Text: "💡 핵심: ${highlight}" Korean bold #1A1A1A 20px.

FOOTER (bottom 8%): #FF6B35. White "레시피북" centered 22px bold.

STYLE: Flat design. All text Korean (한국어). No English.
=== END SPEC ===`;
      }

    // ── Step-instagram (bear character, 한/영) ────────────────────────────────
    } else if (type === "step-instagram") {
      const textRule = isEn ? EN_TEXT_RULE : KO_TEXT_RULE;
      const langNote = isEn
        ? `NOTE: This card is for INTERNATIONAL viewers. All text must be in clear, simple English. Quantities in metric + US units.`
        : `NOTE: This card is for Korean viewers. All text must be in Korean (한국어).`;

      prompt = `Generate a cooking step illustration card for a recipe series.
${STEP_DESIGN_BASE}
${textRule}
${langNote}

RECIPE: "${recipeName}"
STEP: ${stepNumber} of ${totalSteps}
STEP TITLE: "${stepTitle}"
INSTRUCTION: ${stepDescription}
${stepTime ? `TIME: ${stepTime}` : ""}

TASK: Illustrate this single cooking step across exactly 3 sequential panels.
- Draw the bear chef character EXACTLY as shown in the reference image (same face, hat, apron).
- The bear must appear in every panel actively performing the cooking action.
- Show specific ingredients and utensils using only the locked color palette.
- Follow all TEXT LABEL rules above precisely.
- Fill the progress bar to ${stepNumber}/${totalSteps}.
- Place the step number badge (${stepNumber}) at top-left.`;

    // ── Reel thumbnail (9:16, 업로드된 음식 사진 기반) ─────────────────────────
    } else if (type === "reel-thumbnail") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";
      const hasLogo = (() => {
        for (const ext of ["png", "jpg", "jpeg", "webp"]) {
          const p = path.join(process.cwd(), "public", `oh_showong_logo.${ext}`);
          if (fs.existsSync(p)) return true;
        }
        return false;
      })();

      prompt = `Create a 9:16 vertical Instagram Reels thumbnail for the Korean food recipe "${recipeName}".

=== CANVAS & BASE ===
Size: 1080×1920px (9:16). Fill entirely with the provided food photo.
Apply a cinematic grade: slightly boosted saturation, gentle dark vignette at the very edges only.

=== BRAND MARK (top-left corner, 32px from each edge) ===
${hasLogo
  ? `Place the provided logo image here — 110px wide, preserve aspect ratio, white drop-shadow filter.`
  : `Text: "@oh_showong" white bold 28px, pill background rgba(0,0,0,0.45), 8px 16px padding, 20px border-radius.`}

=== CENTER ZONE (10% – 72% from top) ===
COMPLETELY EMPTY. No text, no overlays, no shapes. The food photo is fully visible here.

=== BOTTOM OVERLAY (bottom 28%) ===
A smooth gradient from fully transparent (at 72% from top) to rgba(0,0,0,0.78) at the very bottom.
This darkened area is the only zone where text appears.

=== FOOD NAME (bottom zone, center of the overlay ~18% from bottom) ===
"${recipeName}" — white, ultra-bold, 80px, centered, tight tracking.
Text shadow: 0 4px 20px rgba(0,0,0,0.80).

=== CTA HOOK (just above the bottom strip, ~8% from bottom) ===
Pick the single most mouth-watering hook from the options below (max 14 Korean characters):
  - Taste hook: based on "${taste ?? ""}"
  - Pairing hook: based on "${pairingText}"
  - Occasion hook: based on "${highlight ?? ""}"
Examples of great hooks: "달콤 짭조름한 그 맛 🍯" / "와인이랑 완벽 페어링 🍷" / "주말 브런치로 딱 👌" / "홈파티 필수 메뉴 🎉"
Style: rounded pill, background rgba(255,107,53,0.80), white bold 32px, horizontal padding 22px, vertical 8px.

=== BOTTOM STRIP (bottom 7%) ===
Full-width strip: gradient left #FF6B35 → right #ec4899, opacity 0.90.
Text: "레시피 전체 보기 ▶" white ultra-bold 28px centered.

=== RULES ===
- CRITICAL: The center 62% of the canvas (from 10% to 72%) must have zero text or opaque overlays.
- Only 3 text elements total: brand mark (top) + food name + CTA hook (both bottom zone only).
- The food photo is the hero — text frames it, never covers it.
- Cinematic, premium, appetite-inducing. Ready to post on Instagram Reels.
=== END SPEC ===`;

    // ── Post cover (3:4, 업로드된 음식 사진 기반) ───────────────────────────────
    } else if (type === "post-cover") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";
      const hasLogo = (() => {
        for (const ext of ["png", "jpg", "jpeg", "webp"]) {
          const p = path.join(process.cwd(), "public", `oh_showong_logo.${ext}`);
          if (fs.existsSync(p)) return true;
        }
        return false;
      })();

      prompt = `Create a 3:4 vertical Instagram feed post cover image for the Korean food recipe "${recipeName}".

=== CANVAS & BASE ===
Size: 1080×1440px (3:4). Fill entirely with the provided food photo.
Apply a warm cinematic grade: slightly boosted saturation, gentle dark vignette at edges only.

=== BRAND MARK (top-left corner, 28px from each edge) ===
${hasLogo
  ? `Place the provided logo image here — 100px wide, preserve aspect ratio, white drop-shadow filter.`
  : `Text: "@oh_showong" white bold 26px, pill background rgba(0,0,0,0.45), 8px 14px padding, 18px border-radius.`}

=== CENTER ZONE (10% – 68% from top) ===
COMPLETELY EMPTY. No text, no overlays, no shapes. Food photo fully visible.

=== BOTTOM OVERLAY (bottom 32%) ===
Smooth gradient: fully transparent at 68% from top → rgba(0,0,0,0.80) at bottom.

=== FOOD NAME (bottom zone, ~20% from bottom) ===
"${recipeName}" — white, ultra-bold, 72px, centered, tight tracking.
Text shadow: 0 4px 20px rgba(0,0,0,0.85).

=== CURIOSITY HOOK (just above bottom strip, ~9% from bottom) ===
Write a single short Korean phrase (max 16 chars) that sparks curiosity and makes the viewer want to swipe/read more.
Choose the most compelling angle from:
  - Taste: "${taste ?? ""}"
  - Pairing: "${pairingText}"
  - Occasion / highlight: "${highlight ?? ""}"
Examples: "이 맛 알면 매일 만든다 👀" / "레시피 숨겨왔던 이유 있어 🤫" / "한 번 만들면 단골 메뉴 💯"
Style: rounded pill, background rgba(255,107,53,0.85), white bold 30px, horizontal padding 20px, vertical 8px.

=== BOTTOM STRIP (bottom 7%) ===
Full-width strip: gradient left #FF6B35 → right #ec4899, opacity 0.90.
Text: "레시피 전체 보기 →" white ultra-bold 26px centered.

=== RULES ===
- CRITICAL: Center 10–68% of canvas must have zero text or opaque overlays.
- Only 3 text elements: brand (top) + food name + curiosity hook (both bottom zone).
- Feed post format — appetizing, scroll-stopping, makes viewer tap to see the full recipe.
- Cinematic, premium, warm tones.
=== END SPEC ===`;

    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    // step-instagram은 곰 캐릭터 참조 이미지를 함께 전달
    // reel-thumbnail / post-cover는 업로드된 음식 사진을 함께 전달
    let contents;
    if (type === "step-instagram") {
      const refImagePath = path.join(process.cwd(), "public", "chef-bear-reference.png");
      const refImageBase64 = fs.readFileSync(refImagePath).toString("base64");
      contents = [{
        parts: [
          { inlineData: { mimeType: "image/png", data: refImageBase64 } },
          { text: prompt },
        ],
      }];
    } else if ((type === "reel-thumbnail" || type === "post-cover") && uploadedImageBase64) {
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
        { inlineData: { mimeType: uploadedImageMimeType ?? "image/jpeg", data: uploadedImageBase64 } },
      ];
      // 로고 파일이 있으면 함께 전달
      for (const ext of ["png", "jpg", "jpeg", "webp"]) {
        const logoPath = path.join(process.cwd(), "public", `oh_showong_logo.${ext}`);
        if (fs.existsSync(logoPath)) {
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
          parts.push({ inlineData: { mimeType: mime, data: fs.readFileSync(logoPath).toString("base64") } });
          break;
        }
      }
      parts.push({ text: prompt });
      contents = [{ parts }];
    } else {
      contents = [{ parts: [{ text: prompt }] }];
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);

    if (!imagePart) {
      throw new Error("Gemini API가 이미지를 반환하지 않았습니다.");
    }

    const { mimeType, data: base64 } = imagePart.inlineData;
    return NextResponse.json({ imageUrl: `data:${mimeType};base64,${base64}` });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Image generation error:", message);
    return NextResponse.json(
      { error: `이미지 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
