import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface RecipeDictionaryItem {
  id: string; // lowercase name
  name: string;
  bengaliName: string;
  videoUrl: string; // Hindi video
  bengaliVideoUrl: string; // Bengali video
  lastUpdated: number;
}

/**
 * Fetches a recipe from the global curated dictionary.
 * If not found, it checks the proposed recipes for this household as a fallback.
 */
export async function getRecipeFromDictionary(householdId: string, name: string): Promise<RecipeDictionaryItem | null> {
  if (!name) return null;
  const recipeName = name.trim().toLowerCase();
  const globalId = recipeName.replace(/\s+/g, '_');
  const proposalId = `${householdId}_${globalId}`;

  try {
    // 1. Try Global Curated Dictionary first
    const globalRef = doc(db, "recipes", globalId);
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      return globalSnap.data() as RecipeDictionaryItem;
    }

    // 2. Fallback to household-specific proposals
    const proposalRef = doc(db, "recipeProposals", proposalId);
    const proposalSnap = await getDoc(proposalRef);
    if (proposalSnap.exists()) {
      return proposalSnap.data() as RecipeDictionaryItem;
    }
  } catch (error) {
    console.error("Error fetching recipe:", error);
  }
  return null;
}

/**
 * Saves a recipe to the proposals collection. 
 * Admins can later move these to the global 'recipes' collection.
 */
export async function saveRecipeToDictionary(householdId: string, item: RecipeDictionaryItem): Promise<void> {
  if (!item.name || !householdId) return;
  const recipeName = item.name.trim().toLowerCase();
  const globalId = recipeName.replace(/\s+/g, '_');
  const proposalId = `${householdId}_${globalId}`;
  
  try {
    const docRef = doc(db, "recipeProposals", proposalId);
    const dataToSave = Object.fromEntries(
      Object.entries(item).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    await setDoc(docRef, { ...dataToSave, id: globalId, ownerId: householdId, lastUpdated: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error saving recipe proposal:", error);
  }
}
