import { NextRequest, NextResponse } from "next/server";

const HF_MODEL = "Tongyi-MAI/Z-Image-Turbo";
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

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
      prompt = `Webtoon-style illustrated cooking step image for Korean recipe "${recipeName}".
Step ${stepNumber} of ${totalSteps}: "${stepTitle}".
Cooking instruction: ${stepDescription}
${stepTime ? `Time required: ${stepTime}` : ""}

Art style: Cute Korean webtoon comic illustration. Clean outlines, bright pastel colors, friendly characters.
Layout: 2-3 horizontal panels flowing left to right, showing the sequence of this one cooking action step by step.
Show hands, ingredients, and cooking tools clearly. Use arrows and visual cues to guide the reader.
Each panel is clearly separated. Background: clean white or soft pastel.
No text overlay needed - visuals should tell the whole story.
Format: Square 1:1 ratio, Instagram-ready. Fun, approachable, easy for anyone to follow.`;
    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HF API error ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64}`;

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
