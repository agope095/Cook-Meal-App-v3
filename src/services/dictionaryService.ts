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

export async function getRecipeFromDictionary(householdId: string, name: string): Promise<RecipeDictionaryItem | null> {
  if (!name || !householdId) return null;
  const recipeName = name.trim().toLowerCase();
  const id = `${householdId}_${recipeName.replace(/\s+/g, '_')}`;
  try {
    const docRef = doc(db, "recipeDictionary", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as RecipeDictionaryItem;
    }
  } catch (error) {
    console.error("Error fetching from dictionary:", error);
  }
  return null;
}

export async function saveRecipeToDictionary(householdId: string, item: RecipeDictionaryItem): Promise<void> {
  if (!item.name || !householdId) return;
  const recipeName = item.name.trim().toLowerCase();
  const id = `${householdId}_${recipeName.replace(/\s+/g, '_')}`;
  
  try {
    const docRef = doc(db, "recipeDictionary", id);
    // Filter out empty fields from the item before merging
    const dataToSave = Object.fromEntries(
      Object.entries(item).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    await setDoc(docRef, { ...dataToSave, ownerId: householdId, lastUpdated: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error saving to dictionary:", error);
  }
}
