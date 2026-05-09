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

export interface MacroBalanceResult {
  score: string;
  color: string;
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

/**
 * Recalculates total grams and nutrition when the number of servings changes.
 * Uses the inferred servingGrams/servings ratio as the baseline.
 */
export function recalculateServingSize(
  item: MealItem,
  newServings: number
): { servingGrams: number; nutrition: { kcal: number; protein: number; carbs: number; fat: number } } | null {
  if (!item.nutrition?.per100g || !item.nutrition?.servingGrams || !item.nutrition?.servings) return null;

  const gramsPerServing = item.nutrition.servingGrams / item.nutrition.servings;
  const newTotalGrams = Math.round(gramsPerServing * newServings);
  
  const newNutrition = recalculateFromPer100g(item.nutrition.per100g, newTotalGrams);

  return {
    servingGrams: newTotalGrams,
    nutrition: newNutrition
  };
}

// ────────────────────────────────────────────────────────────────────
// Core: Per-Person Calculation
// ────────────────────────────────────────────────────────────────────

/**
 * Derives per-person nutrition from a list of meal items and a household size.
 * Uses the stored `servings` field if available; falls back to householdSize.
 * Incorporates appetiteMultiplier for personalized serving sizes.
 */
export function deriveServingContext(
  allItems: MealItem[],
  householdSize: number,
  appetiteMultiplier: number = 1.0
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
  const baseServings = hasServingData
    ? Math.round(servingsValues.reduce((a, b) => a + b, 0) / servingsValues.length)
    : householdSize;

  if (!baseServings || baseServings <= 0) {
    return { householdTotal, perPerson: null, inferredServings: null, hasServingData };
  }

  // Calculate per person nutrition, adjusted by appetite multiplier
  // If appetiteMultiplier is 1.2, the person eats 20% more than average.
  // Note: We divide by total people but the "per-person" shown is for the USER (who has the appetite setting)
  const perPerson = {
    kcal: Math.round((householdTotal.kcal / baseServings) * appetiteMultiplier),
    protein: Math.round((householdTotal.protein / baseServings) * appetiteMultiplier),
    carbs: Math.round((householdTotal.carbs / baseServings) * appetiteMultiplier),
    fat: Math.round((householdTotal.fat / baseServings) * appetiteMultiplier),
  };

  return { householdTotal, perPerson, inferredServings: baseServings, hasServingData };
}

/**
 * Categorizes a meal or day based on its macronutrient balance.
 * Uses a priority-based rule set to return a label and theme color.
 */
export function getMacroBalance(
  kcal: number,
  protein: number,
  carbs: number,
  fat: number
): MacroBalanceResult {
  if (kcal <= 0) return { score: 'No Data', color: 'var(--warm-gray)' };

  const pKcal = protein * 4;
  const cKcal = carbs * 4;
  const fKcal = fat * 9;
  const total = pKcal + cKcal + fKcal;

  if (total <= 0) return { score: 'Balanced Fuel', color: 'var(--sage)' };

  const pPct = (pKcal / total) * 100;
  const cPct = (cKcal / total) * 100;
  const fPct = (fKcal / total) * 100;

  // PRIORITY 1: Keto Friendly (Fat > 60%, Carbs < 15%)
  if (fPct > 60 && cPct < 15) {
    return { score: 'Keto Friendly', color: '#8B5CF6' }; // Purple
  }

  // PRIORITY 2: Lean & Fit (Protein > 30%, Fat < 20%)
  if (pPct > 30 && fPct < 20) {
    return { score: 'Lean & Fit', color: '#10B981' }; // Emerald
  }

  // PRIORITY 3: High Energy (Carbs > 55%, Protein > 20%)
  if (cPct > 55 && pPct > 20) {
    return { score: 'High Energy', color: '#F59E0B' }; // Amber
  }

  // PRIORITY 4: Low Carb (Carbs < 25%)
  if (cPct < 25) {
    return { score: 'Low Carb', color: '#3B82F6' }; // Blue
  }

  // PRIORITY 5: Protein Focused (Protein > 35%)
  if (pPct > 35) {
    return { score: 'Protein Focused', color: 'var(--terracotta)' };
  }

  // PRIORITY 6: High Carbs (Carbs > 60%)
  if (cPct > 60) {
    return { score: 'High Carbs', color: 'var(--sage-light)' };
  }

  // PRIORITY 7: Healthy Fats (Fat > 35%)
  if (fPct > 35) {
    return { score: 'Healthy Fats', color: 'var(--terracotta-light)' };
  }

  // FALLBACK: Balanced Fuel
  return { score: 'Balanced Fuel', color: 'var(--sage)' };
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
