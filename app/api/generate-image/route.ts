import { GoogleGenAI, SafetyFilterLevel } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { recipeName, type, stepTitle } = await req.json();

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름이 필요합니다." }, { status: 400 });
    }

    // Build prompt based on image type
    let prompt = "";

    if (type === "recipe-card") {
      // Hero image for recipe suggestion cards
      prompt = `A beautiful, appetizing professional food photography of Korean dish "${recipeName}".
Overhead shot, natural lighting, minimal props, clean white background, restaurant quality presentation.
Highly detailed, vibrant colors, mouth-watering. 4K quality.`;
    } else if (type === "ingredients") {
      // Ingredient layout card
      prompt = `Flat lay photography of fresh cooking ingredients for making Korean "${recipeName}".
All ingredients neatly arranged on a white marble surface.
Natural daylight, top-down view, professional food styling, clean and minimal.`;
    } else if (type === "step") {
      // Cooking step illustration
      prompt = `Step-by-step cooking illustration showing "${stepTitle}" for Korean recipe "${recipeName}".
Close-up shot of hands cooking, natural kitchen setting, warm lighting.
Realistic, detailed, instructional food photography style.`;
    } else if (type === "summary") {
      // Final plated dish for summary card
      prompt = `Award-winning food photography of finished Korean dish "${recipeName}", beautifully plated.
Dark moody background, dramatic side lighting, fine dining presentation.
Steam rising, garnished, highly detailed. Magazine cover quality.`;
    } else {
      prompt = `Professional food photography of Korean dish "${recipeName}". Beautiful presentation.`;
    }

    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: type === "summary" ? "4:3" : "1:1",
        safetyFilterLevel: SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;

    if (!imageBytes) {
      return NextResponse.json({ error: "이미지 생성에 실패했습니다." }, { status: 500 });
    }

    // Return as base64 data URL
    const base64 = Buffer.from(imageBytes).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ imageUrl: dataUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
