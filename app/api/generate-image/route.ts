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
] as const;

function buildThumbnailPrompt(
  styleId: number,
  recipeName: string,
  taste: string,
  highlight: string,
  kickPoints: string,
  pairingText: string,
): string {
  const base = `
You are given THREE images:
  - Image 1: uploaded food photo
  - Image 2: LAYOUT REFERENCE — reproduce this visual style exactly (layout, typography placement, background treatment, color mood)
  - Image 3: oh_showong brand logo → place as specified

Canvas: 9:16 vertical (1080×1920px). Recipe: "${recipeName}".
FOMO signals — Taste: "${taste}" / Highlight: "${highlight}" / Kick: "${kickPoints}" / Pairs: "${pairingText}"
`;

  const styles: Record<number, string> = {
    1: `${base}
=== STYLE: 무드 에디토리얼 (Image 2 reference) ===
BACKGROUND: Food photo fills entire canvas. Apply moody darkening — reduce brightness ~25%, subtle desaturation. Dark semi-transparent overlay (rgba 0,0,0,0.45) on lower 45%.
LOGO (Image 3): top-right corner, 28px from edge, 110px diameter.
BRAND HANDLE: "@oh_showong" — small coral (#FF6B35) bold text, bottom-center, above the recipe name.
RECIPE NAME: bottom 38% of canvas. Large serif/display bold Korean font, white, 100px, left-aligned with 48px left margin. 2-line wrap allowed.
HOOK LINE: one short line just above recipe name. White, semi-bold, 36px, opacity 0.85. Generate from FOMO signals — editorial tone, max 20 chars.
STYLE RULE: sophisticated, minimal, editorial. NO pill badges, NO colorful overlays. Clean white type on dark photo.`,

    2: `${base}
=== STYLE: 볼드 컬러 포스터 (Image 2 reference) ===
BACKGROUND: Do NOT use food photo as background. Solid bright warm color — choose from #FF6B35 (coral), #FF8C00 (orange), or #E63946 (red) based on food mood.
LOGO (Image 3): bottom-right, inside a white rounded rectangle badge (14px radius), 90px logo + 12px padding.
LAYOUT (top to bottom):
  ① Recipe name: y=8%–28%, massive chunky sans-serif, white, 130px, center-aligned. Auto-wrap to 2 lines.
  ② One appetizing descriptor line: white semi-bold 34px, center, y≈30%. Generate from taste/highlight, max 20 chars.
  ③ Food photo: center of canvas (y=35%–85%), cutout style with slight drop shadow, natural circular or oval shape, slightly angled –3°.
  ④ Brand logo badge: bottom-right, y=88%–95%.
STYLE RULE: high-contrast bold poster. Energetic, pop-art food brand feel.`,

    3: `${base}
=== STYLE: 드라마틱 클로즈업 (Image 2 reference) ===
BACKGROUND: Food photo fills canvas. Darken to near-black mood (brightness –35%, contrast +15%). Food is dramatically close-up, cropped to show texture.
LOGO (Image 3): top-right corner, 28px from edge, 110px.
TEXT BLOCK (y=48%–72%):
  ① HOOK LINE: y≈50%, small bold white Korean, 38px, center. Generate urgent hook from FOMO signals — max 14 chars (e.g. "X분만에 완성!", "이 맛 실화?").
  ② RECIPE NAME: y=56%–70%, HUGE bold Korean display, 140px, center. Fill: white. Stroke: 8px dark green (#1A3A0A) or black outline. 2-line wrap.
BRAND: "@oh_showong" — very small white text, y=75%, center.
STYLE RULE: YouTube/Shorts thumbnail energy. Maximum drama. Bold strokes on text.`,

    4: `${base}
=== STYLE: 레시피 인포그래픽 (Image 2 reference) ===
BACKGROUND: Warm cream (#FFF5E6). No photo as background.
LAYOUT (top to bottom):
  ① TITLE BAR (y=0–18%): recipe name in large bold Korean, #2C1810, 90px, center. Subtitle below: taste/highlight phrase, #8B4513, 30px.
  ② FOOD PHOTO (y=18%–55%): centered, large natural presentation, slight drop shadow.
  ③ INGREDIENTS COLUMNS (y=55%–78%): two columns flanking a center divider line.
     Left: "재료" header + top 3 ingredients as icon+text rows.
     Right: "양념" header + top 3 seasoning items. Font: #2C1810, 24px.
  ④ HIGHLIGHT BOX (y=80%–92%): full-width, background #FF6B35, white text bold 28px.
     Text: "포인트: " + kickpoint or highlight phrase. Rounded corners 12px.
  ⑤ Logo (Image 3): bottom-right, y=93%–99%, 80px.
STYLE RULE: educational, structured, warm. Like a recipe card someone would save.`,

    5: `${base}
=== STYLE: 내추럴 오가닉 (Image 2 reference) ===
BACKGROUND: Light cream/linen (#F8F5EF). Subtle paper texture feel.
LAYOUT (top to bottom):
  ① TOP BAR (y=0–6%): "@oh_showong" centered, small handwritten-style font, #5C4A2A, 24px.
     Logo (Image 3): top-center or top-right, 80px.
  ② MAIN TITLE (y=8%–42%): Large brush/calligraphy-style Korean display font.
     Color: deep earthy green (#2D4A1E) or warm brown (#6B3A2A). 100px. Center. 2-line wrap.
  ③ THIN DIVIDER LINE: y≈44%, horizontal, #C4B49A, full width with 40px margin.
  ④ TAGLINE (y=46%–52%): one warm natural phrase, center, #7A6A5A, 28px italic.
     Generate from taste/highlight/pairings — natural, non-clickbait tone, max 22 chars.
  ⑤ FOOD PHOTO (y=48%–96%): bottom half, natural placement, slightly overlapping the tagline text. Real appetizing photo.
  ⑥ DECORATIVE ELEMENTS: soft watercolor leaf or dot motifs at top-left and bottom-right corners.
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
      cookingTime, servings, taste, pairings, kickPoints,
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

    // ── Reel thumbnail — 5가지 스타일 중 랜덤 선택 ──────────────────────────────
    } else if (type === "reel-thumbnail") {
      const pairingText = Array.isArray(pairings) && pairings.length > 0
        ? pairings.slice(0, 2).join(" · ")
        : "";

      // 랜덤 스타일 선택
      selectedStyle = THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
      prompt = buildThumbnailPrompt(
        selectedStyle.id,
        recipeName,
        taste ?? "",
        highlight ?? "",
        kickPoints ?? "",
        pairingText,
      );

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
        { inlineData: { mimeType: uploadedImageMimeType ?? "image/jpeg", data: uploadedImageBase64 } }, // Image 1: food photo
      ];
      // reel-thumbnail: 스타일 레퍼런스를 Image 2로 삽입
      if (type === "reel-thumbnail" && selectedStyle) {
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
