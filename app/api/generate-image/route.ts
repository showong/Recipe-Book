import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── 5가지 썸네일 스타일 정의 ──────────────────────────────────────────────────
const THUMBNAIL_STYLES = [
  { id: 1, name: "무드 에디토리얼", file: "thumb-style-1.jpeg" },
  { id: 2, name: "볼드 컬러 포스터", file: "thumb-style-2.jpeg" },
  { id: 3, name: "드라마틱 클로즈업", file: "thumb-style-3.jpeg" },
  { id: 4, name: "레시피 인포그래픽", file: "thumb-style-4.jpeg" },
  { id: 5, name: "내추럴 오가닉", file: "thumb-style-5.jpeg" },
  { id: 6, name: "TV 요리쇼", file: "thumb-style-6.jpeg" },
] as const;

function buildThumbnailPrompt(
  styleId: number,
  recipeName: string,
  taste: string,
  highlight: string,
  kickPoints: string,
  pairingText: string,
  character: string = "cute",
): string {
  const base = `
You are given THREE images:
  - Image 1: uploaded food photo
  - Image 2: LAYOUT REFERENCE — reproduce this visual style exactly (layout, typography placement, background treatment, color mood)
  - Image 3: oh_showong brand logo → place as specified

Canvas: 9:16 vertical. Recipe: "${recipeName}".
FOMO signals — Taste: "${taste}" / Highlight: "${highlight}" / Kick: "${kickPoints}" / Pairs: "${pairingText}"

⚠️ STRICT RULE: The image must contain ONLY the recipe name, hook text, and brand handle as visible text.
Do NOT render any numbers, units, percentages, color codes, opacity values, pixel sizes, or technical specification terms as visible text anywhere in the image.
`;

  const styles: Record<number, string> = {
    1: `${base}
=== STYLE: 무드 에디토리얼 (Image 2 reference) ===
BACKGROUND: Food photo fills entire canvas. Apply moody darkening — reduce brightness slightly, subtle desaturation. Dark semi-transparent overlay on the lower half.
LOGO (Image 3): top-right corner, small inset from the edge, medium size.
BRAND HANDLE: "@oh_showong" — small coral (#FF6B35) bold text, bottom-center, just above the recipe name.
RECIPE NAME: positioned in the lower third of the canvas. Extra-large serif/display bold Korean font, white, left-aligned with generous left margin. Up to 2 lines.
HOOK LINE: one short line just above the recipe name. White, semi-bold, medium size, slightly faded. Generate from FOMO signals — editorial tone, max 20 chars.${character === "lazy" ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".` : ""}
STYLE RULE: sophisticated, minimal, editorial. NO pill badges, NO colorful overlays. Clean white type on dark photo.`,

    2: `${base}
=== STYLE: 볼드 컬러 포스터 (Image 2 reference) ===
BACKGROUND: Do NOT use food photo as background. Solid bright warm color — choose from #FF6B35 (coral), #FF8C00 (orange), or #E63946 (red) based on food mood.
LOGO (Image 3): bottom-right corner, inside a small white softly-rounded badge with a little padding.
LAYOUT (top to bottom):
  ① Recipe name: upper quarter of canvas, massive chunky sans-serif, white, center-aligned. Up to 2 lines.
  ② One appetizing descriptor line: white semi-bold, medium size, center, just below the recipe name. Generate from taste/highlight, max 20 chars.${character === "lazy" ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".` : ""}
  ③ Food photo: center of canvas, cutout style with slight drop shadow, natural circular or oval shape, slightly tilted.
  ④ Brand logo badge: bottom-right corner.
STYLE RULE: high-contrast bold poster. Energetic, pop-art food brand feel.`,

    3: `${base}
=== STYLE: 드라마틱 클로즈업 (Image 2 reference) ===
BACKGROUND: Food photo fills canvas. Darken to near-black mood with boosted contrast. Food is dramatically close-up, cropped to show texture.
LOGO (Image 3): top-right corner, small inset from the edge, medium size.
TEXT BLOCK (center of canvas, slightly below midpoint):
  ① HOOK LINE: upper part of the text block, small bold white Korean, center. Generate urgent hook from FOMO signals — max 14 chars (e.g. "이 맛 실화?").${character === "lazy" ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".` : ""}
  ② RECIPE NAME: below the hook, enormous bold Korean display font, center. White fill with thick dark outline. Up to 2 lines.
BRAND: "@oh_showong" — very small white text, below the recipe name, center.
STYLE RULE: YouTube/Shorts thumbnail energy. Maximum drama. Bold strokes on text.`,

    4: `${base}
=== STYLE: 레시피 인포그래픽 (Image 2 reference) ===
BACKGROUND: Warm cream (#FFF5E6). No photo as background.
LAYOUT (top to bottom):
  ① TITLE BAR (top fifth of canvas): recipe name in large bold Korean, #2C1810, center. Subtitle below: taste/highlight phrase, #8B4513, small.
  ② FOOD PHOTO (upper-center area): centered, large natural presentation, slight drop shadow.
  ③ INGREDIENTS COLUMNS (below the photo): two columns flanking a center divider line.
     Left: "재료" header + top 3 ingredients as icon+text rows.
     Right: "양념" header + top 3 seasoning items. Small font, #2C1810.
  ④ HIGHLIGHT BOX (near the bottom): full-width, background #FF6B35, white bold text, softly rounded corners.
     Text: "포인트: " + kickpoint or highlight phrase.${character === "lazy" ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".` : ""}
  ⑤ Logo (Image 3): bottom-right corner, small.
STYLE RULE: educational, structured, warm. Like a recipe card someone would save.`,

    5: `${base}
=== STYLE: 내추럴 오가닉 (Image 2 reference) ===
BACKGROUND: Light cream/linen (#F8F5EF). Subtle paper texture feel.
LAYOUT (top to bottom):
  ① TOP BAR (very top strip): "@oh_showong" centered, small handwritten-style font, #5C4A2A.
     Logo (Image 3): top-center or top-right, small.
  ② MAIN TITLE (upper third of canvas): large brush/calligraphy-style Korean display font.
     Color: deep earthy green (#2D4A1E) or warm brown (#6B3A2A). Center. Up to 2 lines.
  ③ THIN DIVIDER LINE: horizontal, #C4B49A, full width with generous side margins, just below the title.
  ④ TAGLINE (just below the divider): one warm natural phrase, center, #7A6A5A, small italic.
     Generate from taste/highlight/pairings — natural, non-clickbait tone, max 22 chars.${character === "lazy" ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".` : ""}
  ⑤ FOOD PHOTO (lower half of canvas): natural placement, slightly overlapping the tagline. Real appetizing photo.
  ⑥ DECORATIVE ELEMENTS: soft watercolor leaf or dot motifs at top-left and bottom-right corners.
STYLE RULE: artisanal, farmers-market, trustworthy. Warm but sophisticated.`,

    6: `${base}
=== STYLE: TV 요리쇼 ===
BACKGROUND: Food photo (Image 1) fills the entire 9:16 canvas. Keep it natural, bright, and appetizing — do NOT heavily darken the center. Apply dark gradient overlays only at the top strip (top 25%) and bottom strip (bottom 20%) to make text readable.
LAYOUT (top to bottom):
  ① TOP HOOK (top 8–22% of canvas): 1–2 bold hook lines, center-aligned. White extra-bold Korean font with subtle dark text shadow.
     Line 1: short punchy accent (e.g. "딱 10분만!" / "집밥의 완성!") — medium-large size. Generate from FOMO signals, max 10 chars.
     Line 2 (optional): secondary hook if needed — slightly smaller. Max 14 chars.
  ② CENTER (22–76%): Food photo fully visible. Absolutely NO text in this zone.
  ③ RECIPE NAME (76–93% of canvas): Dish name in enormous Korean ultra-bold font, center-aligned.
     Color: bright orange (#FF8C00) with thick black stroke outline, OR pure white with thick black outline.
     Size: as large as possible while fitting. Up to 2 lines.
  ④ BOTTOM TAGLINE (93–97%): One very short taste/mood phrase. White, small semi-transparent text, center. Max 16 chars. Generate from taste/pairings.
LOGO (Image 3): top-right corner, very small, semi-transparent.
STYLE RULE: YouTube cooking channel / TV recipe broadcast thumbnail energy. The food photo is the hero. Text reads like a broadcast chyron — confident, punchy, instantly legible.${character === "lazy" ? ` Hook tone: dry master-chef confidence. Examples: "마트 안 갔음", "집에 있던 거로", "귀찮은데 맛있음".` : ""}`,
  };

  return styles[styleId] ?? styles[1];
}

// ── 게시글 커버 (1:1) 스타일별 프롬프트 ──────────────────────────────────────
function buildPostCoverPrompt(
  styleId: number,
  recipeName: string,
  taste: string,
  highlight: string,
  pairingText: string,
  lang: "ko" | "en",
  character: string = "cute",
): string {
  const isEn = lang === "en";

  const hookRules = isEn
    ? `Generate a punchy English pill text (max 4 words). Examples: "Must try!", "Perfect date night", "Insanely good". No Korean.`
    : `Generate a punchy Korean pill text (max 9 chars). Examples: "이 맛 실화?" / "무조건 저장" / "술안주 최고". No English.`;

  const lazyCtaHint = character === "lazy"
    ? ` For the CTA hook pill text, use efficiency/laziness themed content like "5분이면 끝", "쉽고 맛있음", "노력 최소 맛 최대".`
    : "";

  const nameText = `"${recipeName}"`;
  const bottomText = isEn ? `"Save now! 🐻"` : `"저장 필수! 🐻"`;
  const langRule = isEn
    ? `ALL visible text must be in ENGLISH. No Korean characters.`
    : `ALL visible text must be in Korean (한국어). No English.`;

  const base = `
You are given THREE images:
  - Image 1: uploaded food photo
  - Image 2: LAYOUT REFERENCE — reproduce this visual style exactly (layout, typography placement, background treatment, color mood)
  - Image 3: oh_showong brand logo → place as specified

Canvas: 1:1 square. Recipe: ${nameText}.
FOMO signals — Taste: "${taste}" / Highlight: "${highlight}" / Pairs: "${pairingText}"

⚠️ STRICT RULES:
1. Do NOT render any numbers with units (px, %, opacity decimals, color codes) as visible text in the image.
2. ${langRule}
`;

  const styles: Record<number, string> = {
    1: `${base}
=== STYLE: 무드 에디토리얼 — Square (Image 2 reference) ===
BACKGROUND: Food photo fills entire canvas. Moody darkening — slightly reduced brightness and saturation. Dark semi-transparent overlay on the lower half.
LOGO (Image 3): top-right corner, small inset from edge, medium size.
BRAND HANDLE: "@oh_showong" — small coral (#FF6B35) bold text, just above the recipe name.
RECIPE NAME: lower-center area. Extra-large serif/display bold font, white, left-aligned. Up to 2 lines.
HOOK PILL: rounded pill badge just above the brand handle. ${hookRules}${lazyCtaHint} Background #FFE500, text #1A1A1A.
STYLE RULE: sophisticated, minimal, editorial. Clean white type on dark photo.`,

    2: `${base}
=== STYLE: 볼드 컬러 포스터 — Square (Image 2 reference) ===
BACKGROUND: Solid bright warm color — choose from #FF6B35 (coral), #FF8C00 (orange), or #E63946 (red) based on food mood.
LOGO (Image 3): bottom-right corner, inside a small white softly-rounded badge.
LAYOUT (top to bottom):
  ① Recipe name: upper quarter, massive chunky sans-serif, white, center-aligned. Up to 2 lines.
  ② Hook descriptor: white semi-bold medium, center, just below recipe name. ${hookRules}${lazyCtaHint}
  ③ Food photo: center area, cutout style with slight drop shadow, natural shape, slightly tilted.
  ④ Bottom strip: solid #FFE500, text ${bottomText}, extra-bold, #1A1A1A, centered.
STYLE RULE: high-contrast bold poster. Energetic, pop-art feel.`,

    3: `${base}
=== STYLE: 드라마틱 클로즈업 — Square (Image 2 reference) ===
BACKGROUND: Food photo fills canvas. Darken dramatically — near-black mood, boosted contrast. Close-up crop showing texture.
LOGO (Image 3): top-right corner, small inset, medium size.
TEXT BLOCK (center-lower area):
  ① HOOK LINE: small bold white font, center. ${hookRules}${lazyCtaHint}
  ② RECIPE NAME: below the hook, enormous bold display font, center. White fill with thick dark outline. Up to 2 lines.
BRAND: "@oh_showong" — very small white text, centered, below recipe name.
STYLE RULE: YouTube thumbnail energy. Maximum drama. Bold outlines on text.`,

    4: `${base}
=== STYLE: 레시피 인포그래픽 — Square (Image 2 reference) ===
BACKGROUND: Warm cream (#FFF5E6). No photo as background.
LAYOUT (top to bottom):
  ① TITLE BAR (top fifth): recipe name in large bold font, #2C1810, center. Subtitle: taste/highlight, #8B4513, small.
  ② FOOD PHOTO (upper-center): centered, large natural presentation, slight drop shadow.
  ③ INFO STRIP (below photo): full-width #FF6B35 band. White bold text: hook phrase from FOMO signals. ${hookRules}${lazyCtaHint}
  ④ BOTTOM STRIP: #FFE500 background. Text ${bottomText}, extra-bold #1A1A1A, centered.
  ⑤ Logo (Image 3): bottom-right corner, small.
STYLE RULE: educational, structured, warm. Like a recipe card someone would save.`,

    5: `${base}
=== STYLE: 내추럴 오가닉 — Square (Image 2 reference) ===
BACKGROUND: Light cream/linen (#F8F5EF). Subtle paper texture feel.
LAYOUT (top to bottom):
  ① TOP STRIP: "@oh_showong" centered, small handwritten-style font, #5C4A2A. Logo (Image 3) top-right, small.
  ② MAIN TITLE (upper third): large brush/calligraphy-style display font, deep earthy green (#2D4A1E) or warm brown (#6B3A2A), center. Up to 2 lines.
  ③ DIVIDER LINE: horizontal, #C4B49A, full width with generous margins.
  ④ TAGLINE (just below divider): warm natural phrase, center, #7A6A5A, small italic. ${hookRules}${lazyCtaHint}
  ⑤ FOOD PHOTO (lower half): natural placement, slightly overlapping the tagline. Real appetizing photo.
  ⑥ DECORATIVE ELEMENTS: soft watercolor leaf or dot motifs at corners.
STYLE RULE: artisanal, farmers-market, trustworthy. Warm but sophisticated.`,
  };

  return styles[styleId] ?? styles[1];
}

export async function POST(req: NextRequest) {
  try {
    const {
      recipeName, type, language,
      stepTitle, stepDescription, stepNumber, stepTime, totalSteps,
      ingredients, steps, kickSteps, highlight,
      uploadedImageBase64, uploadedImageMimeType,
      cookingTime, servings, taste, pairings, kickPoints, character,
      styleId,
    } = await req.json();

    const isEn = language === "en";

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름이 필요합니다." }, { status: 400 });
    }

    let prompt = "";
    let selectedStyle: typeof THUMBNAIL_STYLES[number] | null = null;

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

CANVAS: Square 1:1.
BACKGROUND: Clean white marble surface, soft natural daylight from top-left.

LAYOUT: Arrange each ingredient as a real, beautiful food item in a neat flat-lay grid. Every item clearly visible.

INGREDIENTS: ${ingList}

LABELS (mandatory for every ingredient):
  - Rounded pill label directly below each item. White background, thin #FF6B35 border.
  - Line 1: English ingredient name, bold, #1A1A1A, small font. Use common English grocery store names.
  - Line 2: quantity in BOTH metric and US units (e.g. "200g / 7oz", "2 tbsp / 30ml"), #FF6B35, small font.
  - All text in English. No Korean.

STYLE: Professional food photography, warm tones, Instagram-worthy. Beginner-friendly layout.`;
      } else {
        prompt = `Create a square 1:1 Instagram flat-lay ingredients photo for Korean recipe "${recipeName}".

CANVAS: Square 1:1.
BACKGROUND: Clean white marble surface, soft natural daylight from top-left.

LAYOUT: Arrange each ingredient as a real, beautiful food item in a neat flat-lay grid. Every item clearly visible.

INGREDIENTS: ${ingList}

LABELS (mandatory for every ingredient):
  - Rounded pill label directly below each item. White background, thin #FF6B35 border.
  - Line 1: Korean ingredient name (한국어), bold, #1A1A1A, small font.
  - Line 2: quantity + unit (예: "200g", "2큰술"), #FF6B35, small font.
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

⚠️ STRICT RULE: Do NOT render any numbers with units (px, %, dp, opacity decimals, color codes) as visible text in the image.

=== DESIGN SPEC ===
CANVAS: Square 1:1. Background: solid #FFF8F0 (warm cream).

HEADER (top fifth of canvas):
  Gradient banner #FF6B35 → #FFC857. Title: "✨ Success Tips" white extra-bold large font, centered.
  Subtitle: "${recipeName}" white semi-bold medium font.

TIPS LIST (middle section):
  Each tip as a card: left accent bar in #FF6B35, step number circle badge in #FF6B35, white fill, softly rounded corners.
  - Title: English bold #1A1A1A medium-large font. Use simple, encouraging cooking language.
  - Body: English plain text #555555 medium font — rewrite the tip so a beginner clearly understands WHY it matters.
    Include measurements in metric + US units where relevant.
  Cards:
${kickList}

HIGHLIGHT STRIP: pill badge #FFE66D with #FF6B35 border.
  Text: "💡 Key Point: ${highlight}" English bold #1A1A1A medium font.

FOOTER (bottom strip): #FF6B35 background. White "Recipe Book" centered bold.

STYLE: Flat design, friendly, encouraging tone. All text in English. No Korean.
=== END SPEC ===`;
      } else {
        prompt = `Create a square 1:1 Instagram infographic poster — 성공 포인트 for the Korean recipe "${recipeName}".

⚠️ STRICT RULE: Do NOT render any numbers with units (px, %, dp, opacity decimals, color codes) as visible text in the image.

=== DESIGN SPEC ===
CANVAS: Square 1:1. Background: solid #FFF8F0 (warm cream).

HEADER (top fifth of canvas):
  Gradient banner #FF6B35 → #FFC857. Title: "⭐ 성공 포인트" white extra-bold large font, centered.
  Subtitle: "${recipeName}" white semi-bold medium font.

KICK POINTS LIST (middle section):
  Each kick point as a card: left accent bar in #FF6B35, step number circle badge in #FF6B35, white fill, softly rounded corners.
  - Title: Korean bold #1A1A1A medium-large font.
  - Body: Korean regular text #555555 medium font, wrapped to card width.
  Cards:
${kickList}

HIGHLIGHT STRIP: pill badge #FFE66D with #FF6B35 border.
  Text: "💡 핵심: ${highlight}" Korean bold #1A1A1A medium font.

FOOTER (bottom strip): #FF6B35 background. White "레시피북" centered bold.

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

⚠️ STRICT RULE: Do NOT render any numbers with units (px, %, opacity decimals, color codes) as visible text in the image.

TASK: Create one cooking step card in the IDENTICAL style as Image 1 (Layout Template).

=== MATCH THESE EXACT VISUAL ELEMENTS FROM IMAGE 1 ===

CANVAS: Square 1:1. Warm cream background (#FFF8F0).
OUTER FRAME: Thick coral-orange (#FF6B35) rounded-rectangle border, inset a little from the edge.
STEP BADGE: Top-left corner, circle shape, fill #FF6B35, white bold step number, white stroke.
THREE PANELS: Arranged horizontally, equal width, small gaps. Each panel: white fill, softly rounded corners, thin #FF6B35 border.
ARROWS: Simple thick coral → arrows centered between panels at mid-height.
PANEL LABELS: At the very bottom of each panel, a rounded pill, warm yellow (#FFE66D) fill, thin #FF6B35 border, centered text — short Korean action label (2–4자).
BEAR IN EVERY PANEL: Bear fills most of the panel height, actively cooking. Identical look to Image 2.
PROGRESS BAR: Full width inside the outer frame, just below the 3 panels. Thin bar. Track: #FFE66D. Fill: #FF6B35. Filled proportion = stepNumber/totalSteps.
INSTRUCTION BOX: Below progress bar, inside outer frame. White/cream fill, thin #FF6B35 border, softly rounded. Korean instruction text, 1–2 lines, #1A1A1A, medium size, center-aligned.

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

    // ── Reel thumbnail — styleId 지정 or 랜덤 ──────────────────────────────────
    } else if (type === "reel-thumbnail") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";

      const picked = styleId != null ? THUMBNAIL_STYLES.find(s => s.id === Number(styleId)) : undefined;
      selectedStyle = picked ?? THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
      prompt = buildThumbnailPrompt(
        selectedStyle.id,
        recipeName,
        taste ?? "",
        highlight ?? "",
        kickPoints ?? "",
        pairingText,
        character ?? "cute",
      );

    // ── Post cover (1:1, styleId 지정 or 랜덤) ──────────────────────────────────
    } else if (type === "post-cover") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";
      const picked = styleId != null ? THUMBNAIL_STYLES.find(s => s.id === Number(styleId)) : undefined;
      selectedStyle = picked ?? THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
      prompt = buildPostCoverPrompt(
        selectedStyle.id,
        recipeName,
        taste ?? "",
        highlight ?? "",
        pairingText,
        "ko",
        character ?? "cute",
      );

    // ── English post cover (1:1, styleId 지정 or 랜덤) ─────────────────────────
    } else if (type === "post-cover-en") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";
      const picked = styleId != null ? THUMBNAIL_STYLES.find(s => s.id === Number(styleId)) : undefined;
      selectedStyle = picked ?? THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
      prompt = buildPostCoverPrompt(
        selectedStyle.id,
        recipeName,
        taste ?? "",
        highlight ?? "",
        pairingText,
        "en",
        character ?? "cute",
      );

    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    // step-instagram: 레이아웃 템플릿(Image 1) + 곰 캐릭터 레퍼런스(Image 2) 함께 전달
    // reel-thumbnail / post-cover / post-cover-en은 업로드된 음식 사진을 함께 전달
    let contents;
    if (type === "step-instagram") {
      const templatePath = path.join(process.cwd(), "public", "step-card-template.jpeg");
      const bearFile = character === "lazy" ? "chef-bear-reference-2.png" : "chef-bear-reference.png";
      const bearPath = path.join(process.cwd(), "public", bearFile);
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
        { inlineData: { mimeType: uploadedImageMimeType ?? "image/jpeg", data: uploadedImageBase64 } }, // Image 1: food photo
      ];
      // reel-thumbnail / post-cover / post-cover-en: 스타일 레퍼런스를 Image 2로 삽입
      if (selectedStyle) {
        const styleRefPath = path.join(process.cwd(), "public", selectedStyle.file);
        if (fs.existsSync(styleRefPath)) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(styleRefPath).toString("base64") } }); // Image 2: style ref
        }
      }
      // 로고 파일이 있으면 다음 Image로 전달
      for (const ext of ["png", "jpg", "jpeg", "webp"]) {
        const logoPath = path.join(process.cwd(), "public", `oh_showong_logo.${ext}`);
        if (fs.existsSync(logoPath)) {
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
          parts.push({ inlineData: { mimeType: mime, data: fs.readFileSync(logoPath).toString("base64") } }); // Image 3: logo
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
    return NextResponse.json({
      imageUrl: `data:${mimeType};base64,${base64}`,
      styleName: selectedStyle?.name ?? null,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Image generation error:", message);
    return NextResponse.json(
      { error: `이미지 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
