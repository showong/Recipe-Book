export type CharacterType = "lazy_bear" | "cute_bear" | "trend_bear";

export const legacyCharacterMap: Record<string, CharacterType> = {
  cute: "cute_bear",
  lazy: "lazy_bear",
  trend: "trend_bear",
};

export function normalizeCharacter(char: string | undefined | null): CharacterType {
  if (!char) return "cute_bear";
  if (char === "cute_bear" || char === "lazy_bear" || char === "trend_bear") return char;
  return legacyCharacterMap[char] ?? "cute_bear";
}

export function toLegacyCharacter(char: CharacterType): "cute" | "lazy" {
  if (char === "lazy_bear") return "lazy";
  return "cute";
}
