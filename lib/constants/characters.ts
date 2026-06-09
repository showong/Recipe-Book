import { CharacterType } from "@/types/character";

export interface CharacterConfig {
  id: CharacterType;
  legacyId: string;
  emoji: string;
  name: string;
  desc: string;
  accent: string;
  bg: string;
  border: string;
  useSearch: boolean;
}

export const CHARACTERS: CharacterConfig[] = [
  {
    id: "cute_bear",
    legacyId: "cute",
    emoji: "🐻",
    name: "귀여운 곰돌이",
    desc: "따뜻하고 친절한\n요리 가이드",
    accent: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    useSearch: false,
  },
  {
    id: "lazy_bear",
    legacyId: "lazy",
    emoji: "🐨",
    name: "귀차니즘 곰돌이",
    desc: "노력 최소, 맛 최대\n효율 요리사",
    accent: "#4f46e5",
    bg: "#eef2ff",
    border: "#a5b4fc",
    useSearch: false,
  },
  {
    id: "trend_bear",
    legacyId: "trend",
    emoji: "🐼",
    name: "트렌드곰",
    desc: "요즘 핫한 조합 기반\nSNS 트렌드 레시피",
    accent: "#7c3aed",
    bg: "#f5f3ff",
    border: "#c4b5fd",
    useSearch: true,
  },
];

export function getCharacterConfig(id: CharacterType): CharacterConfig {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
