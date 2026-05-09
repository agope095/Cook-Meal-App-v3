import { auth } from '../firebase';

export interface LocalizedRecipe {
  bengaliName?: string;
  bengaliQuantity?: string;
  bengaliInstruction?: string;
  hindiName?: string;
  hindiQuantity?: string;
  hindiInstruction?: string;
}

export interface AIMealItemDraft {
  name: string;
  nameBn?: string;
  quantity: string;
  quantityBn?: string;
  instruction: string;
  instructionBn?: string;
  nutrition?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  isFavorite?: boolean;
}


export interface AIMealDraft {
  date: string;
  lunch: AIMealItemDraft[];
  dinner: AIMealItemDraft[];
}

async function callAI<T>(payload: Record<string, unknown>, userProfile?: { name?: string, city?: string, cookLanguage?: string }): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  
  // Fetch memory from Firestore
  let culinaryMemory = '';
  if (auth.currentUser) {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDoc(doc(db, 'owners', auth.currentUser.uid));
      if (snap.exists()) {
        culinaryMemory = snap.data().culinaryMemory || '';
      }
    } catch (e) {
      console.warn("Memory fetch failed", e);
    }
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ ...payload, userProfile, culinaryMemory }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI request failed with status ${response.status}`);
  }

  const result = await response.json();

  // Handle memory updates (incremental or summarized)
  if (auth.currentUser) {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const ownerRef = doc(db, 'owners', auth.currentUser.uid);

    if (result.summarizedMemory) {
       await updateDoc(ownerRef, { culinaryMemory: result.summarizedMemory });
       console.log("[DEBUG] Memory pruned/summarized by AI");
    } else if (result.memoryUpdate) {
       const newMemory = (culinaryMemory ? culinaryMemory + '. ' : '') + result.memoryUpdate;
       await updateDoc(ownerRef, { culinaryMemory: newMemory });
       console.log("[DEBUG] Memory updated:", result.memoryUpdate);
    }
  }

  // CRITICAL: Ensure we never return undefined to the UI
  if (result.data === undefined || result.data === null) {
    console.error("[ERROR] AI returned no data:", result);
    // Return empty state matching expected type
    if (payload.action === 'meal-plan') return [] as any;
    if (payload.action === 'batch-translate') return [] as any;
    return "" as any;
  }

  return result.data as T;
}




export async function generateMealPlanDraft(
  prompt: string,
  startDate: string,
  userProfile?: { name?: string, city?: string, cookLanguage?: string },
  existingDraft?: AIMealDraft[],
  pastMeals?: string,
  favorites?: string[]
): Promise<AIMealDraft[]> {
  return callAI<AIMealDraft[]>({
    action: 'meal-plan',
    prompt,
    startDate,
    existingDraft,
    pastMeals,
    favorites,
  }, userProfile);
}

export async function chatWithCulinaryAssistant(
  messages: { role: 'user' | 'assistant', content: string }[],
  userProfile?: { name?: string, city?: string, cookLanguage?: string },
  pastMeals?: string,
  favorites?: string[]
): Promise<string> {
  return callAI<string>({
    action: 'chat',
    messages,
    pastMeals,
    favorites,
    currentDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }, userProfile);
}



export async function batchTranslateRecipes(
  items: { name: string, quantity?: string, instruction?: string }[],
  userProfile?: { cookLanguage?: string }
): Promise<LocalizedRecipe[]> {
  if (items.length === 0) return [];

  const translations = await callAI<LocalizedRecipe[]>({
    action: 'batch-translate',
    items,
  }, userProfile);

  const isHindi = userProfile?.cookLanguage === 'Hindi';

  return items.map((item, i) => {
    const t = (translations as any)?.[i];
    if (isHindi) {
      return {
        hindiName: t?.nameBn || item.name,
        hindiQuantity: t?.quantityBn || '',
        hindiInstruction: t?.instructionBn || '',
      };
    } else {
      return {
        bengaliName: t?.nameBn || item.name,
        bengaliQuantity: t?.quantityBn || '',
        bengaliInstruction: t?.instructionBn || '',
      };
    }
  });
}

export async function getBengaliRecipe(
  englishName: string,
  userProfile?: { cookLanguage?: string }
): Promise<LocalizedRecipe> {
  const translated = await callAI<string>({
    action: 'single-translate',
    englishName,
  }, userProfile);

  const isHindi = userProfile?.cookLanguage === 'Hindi';

  if (isHindi) {
    return {
      hindiName: translated?.trim() || englishName,
    };
  } else {
    return {
      bengaliName: translated?.trim() || englishName,
    };
  }
}

export async function generateGroceryList(
  meals: { name: string; quantity?: string; instruction?: string }[]
): Promise<string[]> {
  return callAI<string[]>({
    action: 'generate-grocery',
    meals,
  });
}

export async function getBatchNutrition(
  items: { id: string, name: string, quantity?: string }[]
): Promise<any[]> {
  return callAI<any[]>({
    action: 'batch-nutrition',
    items,
  });
}
