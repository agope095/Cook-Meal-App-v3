export interface MealItem {
  id: string;
  name: string;
  quantity: string;
  bengaliQuantity?: string;
  hindiQuantity?: string;
  instruction?: string;
  bengaliInstruction?: string;
  hindiInstruction?: string;
  videoUrl?: string;
  bengaliName?: string;
  hindiName?: string;
  bengaliVideoUrl?: string;
  hindiVideoUrl?: string;
  note?: string;
  dietaryType?: 'veg' | 'non-veg' | 'egg';
  isHero?: boolean;
  nutrition?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  baseQuantity?: string;
  baseNutrition?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  prepared?: boolean;
}

export interface MealPlan {
  date: string;
  breakfast?: MealItem[];
  lunch: MealItem[];
  snacks?: MealItem[];
  dinner: MealItem[];
  ownerId: string;
}

export interface OwnerProfile {
  uid: string;
  name: string;
  pincode: string;
  city: string;
  society: string;
  tower?: string;
  flat?: string;
  cookLanguage: 'Bengali' | 'Hindi';
  email: string;
  dietaryPreference?: 'veg' | 'non-veg' | 'egg';
  updatedAt: string;
  authorizedEmails?: string[];
  authorizedUids?: string[];
  joinedHouseholdId?: string | null;
  viewPreference?: 'casual' | 'power';
}
