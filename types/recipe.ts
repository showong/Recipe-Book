export interface RecipeSuggestion {
  id: string;
  name: string;
  emoji: string;
  description: string;
  additionalIngredients: string[];
  ownedIngredients: string[];
  cookingTime: string;
  difficulty: "쉬움" | "보통" | "어려움";
  taste: string;
  pairings: string[];
  servings: number;
  highlight: string; // unique selling point / kick
}

export interface IngredientItem {
  name: string;
  amount: string;
  unit: string;
  isOwned: boolean;
}

export interface RecipeStep {
  number: number;
  title: string;
  description: string;
  time?: string;
  isKick: boolean;
  kickReason?: string;
  parallel?: string;
  tip?: string;
  emoji: string;
}

export interface RecipeDetail {
  name: string;
  emoji: string;
  description: string;
  totalTime: string;
  servings: number;
  difficulty: string;
  taste: string;
  highlight: string;
  ingredients: IngredientItem[];
  steps: RecipeStep[];
  summaryText: string;
  proTips: string[];
  pairings: string[];
}
