export interface MealItem {
  id: string;
  name: string;
  quantity: string;
  bengaliQuantity?: string;
  instruction?: string;
  bengaliInstruction?: string;
  videoUrl?: string;
  bengaliName?: string;
  bengaliVideoUrl?: string;
  prepared?: boolean;
  note?: string;
}

export interface MealPlan {
  date: string;
  breakfast?: MealItem[];
  lunch: MealItem[];
  snacks?: MealItem[];
  dinner: MealItem[];
  ownerId: string;
}
