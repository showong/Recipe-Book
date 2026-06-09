import { CharacterType } from "@/types/character";

interface RecipeCardPromptParams {
  recipeName: string;
  taste?: string;
  highlight?: string;
  ingredients?: { name: string }[];
  character?: CharacterType | string;
}

export function buildRecipeCardPrompt(params: RecipeCardPromptParams): string {
  const { recipeName, taste, highlight, character = "cute_bear" } = params;

  const styleMap: Record<string, string> = {
    lazy_bear: "simple rustic home-cooked presentation, realistic and unpretentious, one-pan meal aesthetic",
    trend_bear: "modern trendy food styling, SNS-worthy composition, contemporary clean plating",
    cute_bear: "warm and inviting home cooking with appealing plating, colorful and appetizing",
    cute: "warm and inviting home cooking with appealing plating, colorful and appetizing",
    lazy: "simple rustic home-cooked presentation, realistic and unpretentious, one-pan meal aesthetic",
  };

  const characterStyle = styleMap[character] ?? styleMap.cute_bear;

  return [
    `A beautiful, appetizing professional food photography of Korean dish "${recipeName}".`,
    taste ? `Taste profile: ${taste}.` : "",
    highlight ? `Key characteristic: ${highlight}.` : "",
    `Overhead or 45-degree angle shot, natural lighting, clean minimal background.`,
    `Style: ${characterStyle}.`,
    `Square 1:1 format. No text overlays, no logos, no watermarks, no hands, no people.`,
    `Vibrant colors, highly detailed, restaurant or home-cooking quality. 4K quality.`,
  ].filter(Boolean).join(" ");
}
