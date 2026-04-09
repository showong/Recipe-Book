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

      const situationTag = (() => {
        if (highlight && highlight.length > 0) return highlight;
        if (taste && taste.length > 0) return taste;
        if (pairingText) return pairingText;
        return "집밥으로 딱";
      })();

      prompt = `You are given TWO images:
  - Image 1: a food photo → use as the full-bleed background
  - Image 2: the oh_showong brand logo (round badge with bear chef) → render it exactly as provided at the specified position

Create a 9:16 vertical Instagram Reels thumbnail (1080×1920px).

=== BACKGROUND ===
Fill the entire canvas with Image 1 (food photo). Slight saturation boost (+10%). Soft dark vignette at edges only. The food must be clearly visible and appetizing.

=== LAYER STACK ===

① oh_showong LOGO (Image 2)
  Position: top-right corner, 28px from top, 28px from right.
  Size: 130px diameter. Render the logo exactly as provided — do not alter colors or add effects.

② CONTEXT TAG — a small pill badge just above the food name
  Text: "${situationTag}" (short, max 10 chars)
  Style: rounded pill, background #FFE500 (bright yellow), text color #1A1A1A (black), bold, 32px.
  Padding: 8px 22px. Centered horizontally.
  Position: approx y=62% from top.

③ FOOD NAME — the hero text, centered horizontally
  Text: "${recipeName}"
  Position: y-center at 72% from top. Left/right margin 40px. Auto-wrap to 2 lines if needed.
  FONT STYLE (critical): thick, rounded, bubbly Korean display font — warm and playful, like Korean YouTube thumbnail text. NOT a corporate or geometric font.
  Fill color: #FFE500 (bright warm yellow).
  Stroke: thick black (#1A1A1A) outline, 7px, uniform around every character.
  Font size: 110px. Line-height: 125px.
  Drop shadow: 0 6px 16px rgba(0,0,0,0.70).

④ TAGLINE — one short line directly below ③, 12px gap
  Text: "@oh_showong"
  Font: semi-bold, white, 34px, letter-spacing 2px, opacity 0.85.
  Stroke: thin black outline, 2px.

⑤ BOTTOM STRIP — flush to bottom, full width, 200px tall
  Background: solid #FFE500 (warm yellow).
  Text: "지금 바로 도전! 🐻"
  Font: extra-bold, #1A1A1A, 44px. Horizontally + vertically centered.

=== RULES ===
- Top 55% of canvas: food photo dominates. ①logo only. No other elements above y=60%.
- ②③④ are grouped together in the lower-center area (y=62%~80%).
- ⑤ strip is at the very bottom, flush edge.
- The overall feel: warm, friendly, approachable — matching the oh_showong brand (cozy home cooking).
- NO cold/corporate vibes. Playful and energetic.
=== END ===`;

    // ── Post cover (1:1, 업로드된 음식 사진 기반) ───────────────────────────────
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
      void hasLogo; // used implicitly via logo image passed to Gemini

      const situationTag = (() => {
        if (highlight && highlight.length > 0) return highlight;
        if (taste && taste.length > 0) return taste;
        if (pairingText) return pairingText;
        return "집밥으로 딱";
      })();

      prompt = `You are given TWO images:
  - Image 1: a food photo → use as the full-bleed background
  - Image 2: the oh_showong brand logo (round badge with bear chef) → render it exactly as provided at the specified position

Create a 1:1 square Instagram feed post cover image (1080×1080px).

=== BACKGROUND ===
Fill the entire canvas with Image 1 (food photo). Slight saturation boost (+10%). Soft dark vignette at edges only.

=== LAYER STACK ===

① oh_showong LOGO (Image 2)
  Position: top-right corner, 20px from top, 20px from right.
  Size: 110px diameter. Render the logo exactly as provided.

② CONTEXT TAG — small pill badge above food name
  Text: "${situationTag}" (max 10 chars)
  Style: rounded pill, background #FFE500, text #1A1A1A, bold, 28px.
  Padding: 7px 18px. Centered horizontally.
  Position: approx y=58% from top.

③ FOOD NAME — hero text, centered horizontally
  Text: "${recipeName}"
  Position: y-center at 68% from top. Left/right margin 40px. Auto-wrap to 2 lines if needed.
  FONT STYLE (critical): thick, rounded, bubbly Korean display font — warm and playful, like Korean YouTube thumbnail text. NOT corporate/geometric.
  Fill color: #FFE500 (bright warm yellow).
  Stroke: thick black (#1A1A1A) outline, 6px, uniform around every character.
  Font size: 90px. Line-height: 104px.
  Drop shadow: 0 5px 14px rgba(0,0,0,0.70).

④ TAGLINE — directly below ③, 8px gap
  Text: "@oh_showong"
  Font: semi-bold, white, 28px, letter-spacing 2px, opacity 0.85.
  Stroke: thin black outline, 2px.

⑤ BOTTOM STRIP — flush to bottom, full width, 150px tall
  Background: solid #FFE500 (warm yellow).
  Text: "저장 필수! 🐻"
  Font: extra-bold, #1A1A1A, 34px. Horizontally + vertically centered.

=== RULES ===
- Top 52%: food photo only, ①logo only.
- ②③④ grouped in lower-center (y=58%~78%).
- ⑤ flush to bottom edge.
- Warm, friendly, cozy feel matching oh_showong brand.
=== END ===`;

    // ── English post cover (1:1) ──────────────────────────────────────────────
    } else if (type === "post-cover-en") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";

      const situationTagEn = (() => {
        if (highlight && highlight.length > 0) return highlight;
        if (taste && taste.length > 0) return taste;
        if (pairingText) return pairingText;
        return "Perfect home meal";
      })();

      prompt = `You are given TWO images:
  - Image 1: a food photo → use as the full-bleed background
  - Image 2: the oh_showong brand logo (round badge with bear chef) → render it exactly as provided at the specified position

Create a 1:1 square Instagram feed post cover image (1080×1080px) with ENGLISH text.

=== BACKGROUND ===
Fill the entire canvas with Image 1 (food photo). Slight saturation boost (+10%). Soft dark vignette at edges only.

=== LAYER STACK ===

① oh_showong LOGO (Image 2)
  Position: top-right corner, 20px from top, 20px from right.
  Size: 110px diameter. Render the logo exactly as provided.

② CONTEXT TAG — small pill badge above food name
  Text: "${situationTagEn}" (max 5 English words)
  Style: rounded pill, background #FFE500, text #1A1A1A, bold, 26px.
  Padding: 7px 18px. Centered horizontally.
  Position: approx y=58% from top.

③ FOOD NAME — hero text, centered horizontally
  Text: "${recipeName}"
  Position: y-center at 68% from top. Left/right margin 40px. Auto-wrap to 2 lines if needed.
  FONT STYLE (critical): thick, rounded, bubbly display font — warm and playful. NOT corporate/geometric.
  Fill color: #FFE500 (bright warm yellow).
  Stroke: thick black (#1A1A1A) outline, 6px, uniform around every character.
  Font size: 82px. Line-height: 96px.
  Drop shadow: 0 5px 14px rgba(0,0,0,0.70).

④ TAGLINE — directly below ③, 8px gap
  Text: "@oh_showong"
  Font: semi-bold, white, 28px, letter-spacing 2px, opacity 0.85.
  Stroke: thin black outline, 2px.

⑤ BOTTOM STRIP — flush to bottom, full width, 150px tall
  Background: solid #FFE500 (warm yellow).
  Text: "Save now! 🐻"
  Font: extra-bold, #1A1A1A, 34px. Horizontally + vertically centered.

=== RULES ===
- Top 52%: food photo only, ①logo only.
- ②③④ grouped in lower-center (y=58%~78%).
- ⑤ flush to bottom edge.
- ALL text must be in ENGLISH. No Korean characters.
- Warm, friendly, cozy feel matching oh_showong brand.
=== END ===`;

    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    // step-instagram은 곰 캐릭터 참조 이미지를 함께 전달
    // reel-thumbnail / post-cover / post-cover-en은 업로드된 음식 사진을 함께 전달
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
    } else if ((type === "reel-thumbnail" || type === "post-cover" || type === "post-cover-en") && uploadedImageBase64) {
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
