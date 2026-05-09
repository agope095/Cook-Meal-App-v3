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
    // Serving intelligence — stored at write-time, used for local recalculation
    per100g?: {
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    servingGrams?: number;   // Total grams for the quantity specified (AI-inferred)
    servings?: number;       // Number of persons this quantity is intended for
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
  householdSize?: number;   // Default: 2. Used for per-person nutrition context.
  appetiteMultiplier?: number; // Default: 1.0. (e.g. 0.8 for light, 1.2 for heavy).
  updatedAt: string;
  authorizedEmails?: string[];
  authorizedUids?: string[];
  joinedHouseholdId?: string | null;
  viewPreference?: 'casual' | 'power';
}
