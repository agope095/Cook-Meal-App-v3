/**
 * nutritionService.ts
 * 
 * Serving Intelligence layer for per-person nutrition.
 * All calculations are local (zero AI cost).
 * AI enrichment happens at write-time via the ai.ts function.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MealItem } from '../types';

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface NutritionPer100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ServingIntelligenceResult {
  householdTotal: { kcal: number; protein: number; carbs: number; fat: number };
  perPerson: { kcal: number; protein: number; carbs: number; fat: number } | null;
  inferredServings: number | null;
  hasServingData: boolean;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  impliedServings: number;
  householdSize: number;
  message: string;
}

// ────────────────────────────────────────────────────────────────────
// Core: Local Recalculation (No AI)
// ────────────────────────────────────────────────────────────────────

/**
 * Recalculates nutrition from the stored per100g baseline and a new gram weight.
 * This replaces the need for a new AI call when the user edits quantity.
 */
export function recalculateFromPer100g(
  per100g: NutritionPer100g,
  newQuantityGrams: number
): NutritionPer100g {
  const factor = newQuantityGrams / 100;
  return {
    kcal: Math.round(per100g.kcal * factor),
    protein: Math.round(per100g.protein * factor),
    carbs: Math.round(per100g.carbs * factor),
    fat: Math.round(per100g.fat * factor),
  };
}

// ────────────────────────────────────────────────────────────────────
// Core: Per-Person Calculation
// ────────────────────────────────────────────────────────────────────

/**
 * Derives per-person nutrition from a list of meal items and a household size.
 * Uses the stored `servings` field if available; falls back to householdSize.
 */
export function deriveServingContext(
  allItems: MealItem[],
  householdSize: number
): ServingIntelligenceResult {
  const itemsWithData = allItems.filter(item => item.nutrition);
  if (itemsWithData.length === 0) {
    return {
      householdTotal: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      perPerson: null,
      inferredServings: null,
      hasServingData: false,
    };
  }

  // Sum household totals
  const householdTotal = itemsWithData.reduce(
    (acc, item) => ({
      kcal: Math.round(acc.kcal + (item.nutrition?.kcal || 0)),
      protein: Math.round(acc.protein + (item.nutrition?.protein || 0)),
      carbs: Math.round(acc.carbs + (item.nutrition?.carbs || 0)),
      fat: Math.round(acc.fat + (item.nutrition?.fat || 0)),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Determine servings: use stored value if available, otherwise use householdSize
  const servingsValues = itemsWithData
    .map(item => item.nutrition?.servings)
    .filter((s): s is number => typeof s === 'number' && s > 0);

  const hasServingData = servingsValues.length > 0;
  const inferredServings = hasServingData
    ? Math.round(servingsValues.reduce((a, b) => a + b, 0) / servingsValues.length)
    : householdSize;

  if (!inferredServings || inferredServings <= 0) {
    return { householdTotal, perPerson: null, inferredServings: null, hasServingData };
  }

  const perPerson = {
    kcal: Math.round(householdTotal.kcal / inferredServings),
    protein: Math.round(householdTotal.protein / inferredServings),
    carbs: Math.round(householdTotal.carbs / inferredServings),
    fat: Math.round(householdTotal.fat / inferredServings),
  };

  return { householdTotal, perPerson, inferredServings, hasServingData };
}

// ────────────────────────────────────────────────────────────────────
// Anomaly Detection: Soft Serving Confirmation
// ────────────────────────────────────────────────────────────────────

/**
 * Detects if a meal item's planned servings deviate significantly from
 * the household's expected size. Returns a nudge object if anomaly found.
 * Threshold: >30% deviation from householdSize.
 */
export function detectServingAnomaly(
  items: MealItem[],
  householdSize: number
): AnomalyResult | null {
  const itemsWithServings = items.filter(
    item => item.nutrition?.servings != null && item.nutrition.servings > 0
  );

  if (itemsWithServings.length === 0) return null;

  const avgServings = Math.round(
    itemsWithServings.reduce((sum, item) => sum + (item.nutrition!.servings!), 0)
    / itemsWithServings.length
  );

  const deviation = Math.abs(avgServings - householdSize) / householdSize;

  if (deviation <= 0.3) return null;

  const direction = avgServings > householdSize ? 'more' : 'fewer';
  const message = avgServings > householdSize
    ? `Today's meals look planned for ${avgServings} people — your household is ${householdSize}. Any guests?`
    : `Today's meals look planned for ${avgServings} ${avgServings === 1 ? 'person' : 'people'} — your household is ${householdSize}. Smaller day?`;

  return {
    isAnomaly: true,
    impliedServings: avgServings,
    householdSize,
    message,
  };
}

// ────────────────────────────────────────────────────────────────────
// Community Cache: Write serving intelligence to shared recipe store
// ────────────────────────────────────────────────────────────────────

/**
 * Persists the per100g baseline to the community recipe cache.
 * Uses a running average for servingGrams to improve accuracy over time.
 * Only writes if the item has valid per100g data.
 */
export async function persistNutritionToCache(
  dishName: string,
  per100g: NutritionPer100g,
  servingGrams: number
): Promise<void> {
  if (!dishName || !per100g) return;

  const cacheId = dishName.trim().toLowerCase().replace(/\s+/g, '_');
  const cacheRef = doc(db, 'communityRecipes', cacheId);

  try {
    const existing = await getDoc(cacheRef);

    if (existing.exists()) {
      const data = existing.data();
      const count = (data.contributorCount || 0) + 1;
      const prevServingGrams = data.typicalServingGrams || servingGrams;
      const avgServingGrams = Math.round((prevServingGrams * (count - 1) + servingGrams) / count);

      // Update running average for serving size only — keep per100g as-is (it's absolute)
      await setDoc(cacheRef, {
        nutrition_per100g: per100g,
        typicalServingGrams: avgServingGrams,
        contributorCount: count,
        lastUpdated: Date.now(),
      }, { merge: true });
    } else {
      await setDoc(cacheRef, {
        id: cacheId,
        name: dishName.trim(),
        nutrition_per100g: per100g,
        typicalServingGrams: servingGrams,
        contributorCount: 1,
        lastUpdated: Date.now(),
      }, { merge: true });
    }
  } catch (error) {
    // Non-blocking — cache write failure should not break the meal save flow
    console.warn('[nutritionService] Community cache write failed (non-critical):', error);
  }
}

/**
 * Fetches the cached per100g nutrition from the community store.
 * Returns null if not cached — caller should fall back to AI.
 */
export async function getNutritionFromCache(
  dishName: string
): Promise<{ per100g: NutritionPer100g; typicalServingGrams: number } | null> {
  if (!dishName) return null;
  const cacheId = dishName.trim().toLowerCase().replace(/\s+/g, '_');

  try {
    const snap = await getDoc(doc(db, 'communityRecipes', cacheId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.nutrition_per100g) {
        return {
          per100g: data.nutrition_per100g as NutritionPer100g,
          typicalServingGrams: data.typicalServingGrams || 200,
        };
      }
    }
  } catch (error) {
    console.warn('[nutritionService] Cache fetch failed:', error);
  }
  return null;
}
