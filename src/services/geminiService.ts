import { auth } from '../firebase';

export interface LocalizedRecipe {
  bengaliName: string;
  bengaliQuantity?: string;
  bengaliInstruction?: string;
}

export interface AIMealItemDraft {
  name: string;
  nameBn?: string;
  quantity: string;
  quantityBn?: string;
  instruction: string;
  instructionBn?: string;
}


export interface AIMealDraft {
  date: string;
  lunch: AIMealItemDraft[];
  dinner: AIMealItemDraft[];
}

async function callAI<T>(payload: Record<string, unknown>, userProfile?: { name?: string, city?: string }): Promise<T> {
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

  const baseUrl = ''; // Cloudflare Pages handles /api/ai routing automatically
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ ...payload, userProfile, culinaryMemory }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error || 'AI request failed');
  }

  // Handle new format where memoryUpdate might be present
  if (result.memoryUpdate && auth.currentUser) {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const ownerRef = doc(db, 'owners', auth.currentUser.uid);
      await updateDoc(ownerRef, { 
        culinaryMemory: (culinaryMemory ? culinaryMemory + '. ' : '') + result.memoryUpdate 
      });
      console.log("[DEBUG] Memory updated:", result.memoryUpdate);
    } catch (e) {
      console.warn("Failed to update memory", e);
    }
  }

  // CRITICAL: Ensure we never return undefined to the UI
  if (result.data === undefined || result.data === null) {
    console.error("[ERROR] AI returned no data:", result);
    return (Array.isArray(payload.existingDraft) ? [] : "") as any;
  }

  return result.data as T;
}




export async function generateMealPlanDraft(
  prompt: string,
  startDate: string,
  userProfile?: { name?: string, city?: string },
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
  userProfile?: { name?: string, city?: string },
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

  return items.map((item, i) => ({
    bengaliName: (translations as any)?.[i]?.nameBn || item.name,
    bengaliQuantity: (translations as any)?.[i]?.quantityBn || '',
    bengaliInstruction: (translations as any)?.[i]?.instructionBn || '',
  }));
}

export async function getBengaliRecipe(
  englishName: string,
  userProfile?: { cookLanguage?: string }
): Promise<LocalizedRecipe> {
  const translated = await callAI<string>({
    action: 'single-translate',
    englishName,
  }, userProfile);

  return {
    bengaliName: translated?.trim() || englishName,
  };
}
