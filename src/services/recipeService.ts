import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { MealItem, MealPlan } from '../types';
import { getRecipeFromDictionary, saveRecipeToDictionary } from './dictionaryService';
import { batchTranslateRecipes } from './geminiService';
import { getYouTubeVideoId } from './youtubeService';

export interface SyncProgress {
  total: number;
  processed: number;
  updated: number;
  addedToDictionary: number;
}

const BASIC_STAPLES = [
  'rice', 'roti', 'chapati', 'dal', 'water', 'bread', 'salad', 'papad', 
  'curd', 'pickle', 'raita', 'phulka', 'paratha', 'steamed rice', 'basmati rice'
];
const isBasicStaple = (name: string) => BASIC_STAPLES.some(staple => name.toLowerCase().includes(staple));
const isInvalid = (val: string | undefined) => !val || val.includes('(Bengali)') || val.includes('(Hindi)') || val.startsWith('Error:');

/**
 * Extracts the first numeric value from a quantity string (e.g., "6 roti" -> 6)
 */
function extractQuantityNumber(q: string | undefined): number | null {
  if (!q) return null;
  const match = q.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Scales nutrition based on quantity changes
 */
export function scaleNutrition(item: MealItem, newQuantity: string): Partial<MealItem> {
  if (!item.baseNutrition || !item.baseQuantity) return {};

  const baseNum = extractQuantityNumber(item.baseQuantity);
  const newNum = extractQuantityNumber(newQuantity);

  if (baseNum && newNum && baseNum > 0) {
    const factor = newNum / baseNum;
    return {
      nutrition: {
        kcal: Math.round(item.baseNutrition.kcal * factor),
        protein: Math.round(item.baseNutrition.protein * factor * 10) / 10,
        carbs: Math.round(item.baseNutrition.carbs * factor * 10) / 10,
        fat: Math.round(item.baseNutrition.fat * factor * 10) / 10,
      }
    };
  }
  return {};
}

/**
 * Processes meal items to add translations and video URLs if missing.
 * Uses dictionary fallbacks and AI translations.
 */
export async function processMealItems(
  householdId: string,
  items: MealItem[],
  userProfile: any
): Promise<MealItem[]> {
  if (!items || items.length === 0) return [];

  // Phase 1: Initial cleanup and tagging
  let processed = tagDietaryTypes(items);
  processed = identifyHeroDish(processed);

  const itemsToProcess: { index: number, name: string, quantity?: string, instruction?: string, needsVideo: boolean }[] = [];
  const isHindi = userProfile?.cookLanguage === 'Hindi';

  // Phase 2: Identify items needing attention
  for (let i = 0; i < processed.length; i++) {
    const item = processed[i];
    if (!item.name) continue;

    const needsTranslation = isHindi ? 
                             (isInvalid(item.hindiName) || (item.quantity && isInvalid(item.hindiQuantity)) || (item.instruction && isInvalid(item.hindiInstruction))) :
                             (isInvalid(item.bengaliName) || (item.quantity && isInvalid(item.bengaliQuantity)) || (item.instruction && isInvalid(item.bengaliInstruction)));
    
    const needsVideo = !item.videoUrl && !isBasicStaple(item.name) && item.isHero;
    const needsLocalVideo = false; // Disable dual search to save 50% quota

    if (needsTranslation || needsVideo || needsLocalVideo) {
      itemsToProcess.push({ 
        index: i, 
        name: item.name, 
        quantity: item.quantity,
        instruction: item.instruction,
        needsVideo: needsVideo || needsLocalVideo 
      });
    }
  }

  if (itemsToProcess.length === 0) return processed;

  // Phase 2: Check dictionary for missing items
  const missingFromDict: (typeof itemsToProcess[0] & { dictItem?: any })[] = [];
  
  for (const req of itemsToProcess) {
    const dictItem = await getRecipeFromDictionary(householdId, req.name);
    const item = processed[req.index];

    const hasNeededName = isHindi ? (dictItem?.hindiName && !dictItem.hindiName.startsWith('Error:')) : (dictItem?.bengaliName && !dictItem.bengaliName.startsWith('Error:'));
    const hasNeededVideos = !req.needsVideo || (dictItem?.videoUrl && (isHindi ? dictItem?.hindiVideoUrl : dictItem?.bengaliVideoUrl));
    
    const needsQtyTrans = req.quantity && (isHindi ? isInvalid(item.hindiQuantity) : isInvalid(item.bengaliQuantity));
    const needsInstrTrans = req.instruction && (isHindi ? isInvalid(item.hindiInstruction) : isInvalid(item.bengaliInstruction));

    // If dictionary has everything we need, apply it immediately
    if (dictItem && hasNeededName && hasNeededVideos && !needsQtyTrans && !needsInstrTrans) {
      if (isHindi) {
        processed[req.index] = {
          ...item,
          hindiName: isInvalid(item.hindiName) ? dictItem.hindiName : item.hindiName,
          videoUrl: item.videoUrl || dictItem.videoUrl,
          hindiVideoUrl: item.hindiVideoUrl || dictItem.hindiVideoUrl || dictItem.videoUrl // Fallback
        };
      } else {
        processed[req.index] = {
          ...item,
          bengaliName: isInvalid(item.bengaliName) ? dictItem.bengaliName : item.bengaliName,
          videoUrl: item.videoUrl || dictItem.videoUrl,
          bengaliVideoUrl: item.bengaliVideoUrl || dictItem.bengaliVideoUrl
        };
      }
    } else {
      missingFromDict.push({ ...req, dictItem });
    }
  }

  if (missingFromDict.length === 0) return finalizeItems(processed);

  // Phase 3: AI Translation for items still missing data
  try {
    const itemsToTranslate = missingFromDict.filter(req => {
      const item = processed[req.index];
      const lName = isHindi ? 
                    ((!isInvalid(item.hindiName)) ? item.hindiName : (req.dictItem?.hindiName || '')) :
                    ((!isInvalid(item.bengaliName)) ? item.bengaliName : (req.dictItem?.bengaliName || ''));
      
      const lQty = isHindi ? (!isInvalid(item.hindiQuantity) ? item.hindiQuantity : '') : (!isInvalid(item.bengaliQuantity) ? item.bengaliQuantity : '');
      const lInstr = isHindi ? (!isInvalid(item.hindiInstruction) ? item.hindiInstruction : '') : (!isInvalid(item.bengaliInstruction) ? item.bengaliInstruction : '');

      return isInvalid(lName) || (req.quantity && isInvalid(lQty)) || (req.instruction && isInvalid(lInstr));
    });

    let translations: any[] = [];
    if (itemsToTranslate.length > 0) {
      translations = await batchTranslateRecipes(itemsToTranslate, userProfile);
    }

    let translationIdx = 0;
    await Promise.all(missingFromDict.map(async (req) => {
      const item = processed[req.index];
      let lName = isHindi ? 
                  ((!isInvalid(item.hindiName)) ? item.hindiName : (req.dictItem?.hindiName || '')) :
                  ((!isInvalid(item.bengaliName)) ? item.bengaliName : (req.dictItem?.bengaliName || ''));
      
      let lQty = isHindi ? (!isInvalid(item.hindiQuantity) ? item.hindiQuantity : '') : (!isInvalid(item.bengaliQuantity) ? item.bengaliQuantity : '');
      let lInstr = isHindi ? (!isInvalid(item.hindiInstruction) ? item.hindiInstruction : '') : (!isInvalid(item.bengaliInstruction) ? item.bengaliInstruction : '');

      const needsAI = isInvalid(lName) || (req.quantity && isInvalid(lQty)) || (req.instruction && isInvalid(lInstr));

      if (needsAI && translationIdx < translations.length) {
        const t = translations[translationIdx++];
        if (isHindi) {
          if (isInvalid(lName)) lName = t?.hindiName || item.name;
          if (req.quantity && isInvalid(lQty)) lQty = t?.hindiQuantity || '';
          if (req.instruction && isInvalid(lInstr)) lInstr = t?.hindiInstruction || '';
        } else {
          if (isInvalid(lName)) lName = t?.bengaliName || item.name;
          if (req.quantity && isInvalid(lQty)) lQty = t?.bengaliQuantity || '';
          if (req.instruction && isInvalid(lInstr)) lInstr = t?.bengaliInstruction || '';
        }
      }

      // Phase 4: Video Lookups
      let vUrl = item.videoUrl || req.dictItem?.videoUrl || '';
      let lvUrl = isHindi ? (item.hindiVideoUrl || req.dictItem?.hindiVideoUrl || '') : (item.bengaliVideoUrl || req.dictItem?.bengaliVideoUrl || '');
      let isAutomaticSearch = false;

      if (req.needsVideo) {
        // Only one search per item to save 100 credits
        const fetchedVideo = await getYouTubeVideoId(`${item.name} recipe`);
        vUrl = fetchedVideo;
        lvUrl = fetchedVideo; // Use same video for local as fallback
        isAutomaticSearch = !!fetchedVideo;
      }

      if (isHindi) {
        processed[req.index] = {
          ...item,
          hindiName: lName,
          hindiQuantity: lQty,
          hindiInstruction: lInstr,
          videoUrl: vUrl,
          hindiVideoUrl: lvUrl
        };
      } else {
        processed[req.index] = {
          ...item,
          bengaliName: lName,
          bengaliQuantity: lQty,
          bengaliInstruction: lInstr,
          videoUrl: vUrl,
          bengaliVideoUrl: lvUrl
        };
      }

      // Save back to dictionary
      const nutrition = item.nutrition || req.dictItem?.nutrition;
      const dictData: any = {
        id: item.name.trim().toLowerCase(),
        name: item.name,
        videoUrl: vUrl,
        nutrition: nutrition, // Preserve nutrition
        lastUpdated: Date.now()
      };
      
      // Update the processed item with base nutrition for linear scaling
      if (nutrition) {
        processed[req.index] = {
          ...processed[req.index],
          nutrition: nutrition,
          baseNutrition: nutrition,
          baseQuantity: item.quantity
        };
      }
      if (isHindi) {
        dictData.hindiName = lName;
        dictData.hindiVideoUrl = lvUrl;
        if (req.dictItem?.bengaliName) dictData.bengaliName = req.dictItem.bengaliName;
        if (req.dictItem?.bengaliVideoUrl) dictData.bengaliVideoUrl = req.dictItem.bengaliVideoUrl;
      } else {
        dictData.bengaliName = lName;
        dictData.bengaliVideoUrl = lvUrl;
        if (req.dictItem?.hindiName) dictData.hindiName = req.dictItem.hindiName;
        if (req.dictItem?.hindiVideoUrl) dictData.hindiVideoUrl = req.dictItem.hindiVideoUrl;
      }
      await saveRecipeToDictionary(householdId, dictData, isAutomaticSearch);
    }));
  } catch (error) {
    console.error("Error in AI processing phase:", error);
  }

  return finalizeItems(processed);
}

/**
 * Identifies the star dish of a meal based on a hierarchy of importance.
 * Staples (rice, roti) are never heroes. Non-veg > Veg specialty > Dal.
 */
export function identifyHeroDish(items: MealItem[]): MealItem[] {
  if (!items || items.length === 0) return items;

  // Clear existing hero flags
  const processed = items.map(item => ({ ...item, isHero: false }));

  // Find non-staples
  const candidates = processed.filter(item => !isBasicStaple(item.name));

  if (candidates.length === 0) {
    // If all are staples, pick the first one (fallback)
    processed[0].isHero = true;
    return processed;
  }

  // Sort candidates by "Hero Potential"
  // Priority: Non-Veg > Egg > Veg specialty
  const hero = candidates.sort((a, b) => {
    const score = (item: MealItem) => {
      if (item.dietaryType === 'non-veg') return 3;
      if (item.dietaryType === 'egg') return 2;
      return 1;
    };
    return score(b) - score(a);
  })[0];

  hero.isHero = true;
  return processed;
}

/**
 * Basic heuristic to tag dietary type based on common keywords.
 * In a real-world app, this could be an AI call or a database flag.
 */
function tagDietaryTypes(items: MealItem[]): MealItem[] {
  const nonVegKeywords = ['chicken', 'mutton', 'fish', 'pork', 'beef', 'prawn', 'shrimp', 'meat', 'egg'];
  const eggKeywords = ['egg', 'anda', 'omelette', 'bhurji'];

  return items.map(item => {
    const name = item.name.toLowerCase();
    let type: 'veg' | 'non-veg' | 'egg' = 'veg';

    if (nonVegKeywords.some(k => name.includes(k))) {
      type = 'non-veg';
      // Refine if it's just egg
      if (eggKeywords.some(k => name.includes(k)) && !nonVegKeywords.filter(k => k !== 'egg').some(k => name.includes(k))) {
        type = 'egg';
      }
    }

    return { ...item, dietaryType: item.dietaryType || type };
  });
}

function finalizeItems(items: MealItem[]): MealItem[] {
  return items.map(item => ({
    ...item,
    bengaliName: item.bengaliName || '',
    bengaliQuantity: item.bengaliQuantity || '',
    bengaliInstruction: item.bengaliInstruction || '',
    bengaliVideoUrl: item.bengaliVideoUrl || '',
    hindiName: item.hindiName || '',
    hindiQuantity: item.hindiQuantity || '',
    hindiInstruction: item.hindiInstruction || '',
    hindiVideoUrl: item.hindiVideoUrl || '',
    videoUrl: item.videoUrl || '',
    quantity: item.quantity || '',
    instruction: item.instruction || ''
  }));
}

/**
 * Syncs all historical meal plans for a household.
 * Updates dictionary and processes missing data.
 */
export async function syncHistoricalData(
  householdId: string,
  userProfile: any,
  onProgress?: (progress: SyncProgress) => void
): Promise<void> {
  const q = query(collection(db, 'mealPlans'), where('ownerId', '==', householdId));
  const snapshot = await getDocs(q);
  
  let updatedCount = 0;
  let dictionaryAddedCount = 0;
  const processedRecipeNames = new Set<string>();
  let batch = writeBatch(db);
  let batchSize = 0;

  const progress: SyncProgress = {
    total: snapshot.size,
    processed: 0,
    updated: updatedCount,
    addedToDictionary: dictionaryAddedCount
  };

  const updateProgress = () => {
    progress.processed++;
    progress.updated = updatedCount;
    progress.addedToDictionary = dictionaryAddedCount;
    onProgress?.({ ...progress });
  };

  const commitBatch = async () => {
    if (batchSize > 0) {
      await batch.commit();
      batch = writeBatch(db);
      batchSize = 0;
    }
  };

  for (const document of snapshot.docs) {
    const data = document.data() as MealPlan;
    let hasChanges = false;

    // Pass 1: Push existing items with good data to dictionary
    const itemsToExtract = [
      ...(data.breakfast || []),
      ...(data.lunch || []),
      ...(data.dinner || []),
      ...(data.snacks || [])
    ];

    for (const item of itemsToExtract) {
      if (!item.name) continue;
      const id = item.name.trim().toLowerCase();
      if (processedRecipeNames.has(id) || isBasicStaple(item.name)) continue;

      if (!isInvalid(item.bengaliName) || !isInvalid(item.hindiName) || item.videoUrl || item.bengaliVideoUrl || item.hindiVideoUrl) {
        const globalId = id.replace(/\s+/g, '_');
        const proposalId = `${householdId}_${globalId}`;
        const docRef = doc(db, "recipeProposals", proposalId);
        
        const dataToSave: any = {
          id: globalId,
          name: item.name,
          bengaliName: item.bengaliName || '',
          hindiName: item.hindiName || '',
          videoUrl: item.videoUrl || '',
          bengaliVideoUrl: item.bengaliVideoUrl || '',
          hindiVideoUrl: item.hindiVideoUrl || '',
          ownerId: householdId,
          lastUpdated: Date.now()
        };
        
        batch.set(docRef, dataToSave, { merge: true });
        batchSize++;
        processedRecipeNames.add(id);
        dictionaryAddedCount++;
        
        if (batchSize >= 400) await commitBatch();
      }
    }

    // Pass 2: Process missing data
    const processMealType = async (items: MealItem[]) => {
      if (!items || items.length === 0) return items;
      const processed = await processMealItems(householdId, items, userProfile);
      if (JSON.stringify(items) !== JSON.stringify(processed)) {
        hasChanges = true;
      }
      return processed;
    };

    const [uBreakfast, uLunch, uDinner, uSnacks] = await Promise.all([
      processMealType(data.breakfast || []),
      processMealType(data.lunch || []),
      processMealType(data.dinner || []),
      processMealType(data.snacks || [])
    ]);

    if (hasChanges) {
      batch.set(doc(db, 'mealPlans', document.id), {
        ...data,
        breakfast: uBreakfast,
        lunch: uLunch,
        dinner: uDinner,
        snacks: uSnacks
      }, { merge: true });
      batchSize++;
      updatedCount++;
    }

    updateProgress();
    
    if (batchSize >= 400) await commitBatch();

    if (snapshot.size > 5) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  await commitBatch();
}

/**
 * Scans the household's recipe library (proposals) and fills in missing nutrition data.
 * Uses batching for efficiency.
 */
export async function syncNutritionForLibrary(
  householdId: string,
  onProgress?: (progress: { total: number, processed: number, updated: number }) => void
): Promise<void> {
  const { getBatchNutrition } = await import('./geminiService');
  
  // 1. Fetch all proposals for this household
  const q = query(collection(db, 'recipeProposals'), where('ownerId', '==', householdId));
  const snapshot = await getDocs(q);
  
  const allProposals = snapshot.docs.map(d => d.data());
  const needsNutrition = allProposals.filter(p => {
    return !p.nutrition || 
           typeof p.nutrition !== 'object' || 
           p.nutrition.kcal === 0 || 
           !p.nutrition.kcal;
  });
  
  if (needsNutrition.length === 0) return;

  const total = needsNutrition.length;
  let processed = 0;
  let updatedCount = 0;

  // 2. Batch process in chunks of 8
  const chunkSize = 8;
  for (let i = 0; i < needsNutrition.length; i += chunkSize) {
    const chunk = needsNutrition.slice(i, i + chunkSize);
    
    try {
      const itemsForAI = chunk.map(p => {
        const globalId = p.name.trim().toLowerCase().replace(/\s+/g, '_');
        return { id: globalId, name: p.name };
      });
      
      const nutritionResults = await getBatchNutrition(itemsForAI);
      
      const batch = writeBatch(db);
      for (const result of nutritionResults) {
        // Match by ID
        const original = chunk.find(p => {
          const gid = p.name.trim().toLowerCase().replace(/\s+/g, '_');
          return gid === result.id;
        });

        if (original) {
          const globalId = original.name.trim().toLowerCase().replace(/\s+/g, '_');
          const proposalId = `${householdId}_${globalId}`;
          const docRef = doc(db, 'recipeProposals', proposalId);
          
          const nutritionData = {
            kcal: Number(result.kcal) || 0,
            protein: Number(result.protein) || 0,
            carbs: Number(result.carbs) || 0,
            fat: Number(result.fat) || 0
          };

          batch.update(docRef, {
            nutrition: nutritionData
          });
          updatedCount++;
        }
      }
      
      await batch.commit();
      processed += chunk.length;
      onProgress?.({ total, processed, updated: updatedCount });
      
    } catch (error) {
      console.error("Error processing nutrition chunk:", error);
    }
    
    // Slight delay to avoid rate limits
    if (i + chunkSize < needsNutrition.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
