import { collection, query, where, getDocs, documentId, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format, subDays } from 'date-fns';
import { MealPlan } from '../types';

export async function getPastMeals(ownerId: string, startDate: Date, days: number = 30): Promise<string> {
  try {
    const endDateStr = format(startDate, 'yyyy-MM-dd');
    const startDateObj = subDays(startDate, days);
    const startDateStr = format(startDateObj, 'yyyy-MM-dd');

    // Use documentId() range to avoid needing a composite index on ownerId+date
    // Document IDs are formatted as "${ownerId}_${date}"
    const q = query(
      collection(db, 'mealPlans'),
      where(documentId(), '>=', `${ownerId}_${startDateStr}`),
      where(documentId(), '<', `${ownerId}_${endDateStr}`)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return "No past meals found.";

    const history: string[] = [];
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as MealPlan;
      // Extract date from document ID (ID is ownerId_YYYY-MM-DD)
      const date = docSnap.id.split('_')[1] || docSnap.id;
      const lunch = data.lunch?.map(item => `${item.name}${item.quantity ? ` (Qty: ${item.quantity})` : ''}`).join('; ') || 'None';
      const dinner = data.dinner?.map(item => `${item.name}${item.quantity ? ` (Qty: ${item.quantity})` : ''}`).join('; ') || 'None';
      history.push(`Date: ${date} | Lunch: ${lunch} | Dinner: ${dinner}`);
    });

    return history.join('\n');
  } catch (error) {
    console.error("Error fetching past meals:", error);
    return "Error fetching past meals.";
  }
}

export async function getFavorites(householdId: string): Promise<string[]> {
  try {
    // Range query on documentId works as a prefix check
    const q = query(
      collection(db, 'favorites'),
      where(documentId(), '>=', `${householdId}_`),
      where(documentId(), '<=', `${householdId}_\uf8ff`)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(docSnap => docSnap.data().name as string);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return [];
  }
}


export async function addFavorite(householdId: string, name: string): Promise<void> {
  try {
    // Use a composite ID or a random ID to allow same recipe for different owners
    const id = `${householdId}_${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
    const docRef = doc(db, 'favorites', id);
    await setDoc(docRef, { name, ownerId: householdId });
  } catch (error) {
    console.error("Error adding favorite:", error);
    throw error;
  }
}

export async function removeFavorite(householdId: string, name: string): Promise<void> {
  try {
    const id = `${householdId}_${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
    const docRef = doc(db, 'favorites', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error removing favorite:", error);
    throw error;
  }
}
