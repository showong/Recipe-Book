import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;


export async function POST(req: NextRequest) {
  try {
    const {
      recipeName, type, language,
      stepTitle, stepDescription, stepNumber, stepTime, totalSteps,
      ingredients, steps, kickSteps, highlight,
      uploadedImageBase64, uploadedImageMimeType,
      cookingTime, servings, taste, pairings, kickPoints,
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
      const langNote = isEn
        ? `TEXT LANGUAGE: English only. Quantities in metric + US units.`
        : `TEXT LANGUAGE: Korean (한국어) only.`;

      prompt = `You are given TWO reference images:
  - Image 1: LAYOUT TEMPLATE — this is the EXACT card style to reproduce. Match every detail: frame border, panel arrangement, label style, arrow style, badge, progress bar, instruction box.
  - Image 2: CHARACTER REFERENCE — use this bear chef's face, body proportions, hat, apron, and colors exactly. Do NOT alter the character design.

TASK: Create one cooking step card in the IDENTICAL style as Image 1 (Layout Template).

=== MATCH THESE EXACT VISUAL ELEMENTS FROM IMAGE 1 ===

CANVAS: Square 1:1. Warm cream background (#FFF8F0).
OUTER FRAME: Thick coral-orange (#FF6B35) rounded-rectangle border, ~14px, inset ~12px from edge.
STEP BADGE: Top-left corner, circle ~60px, fill #FF6B35, white bold step number, 3px white stroke.
THREE PANELS: Arranged horizontally, equal width, ~6px gaps. Each panel: white fill, ~10px rounded corners, thin #FF6B35 border.
ARROWS: Simple thick coral → arrows centered between panels at mid-height.
PANEL LABELS: At the very bottom of each panel, a rounded-rectangle pill, warm yellow (#FFE66D) fill, thin #FF6B35 border, centered text — short Korean action label (2–4자).
BEAR IN EVERY PANEL: Bear fills ~70% of panel height, actively cooking. Identical look to Image 2.
PROGRESS BAR: Full width inside the outer frame, just below the 3 panels. Height ~18px. Track: #FFE66D. Fill: #FF6B35. Filled = (stepNumber/totalSteps × 100)%.
INSTRUCTION BOX: Below progress bar, inside outer frame. White/cream fill, thin #FF6B35 border, 10px radius. Korean instruction text, 1–2 lines, #1A1A1A, ~18px, center-aligned.

=== CONTENT TO ILLUSTRATE ===

RECIPE: "${recipeName}"
STEP: ${stepNumber} of ${totalSteps}
STEP TITLE: "${stepTitle}"
INSTRUCTION: ${stepDescription}
${stepTime ? `TIME: ${stepTime}` : ""}
${langNote}

=== PANEL BREAKDOWN ===
Divide this step into exactly 3 micro-actions shown left-to-right.
Each panel:
  1. Bear performing the action with appropriate utensils / ingredients.
  2. Short action label at bottom (match the label pill style from Image 1).
Progress bar fill = ${stepNumber}/${totalSteps}.
Step badge number = ${stepNumber}.

Do NOT invent a new card layout. Copy the structure from Image 1 exactly.`;

    // ── Reel thumbnail (9:16, 업로드된 음식 사진 기반) ─────────────────────────
    } else if (type === "reel-thumbnail") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";

      prompt = `You are given TWO images:
  - Image 1: a food photo → use as the full-bleed background
  - Image 2: the oh_showong brand logo (round badge with bear chef) → render it exactly as provided at the specified position

Create a 9:16 vertical Instagram Reels thumbnail (1080×1920px).

=== BACKGROUND ===
Fill the entire canvas with Image 1 (food photo). Slight saturation boost (+10%). Soft dark vignette at edges only. The food must be clearly visible and appetizing — especially the center zone.

=== LAYER STACK ===

① oh_showong LOGO (Image 2)
  Position: top-right corner, 28px from top, 28px from right.
  Size: 130px diameter. Render the logo exactly as provided — do not alter colors or add effects.

② BRAND HANDLE — top-left, vertically aligned with the logo
  Text: "@oh_showong"
  Position: top-left, 42px from top, 28px from left.
  Font: semi-bold, white, 30px, letter-spacing 1.5px, opacity 0.90.
  Stroke: thin black outline, 2px.

③ BOTTOM DARK OVERLAY — covers bottom 28% of canvas (y=72% to bottom)
  Full-width gradient: fully transparent at y=72% → rgba(0,0,0,0.78) at y=82% and below.
  This guarantees text legibility regardless of food photo content.

④ FOOD NAME — hero text inside the dark overlay zone
  Text: "${recipeName}"
  Position: y-center at 80% from top. Left/right margin 44px. Auto-wrap to 2 lines if needed.
  FONT STYLE (critical): thick, rounded, bubbly Korean display font — warm and playful, like Korean YouTube thumbnail text. NOT a corporate or geometric font.
  Fill color: #FFE500 (bright warm yellow).
  Stroke: thick black (#1A1A1A) outline, 7px, uniform around every character.
  Font size: 110px. Line-height: 125px.
  Drop shadow: 0 6px 16px rgba(0,0,0,0.60).

⑤ CTA HOOK PILL — just above the bottom strip
  Style: rounded pill, background #FFE500 (bright yellow), text color #1A1A1A (black), bold, 30px.
  Padding: 8px 22px. Centered horizontally.
  Position: y-center at 91% from top.

  GENERATE the pill text yourself using these recipe signals:
    - Taste: "${taste ?? ""}"
    - Occasion/highlight: "${highlight ?? ""}"
    - Pairings: "${pairingText}"
    - Recipe name: "${recipeName}"
    - Kick points (what makes this recipe special): "${kickPoints ?? ""}"
  Rules for the pill text:
    - Korean only. Max 9 characters (no spaces counted). NO emoji inside the pill.
    - FOMO + CTA principle: the viewer must feel they are MISSING OUT and must act NOW.
    - Extract the most surprising, craveable, or exclusive insight from the kick points above.
    - Blend scarcity / urgency / crowd-proof with an irresistible CTA in ≤9 chars.
    - Strong FOMO examples: "안 만들면 손해" / "다들 만드는 중" / "요즘 난리남" / "숨은 꿀팁" / "안 먹어봤어?"
    - Strong CTA examples: "지금 바로 저장" / "반드시 해봐" / "오늘 꼭 도전" / "무조건 저장해"
    - NEVER use generic phrases: "맛있어요" / "집밥으로 딱" / "추천"

⑥ BOTTOM STRIP — flush to bottom, full width, 130px tall
  Background: solid #FFE500 (warm yellow).
  Text: "레시피 전체 보기 ▶"
  Font: extra-bold, #1A1A1A, 40px. Horizontally + vertically centered.

=== CRITICAL LAYOUT RULES ===
- CENTER ZONE (y=10% to y=72%): COMPLETELY FREE of all text, overlays, and UI elements. Only the food photo background is visible here. Absolutely no exceptions.
- TOP ZONE (y=0% to y=8%): ①logo (top-right) and ②handle (top-left) only.
- BOTTOM ZONE (y=72% to y=100%): ③overlay + ④food name + ⑤CTA pill + ⑥strip only.
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

② CONTEXT TAG — small yellow pill badge above food name
  Style: rounded pill, background #FFE500, text #1A1A1A, bold, 28px.
  Padding: 7px 18px. Centered horizontally.
  Position: approx y=58% from top.

  GENERATE the pill text yourself using these recipe signals:
    - Taste: "${taste ?? ""}"
    - Occasion/highlight: "${highlight ?? ""}"
    - Pairings: "${pairingText}"
    - Recipe name: "${recipeName}"
  Rules for the pill text:
    - Korean only. Max 9 characters (no spaces counted). NO emoji inside the pill.
    - Must feel like a punchy hook that triggers immediate curiosity or desire.
    - Pick the single strongest angle from: taste sensation, occasion fit, or social proof.
    - Good examples: "이 맛 실화?" / "무조건 저장" / "자취생 필수" / "한입에 반함" / "술안주 최고" / "다이어트 OK" / "손님상에 딱"
    - BAD (too generic): "맛있어요" / "집밥으로 딱" / "추천"

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

② CONTEXT TAG — small yellow pill badge above food name
  Style: rounded pill, background #FFE500, text #1A1A1A, bold, 26px.
  Padding: 7px 18px. Centered horizontally.
  Position: approx y=58% from top.

  GENERATE the pill text yourself using these recipe signals:
    - Taste: "${taste ?? ""}"
    - Occasion/highlight: "${highlight ?? ""}"
    - Pairings: "${pairingText}"
    - Recipe name: "${recipeName}"
  Rules for the pill text:
    - English only. Max 4 words. NO emoji inside the pill.
    - Must feel like a punchy hook that triggers immediate curiosity or desire.
    - Pick the single strongest angle: taste sensation, occasion, or social proof.
    - Good examples: "You'll make this daily" / "Must try!" / "Perfect date night" / "Insanely good" / "Great for meal prep" / "Under 20 mins"
    - BAD (too generic): "Delicious" / "Home cooking" / "Try this"

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

    // step-instagram: 레이아웃 템플릿(Image 1) + 곰 캐릭터 레퍼런스(Image 2) 함께 전달
    // reel-thumbnail / post-cover / post-cover-en은 업로드된 음식 사진을 함께 전달
    let contents;
    if (type === "step-instagram") {
      const templatePath = path.join(process.cwd(), "public", "step-card-template.jpeg");
      const bearPath = path.join(process.cwd(), "public", "chef-bear-reference.png");
      const templateBase64 = fs.readFileSync(templatePath).toString("base64");
      const bearBase64 = fs.readFileSync(bearPath).toString("base64");
      contents = [{
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: templateBase64 } }, // Image 1: layout
          { inlineData: { mimeType: "image/png",  data: bearBase64 } },     // Image 2: character
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
