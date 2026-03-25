import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 단계별 인스타 이미지 전용 고정 디자인 시스템
// 모든 step-instagram 이미지에 동일하게 적용해 시리즈 일관성을 확보한다
const STEP_DESIGN_SYSTEM = `
=== FIXED DESIGN SYSTEM (apply identically to every image in this series) ===

CANVAS: Square 1:1 ratio, 1080×1080px equivalent.

BACKGROUND: Solid flat color #FFF8F0 (warm cream). No gradients, no textures, no patterns.

OUTER FRAME: 24px rounded rectangle border, color #FF6B35 (coral orange), inset 16px from canvas edge.

LAYOUT — always exactly 3 equal-width vertical panels side by side, separated by 8px gaps filled with #FF6B35.
  Each panel has a white (#FFFFFF) fill with 12px inner padding.

ILLUSTRATION STYLE:
  - Flat vector cartoon. Zero photo-realism.
  - Outlines: 3px uniform black (#1A1A1A) strokes only. No shading, no gradients, no drop shadows.
  - Color fills: only from this locked palette —
      Coral    #FF6B35  (accents, hot surfaces, important items)
      Mint     #4ECDC4  (water, liquids, bowls)
      Lemon    #FFE66D  (ingredients, garnish, positive highlights)
      Lavender #C7CEEA  (background items, secondary utensils)
      Cream    #FFF8F0  (skin tone base)
      Dark     #1A1A1A  (outlines, text)
      White    #FFFFFF  (panel fill, eyes)

CHARACTER: One recurring round-faced chibi cook (head = 55% of body height).
  Always wears:
    - Tall classic white toque blanche (chef hat) sitting on top of the head. Hat height = 60% of head height.
      Hat body: white #FFFFFF rectangle with slight puff at top, 3px black outline. Never omit the hat.
    - White chef coat with two #FF6B35 buttons.
  Face: same round black eyes (4px dot), rosy cheek circles (#FFB3BA), small curved smile.
  Hands are simple rounded rectangles — no fingers drawn.

STEP BADGE: Top-left of the entire canvas (over the frame border), circle diameter 64px,
  fill #FF6B35, white bold number inside, black 2px stroke.

PROGRESS BAR: Bottom edge of canvas, inside the frame.
  Full-width bar, height 20px, background #FFE66D.
  Filled portion = (stepNumber / totalSteps) * 100%, fill color #FF6B35.

PANEL CONTENT RULE: Each panel shows exactly one sequential micro-action of the step.
  Arrow icons (→) between panels are 24px, color #FF6B35.

KOREAN TEXT LABELS (mandatory):
  - Each panel must include a short Korean action label (2–6 characters) at the bottom of that panel.
    Font: bold, rounded sans-serif, color #1A1A1A, font size ~18px equivalent.
    Placed inside a #FFE66D lemon-yellow rounded pill badge at the bottom-center of the panel.
  - Below the 3 panels (above the progress bar), display the full Korean step instruction as a single line.
    Font: bold, color #1A1A1A, font size ~20px. Background: white rounded rectangle with #FF6B35 border 2px.
  - All text must be in Korean (한국어). Do NOT use English, Chinese, or Japanese characters.
=== END DESIGN SYSTEM ===
`;

export async function POST(req: NextRequest) {
  try {
    const { recipeName, type, stepTitle, stepDescription, stepNumber, stepTime, totalSteps, ingredients, steps } = await req.json();

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름이 필요합니다." }, { status: 400 });
    }

    let prompt = "";

    if (type === "recipe-card") {
      prompt = `A beautiful, appetizing professional food photography of Korean dish "${recipeName}".
Overhead shot, natural lighting, minimal props, clean white background, restaurant quality presentation.
Highly detailed, vibrant colors, mouth-watering. 4K quality.`;
    } else if (type === "ingredients") {
      prompt = `Flat lay photography of fresh cooking ingredients for making Korean "${recipeName}".
All ingredients neatly arranged on a white marble surface.
Natural daylight, top-down view, professional food styling, clean and minimal.`;
    } else if (type === "step") {
      prompt = `Step-by-step cooking illustration showing "${stepTitle}" for Korean recipe "${recipeName}".
Close-up shot of hands cooking, natural kitchen setting, warm lighting.
Realistic, detailed, instructional food photography style.`;
    } else if (type === "summary") {
      prompt = `Award-winning food photography of finished Korean dish "${recipeName}", beautifully plated.
Dark moody background, dramatic side lighting, fine dining presentation.
Steam rising, garnished, highly detailed. Magazine cover quality.`;
    } else if (type === "instagram") {
      const ingredientList = Array.isArray(ingredients)
        ? ingredients.map((i: { name: string; amount: string; unit: string }) => `${i.name} ${i.amount}${i.unit}`).join(", ")
        : "";
      const stepList = Array.isArray(steps)
        ? steps.map((s: { number: number; title: string }) => `${s.number}. ${s.title}`).join(" → ")
        : "";
      prompt = `Vertical portrait Instagram food post photo of Korean dish "${recipeName}".
Key ingredients: ${ingredientList}.
Cooking steps: ${stepList}.
Vibrant, warm-toned professional food photography. Beautifully plated on a rustic wooden table.
Shallow depth of field, bokeh background, natural window light from the side.
Instagram-worthy composition with visual hierarchy. Magazine cover quality.`;
    } else if (type === "step-instagram") {
      prompt = `Generate a cooking step illustration card for a recipe series.
${STEP_DESIGN_SYSTEM}
RECIPE: "${recipeName}"
STEP: ${stepNumber} of ${totalSteps}
STEP TITLE: "${stepTitle}"
INSTRUCTION: ${stepDescription}
${stepTime ? `TIME: ${stepTime}` : ""}

TASK: Illustrate this single cooking step across exactly 3 sequential panels showing the progression of the action.
- The chibi cook character (with tall white toque blanche hat) must appear in every panel performing the action.
- Show the specific ingredients and utensils described in the instruction using only the locked color palette.
- Each panel must have a Korean action label in a #FFE66D pill badge at its bottom.
- Below the panels, render the step instruction in Korean as a single line in a white box with coral border.
- Fill the progress bar to ${stepNumber}/${totalSteps} of its width.
- Place the step number badge (${stepNumber}) at top-left.
- Strictly follow every rule in the FIXED DESIGN SYSTEM above — color codes, stroke widths, character design, hat, layout, and Korean text must all be present.`;
    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ imageUrl: dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Image generation error:", message);
    return NextResponse.json(
      { error: `이미지 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
