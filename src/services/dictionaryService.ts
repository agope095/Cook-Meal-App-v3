import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface RecipeDictionaryItem {
  id: string; // lowercase name
  name: string;
  bengaliName: string;
  hindiName?: string;
  videoUrl: string; // Hindi video
  bengaliVideoUrl: string; // Bengali video
  hindiVideoUrl?: string;
  nutrition?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  lastUpdated: number;
}

/**
 * Fetches a recipe from the dictionary in order of priority:
 * 1. Global Curated (Official)
 * 2. Community Cache (Shared searches)
 * 3. Household Private (Family specific)
 */
export async function getRecipeFromDictionary(householdId: string, name: string): Promise<RecipeDictionaryItem | null> {
  if (!name) return null;
  const recipeName = name.trim().toLowerCase();
  const globalId = recipeName.replace(/\s+/g, '_');
  const proposalId = `${householdId}_${globalId}`;

  try {
    // 1. Try Global Curated Dictionary first
    const globalSnap = await getDoc(doc(db, "recipes", globalId));
    if (globalSnap.exists()) return globalSnap.data() as RecipeDictionaryItem;

    // 2. Try Community Cache (Crowdsourced)
    const communitySnap = await getDoc(doc(db, "communityRecipes", globalId));
    if (communitySnap.exists()) return communitySnap.data() as RecipeDictionaryItem;

    // 3. Fallback to household-specific proposals
    const proposalSnap = await getDoc(doc(db, "recipeProposals", proposalId));
    if (proposalSnap.exists()) return proposalSnap.data() as RecipeDictionaryItem;
    
  } catch (error) {
    console.error("Error fetching recipe:", error);
  }
  return null;
}

/**
 * Saves a recipe to the dictionary.
 * @param isAutomatic - If true, saves to community cache. If false (user manual input), only saves to private proposals.
 */
export async function saveRecipeToDictionary(householdId: string, item: RecipeDictionaryItem, isAutomatic: boolean = false): Promise<void> {
  if (!item.name || !householdId) return;
  const recipeName = item.name.trim().toLowerCase();
  const globalId = recipeName.replace(/\s+/g, '_');
  const proposalId = `${householdId}_${globalId}`;
  
  try {
    const dataToSave = Object.fromEntries(
      Object.entries(item).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    
    const finalData = { 
      ...dataToSave, 
      id: globalId, 
      lastUpdated: Date.now() 
    };

    // Save to Community Cache ONLY if it was an automatic search (prevents abuse)
    if (isAutomatic) {
      await setDoc(doc(db, "communityRecipes", globalId), finalData, { merge: true });
    }

    // Always save to Private Proposals (Household specific)
    await setDoc(doc(db, "recipeProposals", proposalId), { ...finalData, ownerId: householdId }, { merge: true });
    
  } catch (error) {
    console.error("Error saving recipe:", error);
  }
}
