import { CharacterType } from "@/types/character";

export interface SearchDecision {
  needSearch: boolean;
  reason: string;
  queries: string[];
}

const TREND_KEYWORDS = [
  "요즘", "인기", "유튜브", "sns", "핫한", "트렌드", "최근", "바이럴",
  "숏츠", "릴스", "틱톡", "유행", "화제",
];

export function decideSearch(
  character: CharacterType | string,
  ingredients: string[],
  rawInput?: string,
): SearchDecision {
  if (character === "trend_bear" || character === "trend") {
    const ingList = ingredients.slice(0, 3).join(" ");
    return {
      needSearch: true,
      reason: "트렌드곰이 선택되어 최근 인기 레시피 조합 확인이 필요합니다",
      queries: [
        `${ingList} 요즘 인기 레시피 2025`,
        `${ingList} 트렌드 레시피 다이어트 고단백`,
        `${ingList} 간단 레시피 원팬 에어프라이어`,
      ],
    };
  }

  const input = (rawInput ?? ingredients.join(" ")).toLowerCase();
  const hasTrendKeyword = TREND_KEYWORDS.some((k) => input.includes(k));

  if (hasTrendKeyword) {
    return {
      needSearch: true,
      reason: "트렌드 관련 키워드가 입력에 포함되어 있습니다",
      queries: [`${ingredients.slice(0, 3).join(" ")} 요즘 인기 레시피`],
    };
  }

  return {
    needSearch: false,
    reason: "웹서칭이 필요하지 않습니다",
    queries: [],
  };
}
