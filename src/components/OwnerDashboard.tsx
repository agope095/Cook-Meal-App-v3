import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, writeBatch, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format, addDays, subDays } from 'date-fns';
import { MealPlan, MealItem } from '../types';
import { Plus, Trash2, Calendar as CalendarIcon, Save, Youtube, ChevronLeft, ChevronRight, Upload, FileText, Download, Sparkles, Heart } from 'lucide-react';
import Papa from 'papaparse';
import { getBengaliRecipe, batchTranslateRecipes } from '../services/geminiService';
import { getRecipeFromDictionary, saveRecipeToDictionary } from '../services/dictionaryService';
import { getYouTubeVideoId } from '../services/youtubeService';
import AIMealPlanner from './AIMealPlanner';
import FavoritesView from './FavoritesView';
import { AIMealDraft } from '../services/geminiService';

interface OwnerDashboardProps {
  householdId: string;
}

export default function OwnerDashboard({ householdId }: OwnerDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'favorites'>('manual');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDays, setExportDays] = useState(7);
  const [syncing, setSyncing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncAllHistoricalData = async () => {
    setSyncing(true);
    try {
      const q = query(collection(db, 'mealPlans'), where('ownerId', '==', householdId));
      const querySnapshot = await getDocs(q);
      let updatedCount = 0;
      let dictionaryAddedCount = 0;
      const processedRecipeNames = new Set<string>();

      const basicStaples = ['rice', 'roti', 'chapati', 'dal', 'water', 'bread', 'salad', 'papad'];
      const isBasicStaple = (name: string) => basicStaples.some(staple => name.toLowerCase().includes(staple));

      for (const document of querySnapshot.docs) {
        const data = document.data() as MealPlan;
        let hasChanges = false;

        // Pass 1: Push existing items to dictionary
        const extractAndSaveToDict = async (items: MealItem[]) => {
          if (!items || items.length === 0) return;
          for (const item of items) {
            if (!item.name) continue;
            const id = item.name.trim().toLowerCase();
            if (processedRecipeNames.has(id) || isBasicStaple(item.name)) continue;

            // Only push if it has some useful data
            if (item.bengaliName || item.videoUrl || item.bengaliVideoUrl) {
              await saveRecipeToDictionary(householdId, {
                id: id,
                name: item.name,
                bengaliName: item.bengaliName || '',
                videoUrl: item.videoUrl || '',
                bengaliVideoUrl: item.bengaliVideoUrl || '',
                lastUpdated: Date.now()
              });
              processedRecipeNames.add(id);
              dictionaryAddedCount++;
            }
          }
        };

        await extractAndSaveToDict(data.breakfast || []);
        await extractAndSaveToDict(data.lunch || []);
        await extractAndSaveToDict(data.dinner || []);
        await extractAndSaveToDict(data.snacks || []);

        // Pass 2: Process missing data (videos/translations)
        const processMealType = async (items: MealItem[]) => {
          if (!items || items.length === 0) return items;
          const processed = await processItems(items);
          if (JSON.stringify(items) !== JSON.stringify(processed)) {
            hasChanges = true;
          }
          return processed;
        };

        const updatedBreakfast = await processMealType(data.breakfast || []);
        const updatedLunch = await processMealType(data.lunch || []);
        const updatedDinner = await processMealType(data.dinner || []);
        const updatedSnacks = await processMealType(data.snacks || []);

        if (hasChanges) {
          await setDoc(doc(db, 'mealPlans', document.id), {
            ...data,
            breakfast: updatedBreakfast,
            lunch: updatedLunch,
            dinner: updatedDinner,
            snacks: updatedSnacks
          });
          updatedCount++;
        }
        
        // Add a small delay between processing documents to avoid hitting API rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      console.log(`Successfully pushed ${dictionaryAddedCount} unique recipes to the dictionary and updated ${updatedCount} historical meal plan(s)!`);
    } catch (error) {
      console.error("Error syncing historical data:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Form state
  const [lunchItems, setLunchItems] = useState<MealItem[]>([]);
  const [dinnerItems, setDinnerItems] = useState<MealItem[]>([]);

  // Cleanup old records (older than 90 days) automatically when admin logs in
  useEffect(() => {
    const purgeOldData = async () => {
      try {
        const cutoffDate = subDays(new Date(), 90);
        const cutoffDateStr = format(cutoffDate, 'yyyy-MM-dd');
        
        const q = query(
          collection(db, 'mealPlans'),
          where('ownerId', '==', householdId),
          where(documentId(), '<', `${householdId}_${cutoffDateStr}`)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          console.log(`Purged ${snapshot.size} old meal plans.`);
        }
      } catch (error) {
        console.error("Error purging old data:", error);
      }
    };

    purgeOldData();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !householdId) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${householdId}_${dateStr}`);

    setLoading(true);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MealPlan;
        setMealPlan(data);
        setLunchItems(data.lunch || []);
        setDinnerItems(data.dinner || []);
      } else {
        setMealPlan(null);
        setLunchItems([]);
        setDinnerItems([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching meal plan:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'owners', auth.currentUser.uid));
        if (snap.exists()) {
          setUserProfile(snap.data());
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
      }
    };
    fetchProfile();
  }, []);

  const processItems = async (items: MealItem[], profile?: any) => {
    const processed = [...items];
    const itemsToProcess: { index: number, name: string, quantity?: string, instruction?: string, needsVideo: boolean }[] = [];

    const basicStaples = ['rice', 'roti', 'chapati', 'dal', 'water', 'bread', 'salad', 'papad'];
    const isBasicStaple = (name: string) => basicStaples.some(staple => name.toLowerCase().includes(staple));

    for (let i = 0; i < processed.length; i++) {
      const item = processed[i];
      if (!item.name) continue;

      const needsNameTranslation = !item.bengaliName || item.bengaliName.includes('(Bengali)') || item.bengaliName.includes('(Hindi)') || item.bengaliName.startsWith('Error:');
      const needsQuantityTranslation = item.quantity && (!item.bengaliQuantity || item.bengaliQuantity.includes('(Bengali)') || item.bengaliQuantity.includes('(Hindi)') || item.bengaliQuantity.startsWith('Error:'));
      const needsInstructionTranslation = item.instruction && (!item.bengaliInstruction || item.bengaliInstruction.includes('(Bengali)') || item.bengaliInstruction.includes('(Hindi)') || item.bengaliInstruction.startsWith('Error:'));
      const needsTranslation = needsNameTranslation || needsQuantityTranslation || needsInstructionTranslation;
      
      const needsHindiVideo = !item.videoUrl && !isBasicStaple(item.name);
      const needsBengaliVideo = !item.bengaliVideoUrl && !isBasicStaple(item.name);

      if (needsTranslation || needsHindiVideo || needsBengaliVideo) {
        itemsToProcess.push({ 
          index: i, 
          name: item.name, 
          quantity: item.quantity,
          instruction: item.instruction,
          needsVideo: needsHindiVideo || needsBengaliVideo 
        });
      }
    }

    if (itemsToProcess.length > 0) {
      const missingFromDict: (typeof itemsToProcess[0] & { dictItem?: any })[] = [];
      
      for (const req of itemsToProcess) {
        const dictItem = await getRecipeFromDictionary(householdId, req.name);
        
        const hasNeededNameTranslation = dictItem?.bengaliName && !dictItem.bengaliName.startsWith('Error:');
        const hasNeededVideos = !req.needsVideo || (dictItem?.videoUrl && dictItem?.bengaliVideoUrl);
        
        const item = processed[req.index];
        const needsQuantityTranslation = req.quantity && (!item.bengaliQuantity || item.bengaliQuantity.startsWith('Error:'));
        const needsInstructionTranslation = req.instruction && (!item.bengaliInstruction || item.bengaliInstruction.startsWith('Error:'));

        if (dictItem && hasNeededNameTranslation && hasNeededVideos && !needsQuantityTranslation && !needsInstructionTranslation) {
          processed[req.index] = {
            ...item,
            bengaliName: (!item.bengaliName || item.bengaliName.startsWith('Error:')) ? dictItem.bengaliName : item.bengaliName,
            videoUrl: item.videoUrl || dictItem.videoUrl,
            bengaliVideoUrl: item.bengaliVideoUrl || dictItem.bengaliVideoUrl
          };
        } else {
          missingFromDict.push({ ...req, dictItem });
        }
      }

      if (missingFromDict.length > 0) {
        try {
          const itemsToTranslate = missingFromDict.filter(req => {
            const item = processed[req.index];
            const isInvalid = (val: string | undefined) => !val || val.includes('(Bengali)') || val.includes('(Hindi)') || val.startsWith('Error:');
            
            const bName = (item.bengaliName && !isInvalid(item.bengaliName)) ? item.bengaliName : (req.dictItem?.bengaliName || '');
            const bQty = (item.bengaliQuantity && !isInvalid(item.bengaliQuantity)) ? item.bengaliQuantity : '';
            const bInstr = (item.bengaliInstruction && !isInvalid(item.bengaliInstruction)) ? item.bengaliInstruction : '';

            const hasName = !isInvalid(bName);
            const hasQty = !req.quantity || !isInvalid(bQty);
            const hasInstr = !req.instruction || !isInvalid(bInstr);
            return !hasName || !hasQty || !hasInstr;
          });
          
          let translations: any[] = [];
          
          if (itemsToTranslate.length > 0) {
            translations = await batchTranslateRecipes(itemsToTranslate, profile || userProfile);
          }
          
          let translationIndex = 0;
          
          const itemsWithTranslations = missingFromDict.map(req => {
            const item = processed[req.index];
            const isInvalid = (val: string | undefined) => !val || val.includes('(Bengali)') || val.includes('(Hindi)') || val.startsWith('Error:');
            
            let bengaliName = (item.bengaliName && !isInvalid(item.bengaliName)) ? item.bengaliName : (req.dictItem?.bengaliName || '');
            let bengaliQuantity = (item.bengaliQuantity && !isInvalid(item.bengaliQuantity)) ? item.bengaliQuantity : '';
            let bengaliInstruction = (item.bengaliInstruction && !isInvalid(item.bengaliInstruction)) ? item.bengaliInstruction : '';
            
            const hasName = !isInvalid(bengaliName);
            const hasQty = !req.quantity || !isInvalid(bengaliQuantity);
            const hasInstr = !req.instruction || !isInvalid(bengaliInstruction);
            
            const needsAI = !hasName || !hasQty || !hasInstr;
            
            if (needsAI && translationIndex < translations.length) {
              const t = translations[translationIndex];
              
              if (!hasName) {
                bengaliName = t?.bengaliName || item.name;
              }
              if (!hasQty) {
                bengaliQuantity = t?.bengaliQuantity || '';
              }
              if (!hasInstr) {
                bengaliInstruction = t?.bengaliInstruction || '';
              }
              translationIndex++;
            }
            return { req, item, bengaliName, bengaliQuantity, bengaliInstruction };
          });
          
          await Promise.all(itemsWithTranslations.map(async ({ req, item, bengaliName, bengaliQuantity, bengaliInstruction }) => {
            let hindiVideoUrl = item.videoUrl || req.dictItem?.videoUrl || '';
            let bengaliVideoUrl = item.bengaliVideoUrl || req.dictItem?.bengaliVideoUrl || '';

            if (req.needsVideo) {
              const [fetchedHindi, fetchedLocal] = await Promise.all([
                !hindiVideoUrl ? getYouTubeVideoId(`${item.name} recipe`) : Promise.resolve(hindiVideoUrl),
                !bengaliVideoUrl ? getYouTubeVideoId(`${item.name} recipe in ${userProfile?.cookLanguage || 'Bengali'}`) : Promise.resolve(bengaliVideoUrl)
              ]);
              hindiVideoUrl = fetchedHindi;
              bengaliVideoUrl = fetchedLocal;
            }

            const isInvalid = (val: string | undefined) => !val || val.includes('(Bengali)') || val.includes('(Hindi)') || val.startsWith('Error:');

            processed[req.index] = {
              ...item,
              bengaliName: !isInvalid(item.bengaliName) ? item.bengaliName : bengaliName,
              bengaliQuantity: !isInvalid(item.bengaliQuantity) ? item.bengaliQuantity : bengaliQuantity,
              bengaliInstruction: !isInvalid(item.bengaliInstruction) ? item.bengaliInstruction : bengaliInstruction,
              videoUrl: hindiVideoUrl,
              bengaliVideoUrl: bengaliVideoUrl
            };

            await saveRecipeToDictionary(householdId, {
              id: item.name.trim().toLowerCase(),
              name: item.name,
              bengaliName: bengaliName,
              videoUrl: hindiVideoUrl,
              bengaliVideoUrl: bengaliVideoUrl,
              lastUpdated: Date.now()
            });
          }));
        } catch (e) {
          console.error("Failed to process missing items", e);
        }
      }
    }

    return processed.map(item => ({
      ...item,
      bengaliName: item.bengaliName || '',
      bengaliQuantity: item.bengaliQuantity || '',
      bengaliInstruction: item.bengaliInstruction || '',
      bengaliVideoUrl: item.bengaliVideoUrl || '',
      videoUrl: item.videoUrl || '',
      quantity: item.quantity || '',
      instruction: item.instruction || ''
    }));
  };

  const handleSave = async () => {
    if (!auth.currentUser || !householdId) return;
    
    setSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${householdId}_${dateStr}`);

    try {
      if (lunchItems.length === 0 && dinnerItems.length === 0) {
        await deleteDoc(docRef);
      } else {
        const [processedLunch, processedDinner] = await Promise.all([
          processItems(lunchItems),
          processItems(dinnerItems)
        ]);

        await setDoc(docRef, {
          date: dateStr,
          lunch: processedLunch,
          dinner: processedDinner,
          ownerId: householdId
        });
        
        // Update local state with the processed items so we don't re-translate next save
        setLunchItems(processedLunch);
        setDinnerItems(processedDinner);
      }
      alert('Meal plan saved successfully!');
    } catch (error: any) {
      console.error("Error saving meal plan:", error);
      
      // Detailed error info for diagnostics
      const errInfo = {
        message: error.message,
        code: error.code,
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        path: `mealPlans/${dateStr}`
      };
      
      console.error("Detailed Error Info:", JSON.stringify(errInfo, null, 2));
      alert(`Error saving meal plan: ${error.message || 'Please check permissions.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAIApprove = async (drafts: AIMealDraft[]) => {
    if (!auth.currentUser) return;
    
    const batch = writeBatch(db);
    
    for (const draft of drafts) {
      const dateStr = draft.date;
      const docRef = doc(db, 'mealPlans', `${householdId}_${dateStr}`);
      
      const convertToMealItems = (items: any[]): MealItem[] => {
        return items.map(item => ({
          id: Math.random().toString(36).substr(2, 9),
          name: item.name,
          quantity: item.quantity,
          instruction: item.instruction,
          bengaliName: item.nameBn || '',
          bengaliQuantity: item.quantityBn || '',
          bengaliInstruction: item.instructionBn || '',
          videoUrl: '',
          bengaliVideoUrl: ''
        }));
      };

      
      const draftLunchItems = convertToMealItems(draft.lunch);
      const draftDinnerItems = convertToMealItems(draft.dinner);
      
      const [processedLunch, processedDinner] = await Promise.all([
        processItems(draftLunchItems),
        processItems(draftDinnerItems)
      ]);
      
      batch.set(docRef, {
        date: dateStr,
        lunch: processedLunch,
        dinner: processedDinner,
        ownerId: householdId
      }, { merge: true });
    }
    
    await batch.commit();
    alert('AI Meal Plan saved successfully!');
    setActiveTab('manual');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !auth.currentUser || !householdId) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''),
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          
          // Group by date
          const mealsByDate: Record<string, { lunch: MealItem[], dinner: MealItem[] }> = {};
          
          rows.forEach(row => {
            const date = row['Date']?.trim();
            const mealType = row['Meal']?.trim().toLowerCase();
            const name = row['Item Name']?.trim() || row['Item']?.trim() || row['Name']?.trim();
            const bengaliName = row['Bengali Name']?.trim() || '';
            const quantity = row['Quantity']?.trim() || '';
            const bengaliQuantity = row['Bengali Quantity']?.trim() || '';
            const instruction = row['Special Instruction']?.trim() || '';
            const bengaliInstruction = row['Bengali Instruction']?.trim() || '';
            const videoUrl = row['Video URL']?.trim() || row['Link']?.trim() || '';
            const bengaliVideoUrl = row['Bengali Video URL']?.trim() || '';
            
            if (!date || !mealType || !name) return; // Skip invalid rows
            
            if (!mealsByDate[date]) {
              mealsByDate[date] = { lunch: [], dinner: [] };
            }
            
            const item: MealItem = {
              id: Math.random().toString(36).substr(2, 9),
              name,
              bengaliName: bengaliName || '',
              quantity: quantity || '',
              bengaliQuantity: bengaliQuantity || '',
              instruction: instruction || '',
              bengaliInstruction: bengaliInstruction || '',
              videoUrl: videoUrl || '',
              bengaliVideoUrl: bengaliVideoUrl || ''
            };
            
            if (mealType === 'lunch') {
              mealsByDate[date].lunch.push(item);
            } else if (mealType === 'dinner') {
              mealsByDate[date].dinner.push(item);
            }
          });
          
          // Process all items using the new processItems function
          await Promise.all(Object.keys(mealsByDate).map(async (dateStr) => {
            const [processedLunch, processedDinner] = await Promise.all([
              processItems(mealsByDate[dateStr].lunch),
              processItems(mealsByDate[dateStr].dinner)
            ]);
            mealsByDate[dateStr].lunch = processedLunch;
            mealsByDate[dateStr].dinner = processedDinner;
          }));

          // Batch write to Firestore
          const batch = writeBatch(db);
          let count = 0;
          
          for (const [dateStr, meals] of Object.entries(mealsByDate)) {
            const docRef = doc(db, 'mealPlans', `${householdId}_${dateStr}`);
            batch.set(docRef, {
              date: dateStr,
              lunch: meals.lunch,
              dinner: meals.dinner,
              ownerId: householdId
            });
            count++;
          }
          
          if (count > 0) {
            await batch.commit();
            alert(`Successfully imported meal plans for ${count} day(s)!`);
          } else {
            alert('No valid meal data found in the CSV. Please check the format.');
          }
          
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          console.error("Error processing CSV:", error);
          alert('Error processing CSV. Please check the format and your permissions.');
        } finally {
          setUploading(false);
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert('Error parsing CSV file.');
        setUploading(false);
      }
    });
  };

  const handleExport = async (days: number) => {
    setExporting(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const q = query(
        collection(db, 'mealPlans'),
        where('ownerId', '==', householdId),
        where(documentId(), '>=', `${householdId}_${startDateStr}`),
        where(documentId(), '<=', `${householdId}_${endDateStr}`)
      );

      const snapshot = await getDocs(q);
      const exportData: any[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MealPlan;
        const date = data.date;

        if (data.lunch) {
          data.lunch.forEach(item => {
            exportData.push({
              'Date': date,
              'Meal': 'Lunch',
              'Item Name': item.name,
              'Bengali Name': item.bengaliName || '',
              'Quantity': item.quantity || '',
              'Bengali Quantity': item.bengaliQuantity || '',
              'Special Instruction': item.instruction || '',
              'Bengali Instruction': item.bengaliInstruction || '',
              'Video URL': item.videoUrl || '',
              'Bengali Video URL': item.bengaliVideoUrl || ''
            });
          });
        }

        if (data.dinner) {
          data.dinner.forEach(item => {
            exportData.push({
              'Date': date,
              'Meal': 'Dinner',
              'Item Name': item.name,
              'Bengali Name': item.bengaliName || '',
              'Quantity': item.quantity || '',
              'Bengali Quantity': item.bengaliQuantity || '',
              'Special Instruction': item.instruction || '',
              'Bengali Instruction': item.bengaliInstruction || '',
              'Video URL': item.videoUrl || '',
              'Bengali Video URL': item.bengaliVideoUrl || ''
            });
          });
        }
      });

      if (exportData.length === 0) {
        alert(`No meal plans found for the last ${days} days.`);
        setExporting(false);
        return;
      }

      // Sort by date descending
      exportData.sort((a, b) => b.Date.localeCompare(a.Date));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meal-plan-export-${days}-days.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const addItem = (mealType: 'lunch' | 'dinner') => {
    const newItem: MealItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      quantity: '',
      bengaliQuantity: '',
      instruction: '',
      bengaliInstruction: '',
      videoUrl: '',
      bengaliName: '',
      bengaliVideoUrl: ''
    };
    
    if (mealType === 'lunch') {
      setLunchItems([...lunchItems, newItem]);
    } else {
      setDinnerItems([...dinnerItems, newItem]);
    }
  };

  const updateItem = (mealType: 'lunch' | 'dinner', id: string, field: keyof MealItem, value: string) => {
    const items = mealType === 'lunch' ? lunchItems : dinnerItems;
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // If name changes, clear both translations so they get re-fetched
        if (field === 'name') {
          updated.bengaliName = undefined;
          updated.bengaliVideoUrl = undefined;
        }
        // If videoUrl changes, clear the bengali video url so it gets re-fetched if needed
        if (field === 'videoUrl') {
          updated.bengaliVideoUrl = undefined;
        }
        return updated;
      }
      return item;
    });
    
    if (mealType === 'lunch') {
      setLunchItems(updatedItems);
    } else {
      setDinnerItems(updatedItems);
    }
  };

  const removeItem = (mealType: 'lunch' | 'dinner', id: string) => {
    if (mealType === 'lunch') {
      setLunchItems(lunchItems.filter(item => item.id !== id));
    } else {
      setDinnerItems(dinnerItems.filter(item => item.id !== id));
    }
  };

  const handleManualTranslate = async (mealType: 'lunch' | 'dinner', item: MealItem) => {
    if (!item.name) return;
    
    // Set a temporary loading state for this specific item
    updateItem(mealType, item.id, 'bengaliName', 'Translating...');
    
    try {
      // Create a copy of the item with empty bengaliName so processItems knows it needs translation
      const itemToProcess = { ...item, bengaliName: '' };
      const processed = await processItems([itemToProcess], userProfile);
      const result = processed[0];
      
      const items = mealType === 'lunch' ? lunchItems : dinnerItems;
      const updatedItems = items.map(i => i.id === item.id ? result : i);
      
      if (mealType === 'lunch') {
        setLunchItems(updatedItems);
      } else {
        setDinnerItems(updatedItems);
      }
    } catch (error) {
      console.error("Manual translation failed:", error);
      updateItem(mealType, item.id, 'bengaliName', ''); // Clear the loading text on error
      alert("Translation failed. Please try again or type manually.");
    }
  };

  const renderMealSection = (mealType: 'lunch' | 'dinner', items: MealItem[]) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800 capitalize">{mealType}</h3>
        <button
          onClick={() => addItem(mealType)}
          className="flex items-center text-sm bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition-colors"
        >
          <Plus size={16} className="mr-1" /> Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 italic text-center py-4">No items added yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className={`flex flex-col md:flex-row gap-4 p-4 rounded-lg border transition-all ${item.prepared ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Item Name (e.g., Chicken Curry)"
                      value={item.name}
                      onChange={(e) => updateItem(mealType, item.id, 'name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 line-through opacity-70' : 'bg-white border-gray-300'}`}
                    />
                    {item.prepared && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Prepared</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleManualTranslate(mealType, item)}
                    disabled={!item.name || item.bengaliName === 'Translating...'}
                    className="flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="AI Translate to Bengali"
                  >
                    <Sparkles size={18} />
                  </button>
                </div>

                {/* Cook Note Display */}
                {item.note && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3 shadow-sm">
                    <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-0.5">Cook's Note</span>
                      <p className="text-sm font-bold text-blue-900">{item.note}</p>
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  placeholder={`${userProfile?.cookLanguage || 'Local'} Name (Optional - Auto-translates on save)`}
                  value={item.bengaliName || ''}
                  onChange={(e) => updateItem(mealType, item.id, 'bengaliName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                />
                <input
                  type="text"
                  placeholder="Quantity (e.g., 2 cups, 500g)"
                  value={item.quantity}
                  onChange={(e) => updateItem(mealType, item.id, 'quantity', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                />
                <input
                  type="text"
                  placeholder={`${userProfile?.cookLanguage || 'Local'} Quantity (Optional - Auto-translates on save)`}
                  value={item.bengaliQuantity || ''}
                  onChange={(e) => updateItem(mealType, item.id, 'bengaliQuantity', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                />
                <input
                  type="text"
                  placeholder="Special Instruction (e.g., Chop one onion)"
                  value={item.instruction || ''}
                  onChange={(e) => updateItem(mealType, item.id, 'instruction', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                />
                <input
                  type="text"
                  placeholder={`${userProfile?.cookLanguage || 'Local'} Instruction (Optional - Auto-translates on save)`}
                  value={item.bengaliInstruction || ''}
                  onChange={(e) => updateItem(mealType, item.id, 'bengaliInstruction', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                />
                <div className="flex items-center">
                  <Youtube size={18} className="text-gray-400 mr-2" />
                  <input
                    type="url"
                    placeholder="YouTube Video URL (Optional)"
                    value={item.videoUrl || ''}
                    onChange={(e) => updateItem(mealType, item.id, 'videoUrl', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div className="flex items-center">
                  <Youtube size={18} className="text-gray-400 mr-2" />
                  <input
                    type="url"
                    placeholder={`${userProfile?.cookLanguage || 'Local'} Video URL (Optional)`}
                    value={item.bengaliVideoUrl || ''}
                    onChange={(e) => updateItem(mealType, item.id, 'bengaliVideoUrl', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${item.prepared ? 'bg-green-100/50 border-green-200 text-green-900 opacity-70' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>
              <button
                onClick={() => removeItem(mealType, item.id)}
                className="self-end md:self-center text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                title="Remove Item"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meal Plan Manager</h1>
            <p className="text-gray-600 mt-1">Schedule meals for your cook</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Sync All Button */}
            <button
              onClick={handleSyncAllHistoricalData}
              disabled={syncing}
              className="flex items-center bg-white border border-gray-300 text-gray-700 px-3 py-2 font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Scan all historical meals and fetch missing videos/translations"
            >
              {syncing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
              ) : (
                <Sparkles size={18} className="mr-2" />
              )}
              Sync All
            </button>

            {/* Export CSV Button */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm">
              <button
                onClick={() => handleExport(exportDays)}
                disabled={exporting}
                className="flex items-center text-gray-700 px-3 py-2 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 border-r border-gray-300"
              >
                {exporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                ) : (
                  <Download size={18} className="mr-2" />
                )}
                Export
              </button>
              <select 
                className="bg-transparent text-gray-700 text-sm font-medium px-2 py-2 outline-none cursor-pointer"
                value={exportDays}
                onChange={(e) => setExportDays(Number(e.target.value))}
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>

            {/* CSV Upload Button */}
            <div className="relative">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                ) : (
                  <Upload size={18} className="mr-2" />
                )}
                Upload CSV
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 px-2 font-medium text-sm transition-colors relative ${
              activeTab === 'manual' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Manual Planner
            {activeTab === 'manual' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-600 rounded-t-md"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-2 font-medium text-sm transition-colors relative flex items-center ${
              activeTab === 'ai' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles size={16} className="mr-1.5" />
            AI Planner
            {activeTab === 'ai' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-md"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-3 px-2 font-medium text-sm transition-colors relative flex items-center ${
              activeTab === 'favorites' ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Heart size={16} className="mr-1.5" />
            Favorites
            {activeTab === 'favorites' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-t-md"></span>
            )}
          </button>
        </div>

        {activeTab === 'favorites' ? (
          <FavoritesView householdId={householdId} />
        ) : activeTab === 'ai' ? (
          <AIMealPlanner onApprove={handleAIApprove} startDate={selectedDate} householdId={householdId} />
        ) : (
          <>
            {/* Date Navigator */}
            <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-6 max-w-xs">
              <button
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center px-4 font-medium text-gray-700">
                <CalendarIcon size={18} className="mr-2 text-orange-500" />
                {format(selectedDate, 'MMM dd, yyyy')}
              </div>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* CSV Format Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex items-start">
              <FileText className="text-blue-500 mt-0.5 mr-3 shrink-0" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Bulk Upload via CSV</p>
                <p>You can upload a CSV file to schedule multiple days at once. Expected columns:</p>
                <code className="bg-blue-100 px-2 py-1 rounded mt-2 inline-block text-blue-900 font-mono text-xs">Date, Meal, Item Name, Bengali Name, Quantity, Bengali Quantity, Special Instruction, Bengali Instruction, Video URL, Bengali Video URL</code>
                <p className="mt-1 text-xs opacity-80">(Date format: YYYY-MM-DD. Meal: Lunch or Dinner)</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {renderMealSection('lunch', lunchItems)}
                {renderMealSection('dinner', dinnerItems)}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save size={20} className="mr-2" />
                    )}
                    Save Meal Plan
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
