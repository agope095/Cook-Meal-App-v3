import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc, deleteDoc, writeBatch, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format, addDays, subDays } from 'date-fns';
import { MealPlan, MealItem } from '../types';
import { Plus, Trash2, Calendar as CalendarIcon, Save, Youtube, ChevronLeft, ChevronRight, Upload, FileText, Download, Sparkles, Heart, CheckCircle2, MessageSquare, Clock, Search, Activity, Zap, PieChart, ShoppingCart, Loader2, X, Share2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { processMealItems, syncHistoricalData, syncNutritionForLibrary, SyncProgress, scaleNutrition } from '../services/recipeService';
import { detectServingAnomaly, AnomalyResult, getMacroBalance } from '../services/nutritionService';
import AIMealPlanner from './AIMealPlanner';
import FavoritesView from './FavoritesView';
import WeeklyView from './WeeklyView';
import MonthlyView from './MonthlyView';
import { AIMealDraft, generateGroceryList } from '../services/geminiService';
import { addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import DiscoveryView from './DiscoveryView';
import MealNutritionSummary from './MealNutritionSummary';
import { generateSecureId } from '../utils/crypto';

interface OwnerDashboardProps {
  householdId: string;
}

export default function OwnerDashboard({ householdId }: OwnerDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'favorites' | 'discover'>('manual');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('daily');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedMealForNutrition, setSelectedMealForNutrition] = useState<MealItem | null>(null);
  const [showGroceryModal, setShowGroceryModal] = useState(false);
  const [groceryList, setGroceryList] = useState<string[]>([]);
  const [isGeneratingGroceries, setIsGeneratingGroceries] = useState(false);
  const [syncingNutrition, setSyncingNutrition] = useState(false);
  const [nutritionSyncProgress, setNutritionSyncProgress] = useState<{ total: number, processed: number, updated: number } | null>(null);
  const [servingAnomaly, setServingAnomaly] = useState<AnomalyResult | null>(null);
  const [pendingSaveAfterAnomaly, setPendingSaveAfterAnomaly] = useState(false);

  const handleGenerateGroceries = async () => {
    const allMeals = [...breakfastItems, ...lunchItems, ...snacksItems, ...dinnerItems].filter(m => m.name.trim() !== '');
    if (allMeals.length === 0) {
      alert("Please add some meals to generate a grocery list.");
      return;
    }

    setIsGeneratingGroceries(true);
    try {
      const list = await generateGroceryList(allMeals.map(m => ({ 
        name: m.name, 
        quantity: m.quantity, 
        instruction: m.instruction 
      })));
      setGroceryList(list);
      setShowGroceryModal(true);
    } catch (error) {
      console.error("Grocery error:", error);
      alert("Failed to generate grocery list. Please try again.");
    } finally {
      setIsGeneratingGroceries(false);
    }
  };

  const handleSyncAllHistoricalData = async () => {
    if (!window.confirm("This will scan all your historical meal plans to find missing translations or videos. It may take a minute. Continue?")) return;
    
    setSyncing(true);
    setSyncProgress(null);
    try {
      await syncHistoricalData(householdId, userProfile, (progress) => {
        setSyncProgress(progress);
      });
      alert('Historical data sync complete!');
    } catch (error) {
      console.error("Error syncing historical data:", error);
      alert("Failed to sync historical data. Please check your connection.");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleSyncNutritionLibrary = async () => {
    if (!window.confirm("This will estimate nutritional values for all dishes in your library using AI. It may take a minute. Continue?")) return;
    
    setSyncingNutrition(true);
    setNutritionSyncProgress(null);
    try {
      await syncNutritionForLibrary(householdId, (progress) => {
        setNutritionSyncProgress(progress);
      });
      alert('Nutrition library sync complete!');
    } catch (error) {
      console.error("Error syncing nutrition:", error);
      alert("Failed to sync nutrition library.");
    } finally {
      setSyncingNutrition(false);
      setNutritionSyncProgress(null);
    }
  };

  // Form state
  const [breakfastItems, setBreakfastItems] = useState<MealItem[]>([]);
  const [lunchItems, setLunchItems] = useState<MealItem[]>([]);
  const [snacksItems, setSnacksItems] = useState<MealItem[]>([]);
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
        setBreakfastItems(data.breakfast || []);
        setLunchItems(data.lunch || []);
        setSnacksItems(data.snacks || []);
        setDinnerItems(data.dinner || []);
      } else {
        setMealPlan(null);
        setBreakfastItems([]);
        setLunchItems([]);
        setSnacksItems([]);
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

  // Global Key listeners for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedMealForNutrition) setSelectedMealForNutrition(null);
        if (showGroceryModal) setShowGroceryModal(false);
        if (activeTab !== 'manual') setActiveTab('manual');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMealForNutrition, showGroceryModal, activeTab]);

  // Fetch range data for Weekly/Monthly views
  const [rangeData, setRangeData] = useState<Record<string, MealPlan>>({});
  const fetchRange = async (start: Date, end: Date) => {
    if (!householdId) return;
    const q = query(
      collection(db, 'mealPlans'),
      where('ownerId', '==', householdId),
      where(documentId(), '>=', `${householdId}_${format(start, 'yyyy-MM-dd')}`),
      where(documentId(), '<=', `${householdId}_${format(end, 'yyyy-MM-dd')}`)
    );
    const snap = await getDocs(q);
    const data: Record<string, MealPlan> = {};
    snap.forEach(d => {
      const plan = d.data() as MealPlan;
      data[plan.date] = plan;
    });
    setRangeData(data);
  };

  useEffect(() => {
    if (viewMode === 'weekly') {
      const start = subDays(selectedDate, selectedDate.getDay());
      const end = addDays(start, 6);
      fetchRange(start, end);
    } else if (viewMode === 'monthly') {
      const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      fetchRange(start, end);
    }
  }, [viewMode, selectedDate, householdId]);

  const handleSave = async (skipAnomalyCheck = false) => {
    if (!auth.currentUser || !householdId) return;

    // Anomaly check before saving — only run once per save attempt
    if (!skipAnomalyCheck) {
      const householdSize = userProfile?.householdSize ?? 2;
      const allItems = [...breakfastItems, ...lunchItems, ...snacksItems, ...dinnerItems];
      const anomaly = detectServingAnomaly(allItems, householdSize);
      if (anomaly) {
        setServingAnomaly(anomaly);
        setPendingSaveAfterAnomaly(true);
        return; // Pause here — user must confirm or dismiss
      }
    }
    
    setSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${householdId}_${dateStr}`);

    try {
      if (breakfastItems.length === 0 && lunchItems.length === 0 && snacksItems.length === 0 && dinnerItems.length === 0) {
        await deleteDoc(docRef);
      } else {
        const plannedMeals = userProfile?.plannedMeals || ['lunch', 'dinner'];

        // Process only selected meals
        const processIfSelected = async (mealType: string, items: MealItem[]) => {
          if (plannedMeals.includes(mealType)) {
             return await processMealItems(householdId, items, userProfile);
          }
          return items;
        };

        const [processedBreakfast, processedLunch, processedSnacks, processedDinner] = await Promise.all([
          processIfSelected('breakfast', breakfastItems),
          processIfSelected('lunch', lunchItems),
          processIfSelected('snacks', snacksItems),
          processIfSelected('dinner', dinnerItems)
        ]);

        const updateData: any = {
          date: dateStr,
          ownerId: householdId
        };

        if (plannedMeals.includes('breakfast')) updateData.breakfast = processedBreakfast;
        if (plannedMeals.includes('lunch')) updateData.lunch = processedLunch;
        if (plannedMeals.includes('snacks')) updateData.snacks = processedSnacks;
        if (plannedMeals.includes('dinner')) updateData.dinner = processedDinner;

        await setDoc(docRef, updateData, { merge: true });
        
        // Update local state with the processed items so we don't re-translate next save
        setBreakfastItems(processedBreakfast);
        setLunchItems(processedLunch);
        setSnacksItems(processedSnacks);
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
      
      const convertToMealItems = (items: any[] | undefined): MealItem[] => {
        if (!items) return [];
        return items.map(item => ({
          id: generateSecureId(),
          name: item.name,
          quantity: item.quantity,
          instruction: item.instruction,
          bengaliName: item.nameBn || '',
          bengaliQuantity: item.quantityBn || '',
          bengaliInstruction: item.instructionBn || '',
          videoUrl: '',
          bengaliVideoUrl: '',
          nutrition: item.nutrition
        }));
      };

      const plannedMeals = userProfile?.plannedMeals || ['lunch', 'dinner'];
      
      const updates: any = { date: dateStr, ownerId: householdId };
      
      const processDraftMeal = async (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner') => {
        if (plannedMeals.includes(mealType) && draft[mealType]) {
          const draftItems = convertToMealItems(draft[mealType]);
          updates[mealType] = await processMealItems(householdId, draftItems, userProfile);
        }
      };

      await Promise.all([
        processDraftMeal('breakfast'),
        processDraftMeal('lunch'),
        processDraftMeal('snacks'),
        processDraftMeal('dinner')
      ]);
      
      // Get existing to prevent overwriting un-planned meals
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
         batch.set(docRef, { ...existingSnap.data(), ...updates }, { merge: true });
      } else {
         batch.set(docRef, updates, { merge: true });
      }
    }
    
    await batch.commit();
    setActiveTab('manual');
  };

  useEffect(() => {
    const handleAIAddMealToPlan = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { date, meal, items } = customEvent.detail;
      if (!householdId || !date || !meal || !items || items.length === 0) return;

      const docRef = doc(db, 'mealPlans', `${householdId}_${date}`);
      try {
        const snap = await getDoc(docRef);
        let existingItems: MealItem[] = [];
        if (snap.exists()) {
          const data = snap.data() as MealPlan;
          existingItems = data[meal as 'breakfast'|'lunch'|'snacks'|'dinner'] || [];
        }

        const newItems = items.map((i: any) => ({
          id: generateSecureId(),
          name: i.name,
          quantity: i.quantity || '',
          bengaliQuantity: i.quantityBn || '',
          hindiQuantity: i.quantityBn || '', // Fallback depending on language setting
          instruction: i.instruction || '',
          bengaliInstruction: i.instructionBn || '',
          hindiInstruction: i.instructionBn || '',
          bengaliName: i.nameBn || '',
          hindiName: i.nameBn || '',
          nutrition: i.nutrition,
        }));

        const combinedItems = [...existingItems, ...newItems];
        const processed = await processMealItems(householdId, combinedItems, userProfile);

        await setDoc(docRef, {
          [meal]: processed,
          date: date,
          ownerId: householdId
        }, { merge: true });

        // Update local state if the currently viewed date matches the added date
        if (date === format(selectedDate, 'yyyy-MM-dd')) {
          if (meal === 'breakfast') setBreakfastItems(processed);
          else if (meal === 'lunch') setLunchItems(processed);
          else if (meal === 'snacks') setSnacksItems(processed);
          else if (meal === 'dinner') setDinnerItems(processed);
        }

        // Show a brief success toast or alert
        alert(`Successfully added ${items.length} item(s) to ${meal} on ${date}.`);

      } catch (err) {
        console.error("Error handling aiAddMealToPlan event:", err);
      }
    };

    window.addEventListener('aiAddMealToPlan', handleAIAddMealToPlan);
    return () => window.removeEventListener('aiAddMealToPlan', handleAIAddMealToPlan);
  }, [householdId, userProfile]);

  const handleAddFromDiscovery = (item: Partial<MealItem>) => {
    const newItem: MealItem = {
      id: generateSecureId(),
      name: item.name || '',
      quantity: '',
      instruction: '',
      bengaliName: item.bengaliName || '',
      videoUrl: item.videoUrl || '',
      bengaliVideoUrl: item.bengaliVideoUrl || ''
    };
    
    const plannedMeals = userProfile?.plannedMeals || ['lunch', 'dinner'];
    const defaultMeal = plannedMeals[0] || 'lunch';

    if (defaultMeal === 'breakfast') setBreakfastItems([...breakfastItems, newItem]);
    else if (defaultMeal === 'lunch') setLunchItems([...lunchItems, newItem]);
    else if (defaultMeal === 'snacks') setSnacksItems([...snacksItems, newItem]);
    else setDinnerItems([...dinnerItems, newItem]);

    setActiveTab('manual');
    alert(`Added ${item.name} to ${defaultMeal}!`);
  };

  const handleCopyWeek = async () => {
    if (!householdId || !rangeData) return;
    const start = subDays(selectedDate, selectedDate.getDay());
    const nextStart = addWeeks(start, 1);
    
    if (!window.confirm(`Copy this week's plan to the week of ${format(nextStart, 'MMM dd')}?`)) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < 7; i++) {
        const sourceDate = format(addDays(start, i), 'yyyy-MM-dd');
        const targetDate = format(addDays(nextStart, i), 'yyyy-MM-dd');
        const sourcePlan = rangeData[sourceDate];
        
        if (sourcePlan) {
          const docRef = doc(db, 'mealPlans', `${householdId}_${targetDate}`);
          batch.set(docRef, {
            ...sourcePlan,
            date: targetDate,
            // Strip out IDs to avoid conflicts if needed, but since they are unique per item, it's fine.
            // However, we should generate new IDs to treat them as fresh entries.
            breakfast: sourcePlan.breakfast?.map(item => ({ ...item, id: generateSecureId() })) || [],
            lunch: sourcePlan.lunch?.map(item => ({ ...item, id: generateSecureId() })) || [],
            snacks: sourcePlan.snacks?.map(item => ({ ...item, id: generateSecureId() })) || [],
            dinner: sourcePlan.dinner?.map(item => ({ ...item, id: generateSecureId() })) || []
          });
        }
      }
      await batch.commit();
      alert('Week copied successfully!');
      setSelectedDate(nextStart);
    } catch (e) {
      console.error("Copy week failed:", e);
      alert("Failed to copy week. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner') => {
    const newItem: MealItem = {
      id: generateSecureId(),
      name: '',
      quantity: '',
      bengaliQuantity: '',
      instruction: '',
      bengaliInstruction: '',
      videoUrl: '',
      bengaliName: '',
      bengaliVideoUrl: ''
    };
    
    if (mealType === 'breakfast') setBreakfastItems([...breakfastItems, newItem]);
    else if (mealType === 'lunch') setLunchItems([...lunchItems, newItem]);
    else if (mealType === 'snacks') setSnacksItems([...snacksItems, newItem]);
    else setDinnerItems([...dinnerItems, newItem]);
  };

  const updateItem = (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner', id: string, field: keyof MealItem, value: any) => {
    const items = mealType === 'breakfast' ? breakfastItems : mealType === 'lunch' ? lunchItems : mealType === 'snacks' ? snacksItems : dinnerItems;
    const updatedItems = items.map(item => {
      if (item.id === id) {
        let updated = { ...item, [field]: value };
        
        // Linear Scaling Logic: If quantity changes and we have base nutrition, scale locally
        if (field === 'quantity' && item.baseNutrition && item.baseQuantity) {
          const scaled = scaleNutrition(item, value);
          if (scaled.nutrition) {
            updated.nutrition = scaled.nutrition;
          }
        }

        // If name changes, clear both translations so they get re-fetched
        if (field === 'name') {
          updated.bengaliName = undefined;
          updated.bengaliVideoUrl = undefined;
          updated.hindiName = undefined;
          updated.hindiVideoUrl = undefined;
          updated.videoUrl = undefined;
        }
        // If videoUrl changes manually, clear the language-specific video urls so they can be re-evaluated
        if (field === 'videoUrl') {
          updated.bengaliVideoUrl = undefined;
          updated.hindiVideoUrl = undefined;
        }
        return updated;
      }
      return item;
    });
    
    if (mealType === 'breakfast') setBreakfastItems(updatedItems);
    else if (mealType === 'lunch') setLunchItems(updatedItems);
    else if (mealType === 'snacks') setSnacksItems(updatedItems);
    else setDinnerItems(updatedItems);
  };

  const removeItem = (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner', id: string) => {
    if (mealType === 'breakfast') setBreakfastItems(breakfastItems.filter(item => item.id !== id));
    else if (mealType === 'lunch') setLunchItems(lunchItems.filter(item => item.id !== id));
    else if (mealType === 'snacks') setSnacksItems(snacksItems.filter(item => item.id !== id));
    else setDinnerItems(dinnerItems.filter(item => item.id !== id));
  };

  const handleManualTranslate = async (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner', item: MealItem) => {
    if (!item.name) return;
    
    // Set a temporary loading state for this specific item
    updateItem(mealType, item.id, 'bengaliName', 'Translating...');
    
    try {
      // Create a copy of the item with empty bengaliName so processMealItems knows it needs translation
      const itemToProcess = { ...item, bengaliName: '' };
      const processed = await processMealItems(householdId, [itemToProcess], userProfile);
      const result = processed[0];
      
      const items = mealType === 'breakfast' ? breakfastItems : mealType === 'lunch' ? lunchItems : mealType === 'snacks' ? snacksItems : dinnerItems;
      const updatedItems = items.map(i => i.id === item.id ? result : i);
      
      if (mealType === 'breakfast') setBreakfastItems(updatedItems);
      else if (mealType === 'lunch') setLunchItems(updatedItems);
      else if (mealType === 'snacks') setSnacksItems(updatedItems);
      else setDinnerItems(updatedItems);
    } catch (error) {
      console.error("Manual translation failed:", error);
      updateItem(mealType, item.id, 'bengaliName', ''); // Clear the loading text on error
      alert("Translation failed. Please try again or type manually.");
    }
  };

  const renderMealSection = (mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner', items: MealItem[]) => (
    <div className="bg-white/40 backdrop-blur-md p-4 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 mb-3 relative overflow-hidden group">
      {/* Background Accent */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-10 transition-colors ${mealType === 'lunch' ? 'bg-[var(--terracotta)]' : 'bg-[var(--sage)]'}`} />
      
      <div className="flex items-center justify-between mb-1.5 relative z-10">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xl font-[var(--font-display)] font-bold text-[var(--charcoal)] capitalize tracking-tight">{mealType}</h3>
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] opacity-60">
            {items.length} {items.length === 1 ? 'Dish' : 'Dishes'}
          </span>
        </div>
        <button
          onClick={() => addItem(mealType)}
          className="flex items-center text-[8px] font-black uppercase tracking-widest bg-white/80 hover:bg-white text-[var(--charcoal)] px-3 py-1.5 rounded-xl border border-[var(--cream-dark)] shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <Plus size={12} className="mr-1.5 text-[var(--terracotta)]" /> Add
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-[var(--cream)]/50 rounded-3xl py-10 text-center border-2 border-dashed border-[var(--cream-dark)]">
          <div className="w-12 h-12 bg-[var(--cream-dark)]/30 rounded-full flex items-center justify-center mx-auto mb-3 text-[var(--warm-gray)]">
             <Plus size={20} />
          </div>
          <p className="text-[var(--warm-gray)] font-bold text-xs">Empty plate. Add your first dish.</p>
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          {items.map((item) => (
            <motion.div 
              layout
              key={item.id} 
              className={`group/item relative flex flex-col p-3.5 rounded-[28px] border-2 transition-all ${
                item.isHero 
                  ? 'bg-white border-[var(--charcoal)] shadow-xl ring-4 ring-[var(--charcoal)]/5' 
                  : 'bg-white/80 border-transparent hover:border-[var(--cream-dark)] hover:shadow-lg'
              }`}
            >
              <button
                onClick={() => {
                  const updatedItems = items.map(i => ({
                    ...i,
                    isHero: i.id === item.id ? !i.isHero : false
                  }));
                  if (mealType === 'breakfast') setBreakfastItems(updatedItems);
                  else if (mealType === 'lunch') setLunchItems(updatedItems);
                  else if (mealType === 'snacks') setSnacksItems(updatedItems);
                  else setDinnerItems(updatedItems);
                }}
                className={`absolute -top-3 left-8 text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg transition-all ${
                  item.isHero ? 'bg-[var(--charcoal)] text-white' : 'bg-[var(--cream-dark)] text-[var(--warm-gray)] opacity-0 group-hover/item:opacity-100 hover:bg-[var(--terracotta)] hover:text-white'
                }`}
              >
                <Sparkles size={10} className={item.isHero ? 'text-[var(--terracotta)]' : ''} />
                {item.isHero ? 'Hero Dish' : 'Set as Hero'}
              </button>

              <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start gap-3">
                    {/* Dietary Selector */}
                    <button 
                      onClick={() => {
                        const next: any = item.dietaryType === 'veg' ? 'egg' : item.dietaryType === 'egg' ? 'non-veg' : 'veg';
                        updateItem(mealType, item.id, 'dietaryType', next);
                      }}
                      className={`shrink-0 w-5 h-5 rounded-md border-2 mt-1 flex items-center justify-center transition-colors ${
                        item.dietaryType === 'veg' ? 'border-green-500' : item.dietaryType === 'egg' ? 'border-yellow-500' : 'border-red-500'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        item.dietaryType === 'veg' ? 'bg-green-500' : item.dietaryType === 'egg' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="What's cooking?"
                          value={item.name}
                          onChange={(e) => updateItem(mealType, item.id, 'name', e.target.value)}
                          className={`flex-1 text-lg font-[var(--font-display)] font-bold bg-transparent placeholder:text-[var(--cream-dark)] focus:outline-none border-b-2 border-transparent hover:border-[var(--cream-dark)]/30 focus:border-[var(--terracotta)]/40 transition-all ${item.isHero ? 'text-[var(--charcoal)]' : 'text-[var(--charcoal-soft)]'}`}
                        />
                        <div className="flex items-center bg-[var(--cream)]/80 px-2 py-1 rounded-lg border border-[var(--cream-dark)]/30">
                          <input
                            type="text"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(mealType, item.id, 'quantity', e.target.value)}
                            className="bg-transparent text-[9px] font-black uppercase tracking-widest w-12 focus:outline-none text-[var(--charcoal)] text-center"
                          />
                        </div>
                      </div>
                      
                      {/* Nutritional Intelligence Layer */}
                      {item.nutrition ? (
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {userProfile?.viewPreference === 'power' ? (
                            <div className="flex items-center gap-3 bg-[var(--charcoal)]/5 px-3 py-1.5 rounded-xl border border-[var(--charcoal)]/10">
                              <div className="relative w-6 h-6 shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--terracotta)" strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - (item.nutrition.protein * 100 / (item.nutrition.protein + item.nutrition.carbs + item.nutrition.fat))} transform="rotate(-90 18 18)" />
                                </svg>
                                <Zap size={8} className="absolute inset-0 m-auto text-[var(--terracotta)]" />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--charcoal)] opacity-70">
                                {item.nutrition.kcal} kcal • {item.nutrition.protein}g Pro
                              </span>
                              <button 
                                onClick={() => setSelectedMealForNutrition(item)}
                                className="ml-1 p-1 hover:bg-white rounded-lg transition-colors"
                              >
                                <Activity size={10} className="text-[var(--terracotta)]" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setSelectedMealForNutrition(item)}
                              className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[var(--cream-dark)] shadow-sm hover:shadow-md transition-all group"
                            >
                              <div className="w-4 h-4 bg-[var(--terracotta)]/10 rounded-full flex items-center justify-center">
                                <Zap size={8} className="text-[var(--terracotta)]" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--charcoal)]">
                                {item.nutrition.kcal} kcal
                              </span>
                              <Activity size={10} className="text-[var(--terracotta)] opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={async () => {
                            try {
                              // Manual Zap: request nutrition for this specific dish
                              const { getBatchNutrition } = await import('../services/geminiService');
                              const results = await getBatchNutrition([{
                                id: item.id,
                                name: item.name,
                                quantity: item.quantity
                              }]);
                              
                              const found = results[0]?.nutrition || results[0]; // AI might return it nested or flat
                              
                              if (found && (found.kcal || found.protein)) {
                                updateItem(mealType, item.id, 'nutrition' as any, {
                                  kcal: Number(found.kcal) || 0,
                                  protein: Number(found.protein) || 0,
                                  carbs: Number(found.carbs) || 0,
                                  fat: Number(found.fat) || 0
                                });
                              } else {
                                alert("AI could not determine nutrition. Try being more specific with the dish name.");
                              }
                            } catch (e) {
                              console.error("Zap failed", e);
                            }
                          }}
                          className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] hover:text-[var(--terracotta)] mt-2 transition-all opacity-40 hover:opacity-100"
                        >
                          <Zap size={10} /> Calculate Nutrition
                        </button>
                      )}

                      <div className="flex items-center gap-3 mt-1.5">
                        {item.videoUrl && (
                          <div className="flex items-center text-[var(--terracotta)] bg-[var(--terracotta)]/5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--terracotta)]/10">
                            <Youtube size={10} className="mr-1" />
                            Recipe
                          </div>
                        )}
                        {item.note && (
                          <div className="flex items-center text-[var(--sage-deep)] bg-[var(--sage-muted)]/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            <MessageSquare size={10} className="mr-1 opacity-40" />
                            Cook Note
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeItem(mealType, item.id)}
                      className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-500 transition-all p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--cream-dark)]/20 space-y-2">
                    <input
                      type="text"
                      placeholder="Add instructions or notes..."
                      value={item.instruction || ''}
                      onChange={(e) => updateItem(mealType, item.id, 'instruction', e.target.value)}
                      className="w-full text-xs text-[var(--charcoal-soft)] bg-[var(--cream)]/60 px-3 py-2 rounded-xl placeholder:text-[var(--warm-gray)] focus:outline-none border border-[var(--cream-dark)]/40 hover:border-[var(--terracotta)]/20 focus:border-[var(--terracotta)]/40 transition-all shadow-sm"
                    />
                    <input
                      type="text"
                      placeholder="Paste YouTube Video URL (optional)"
                      value={item.videoUrl || ''}
                      onChange={(e) => updateItem(mealType, item.id, 'videoUrl', e.target.value)}
                      className="w-full text-xs text-[var(--charcoal-soft)] bg-[var(--cream)]/60 px-3 py-2 rounded-xl placeholder:text-[var(--warm-gray)] focus:outline-none border border-[var(--cream-dark)]/40 hover:border-[var(--terracotta)]/20 focus:border-[var(--terracotta)]/40 transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--cream)] pt-0 paper-grain">
      <div className="max-w-5xl mx-auto px-4">
        {/* Unified Intelligence Hub (Sticky) */}
        <div className="sticky top-0 z-30 mb-4 space-y-2.5">
          <div className="bg-white/70 backdrop-blur-2xl border border-white p-1 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] flex flex-col md:flex-row items-center justify-between gap-1">
            <div className="flex items-center gap-3 pl-3 py-1">
              <div className="w-12 h-12 bg-[var(--charcoal)] text-white rounded-[18px] flex items-center justify-center shadow-lg rotate-3">
                <CalendarIcon size={22} />
              </div>
              <div>
                <h1 className="text-xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight leading-none">Planner</h1>
                <p className="text-[10px] font-black text-[var(--warm-gray)] uppercase tracking-widest mt-1.5">
                  {viewMode === 'daily' && format(selectedDate, 'MMM dd, yyyy')}
                  {viewMode === 'weekly' && `Week ${format(selectedDate, 'w')}`}
                  {viewMode === 'monthly' && format(selectedDate, 'MMMM yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[var(--cream-dark)]/30 p-1.5 rounded-[24px] flex-wrap justify-center">
              {(['monthly', 'weekly', 'daily'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-[var(--charcoal)] shadow-md scale-105' 
                      : 'text-[var(--warm-gray)] hover:text-[var(--charcoal)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="hidden md:flex h-8 w-px bg-gray-100 mx-2" />

            <div className="flex items-center gap-2 pr-2 flex-wrap justify-center pb-2 md:pb-0">
              <div className="flex items-center bg-white border border-gray-100 rounded-2xl shadow-sm p-1">
                <button
                  onClick={() => {
                    if (viewMode === 'daily') setSelectedDate(subDays(selectedDate, 1));
                    if (viewMode === 'weekly') setSelectedDate(subWeeks(selectedDate, 1));
                    if (viewMode === 'monthly') setSelectedDate(subMonths(selectedDate, 1));
                  }}
                  className="p-1.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => {
                    if (viewMode === 'daily') setSelectedDate(addDays(selectedDate, 1));
                    if (viewMode === 'weekly') setSelectedDate(addWeeks(selectedDate, 1));
                    if (viewMode === 'monthly') setSelectedDate(addMonths(selectedDate, 1));
                  }}
                  className="p-1.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              
              <button
                onClick={() => setActiveTab('discover')}
                className="bg-white text-gray-400 p-2.5 rounded-2xl border border-gray-100 hover:text-gray-900 hover:border-gray-200 shadow-sm transition-all"
                title="Search History"
              >
                <Search size={18} />
              </button>
              
              <button
                onClick={handleGenerateGroceries}
                disabled={isGeneratingGroceries}
                className="bg-white text-[var(--charcoal)] p-2.5 px-6 rounded-2xl border border-[var(--cream-dark)] shadow-sm hover:shadow-md hover:border-[var(--terracotta)]/20 transition-all flex items-center gap-3 group relative overflow-hidden"
                title="Generate Grocery List"
              >
                {isGeneratingGroceries ? (
                  <Loader2 size={18} className="animate-spin text-[var(--terracotta)]" />
                ) : (
                  <ShoppingCart size={18} className="text-[var(--terracotta)] group-hover:scale-110 transition-transform" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Provisioning</span>
              </button>
              
              <button
                onClick={() => setActiveTab('ai')}
                className="bg-[var(--charcoal)] text-white p-2.5 px-6 rounded-2xl shadow-xl hover:shadow-[var(--terracotta)]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
                title="AI Assistant"
              >
                <Sparkles size={18} className="text-[var(--terracotta)] group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Plan with AI</span>
              </button>
            </div>
          </div>

          {viewMode === 'daily' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-2"
            >
              <div className="w-full sm:w-auto flex items-center bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-white gap-1">
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="flex items-center justify-center px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--terracotta)] hover:bg-[var(--terracotta)]/5 transition-colors border-r border-gray-100 mr-1"
                >
                  Today
                </button>
                {[...Array(5)].map((_, i) => {
                  const d = addDays(selectedDate, i - 2);
                  const isSelected = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(d)}
                      className={`flex-1 sm:flex-none flex flex-col items-center min-w-[55px] py-1.5 px-3 rounded-xl transition-all relative ${
                        isSelected 
                          ? 'bg-[var(--charcoal)] text-white shadow-lg scale-110 z-10' 
                          : 'text-[var(--warm-gray)] hover:text-[var(--charcoal)] hover:bg-[var(--cream)]'
                      }`}
                    >
                      <span className="text-[7px] uppercase font-black tracking-widest mb-0.5 opacity-60">
                        {format(d, 'EEE')}
                      </span>
                      <span className="text-sm font-black">
                        {format(d, 'dd')}
                      </span>
                      {isToday && !isSelected && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[var(--terracotta)] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={async () => {
                  const yesterday = subDays(selectedDate, 1);
                  const dateStr = format(yesterday, 'yyyy-MM-dd');
                  const snap = await getDoc(doc(db, 'mealPlans', `${householdId}_${dateStr}`));
                  if (snap.exists()) {
                    const data = snap.data() as MealPlan;
                    if (data.breakfast) setBreakfastItems(data.breakfast.map(i => ({ ...i, id: generateSecureId() })));
                    if (data.lunch) setLunchItems(data.lunch.map(i => ({ ...i, id: generateSecureId() })));
                    if (data.snacks) setSnacksItems(data.snacks.map(i => ({ ...i, id: generateSecureId() })));
                    if (data.dinner) setDinnerItems(data.dinner.map(i => ({ ...i, id: generateSecureId() })));
                  } else {
                    alert("No meal plan found for yesterday.");
                  }
                }}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] hover:text-[var(--charcoal)] transition-colors bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white shadow-sm"
              >
                <Plus size={14} />
                Repeat Yesterday
              </button>
            </motion.div>
          )}
        </div>




        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'daily' && (
              <div className="space-y-3 md:space-y-4">

                {loading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--charcoal)]"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {viewMode === 'daily' && (
                <MealNutritionSummary 
                  lunch={lunchItems} 
                  dinner={dinnerItems} 
                  householdSize={userProfile?.householdSize ?? 2}
                  appetiteMultiplier={userProfile?.appetiteMultiplier ?? 1.0}
                />
              )}

              {(userProfile?.plannedMeals || ['lunch', 'dinner']).includes('breakfast') && renderMealSection('breakfast', breakfastItems)}
              {(userProfile?.plannedMeals || ['lunch', 'dinner']).includes('lunch') && renderMealSection('lunch', lunchItems)}
              {(userProfile?.plannedMeals || ['lunch', 'dinner']).includes('snacks') && renderMealSection('snacks', snacksItems)}
              {(userProfile?.plannedMeals || ['lunch', 'dinner']).includes('dinner') && renderMealSection('dinner', dinnerItems)}

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="flex items-center bg-[var(--charcoal)] text-white px-10 py-4 rounded-[24px] font-black hover:bg-[var(--charcoal-soft)] transition-all disabled:opacity-50 shadow-xl active:scale-95 group"
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Save size={20} className="mr-2 group-hover:scale-110 transition-transform" />
                        )}
                        Confirm Daily Plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'weekly' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={handleCopyWeek}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--terracotta)] hover:text-[var(--terracotta-deep)] transition-colors bg-[var(--terracotta)]/5 px-4 py-2.5 rounded-xl border border-[var(--terracotta)]/10 shadow-sm"
                  >
                    <Save size={14} />
                    Copy to Next Week
                  </button>
                </div>
                <WeeklyView 
                  startDate={subDays(selectedDate, selectedDate.getDay())} 
                  data={rangeData} 
                  onDateSelect={(d) => {
                    setSelectedDate(d);
                    setViewMode('daily');
                  }} 
                />
              </div>
            )}

            {viewMode === 'monthly' && (
              <MonthlyView 
                currentDate={selectedDate} 
                data={rangeData} 
                onDateSelect={(d) => {
                  setSelectedDate(d);
                  setViewMode('daily');
                }} 
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Secondary Views (Modals or Full Screen overlays can be added here) */}
        <AnimatePresence>
          {activeTab === 'ai' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#F8F7F4]/95 backdrop-blur-xl p-8 overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-[var(--font-display)] font-bold text-[var(--charcoal)]">AI Meal Agent</h2>
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className="p-3 bg-[var(--cream-dark)] rounded-full hover:bg-[var(--cream-dark)]/80 transition-colors"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                <AIMealPlanner onApprove={handleAIApprove} startDate={selectedDate} householdId={householdId} currentMealPlan={mealPlan} />
              </div>
            </motion.div>
          )}
          
          {activeTab === 'discover' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#F8F7F4]/95 backdrop-blur-xl p-8 overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-3xl font-[var(--font-display)] font-bold text-[var(--charcoal)] uppercase tracking-tight">Kitchen Discovery</h2>
                    <p className="text-[var(--charcoal-soft)] opacity-60 font-medium text-sm mt-1">Pick from your previous dishes or popular choices.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className="p-3 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                <DiscoveryView householdId={householdId} onSelect={handleAddFromDiscovery} />
              </div>
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#F8F7F4]/95 backdrop-blur-xl p-8 overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-black text-gray-900">Your Favorites</h2>
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                <FavoritesView householdId={householdId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {selectedMealForNutrition && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMealForNutrition(null)}
              className="absolute inset-0 bg-[var(--charcoal)]/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white"
            >
              {/* Header */}
              <div className="bg-[var(--charcoal)] p-8 text-white relative">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--terracotta)]/20 to-transparent pointer-events-none" />
                <button 
                  onClick={() => setSelectedMealForNutrition(null)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Nutrition Atelier</h3>
                <h2 className="text-3xl font-[var(--font-display)] font-bold tracking-tight">{selectedMealForNutrition.name}</h2>
              </div>

              {/* Content */}
              <div className="p-8 space-y-8">
                {/* Macro Rings */}
                <div className="flex justify-around items-center">
                  {[
                    { label: 'Protein', value: selectedMealForNutrition.nutrition?.protein, color: 'var(--terracotta)', max: 50 },
                    { label: 'Carbs', value: selectedMealForNutrition.nutrition?.carbs, color: '#94a3b8', max: 100 },
                    { label: 'Fat', value: selectedMealForNutrition.nutrition?.fat, color: '#f59e0b', max: 50 }
                  ].map((macro) => (
                    <div key={macro.label} className="flex flex-col items-center gap-3">
                      <div className="relative w-16 h-16">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                          <circle 
                            cx="18" cy="18" r="16" fill="none" 
                            stroke={macro.color} strokeWidth="3" 
                            strokeDasharray="100" 
                            strokeDashoffset={100 - (Math.min(macro.value || 0, macro.max) * 100 / macro.max)} 
                            transform="rotate(-90 18 18)" 
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-bold text-[var(--charcoal)]">{macro.value}g</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)]">{macro.label}</span>
                    </div>
                  ))}
                </div>

                {/* Calorie Card */}
                <div className="bg-[var(--cream)] rounded-3xl p-6 flex items-center justify-between border border-[var(--cream-dark)]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <Zap className="text-[var(--terracotta)]" size={24} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-0.5">Energy Density</p>
                      <p className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)]">{selectedMealForNutrition.nutrition?.kcal} <span className="text-sm opacity-40">kcal</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-0.5">Recommendation</p>
                    {(() => {
                      const balance = getMacroBalance(
                        selectedMealForNutrition.nutrition?.kcal || 0,
                        selectedMealForNutrition.nutrition?.protein || 0,
                        selectedMealForNutrition.nutrition?.carbs || 0,
                        selectedMealForNutrition.nutrition?.fat || 0
                      );
                      return (
                        <p className="text-xs font-bold" style={{ color: balance.color }}>
                          {balance.score}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedMealForNutrition(null)}
                  className="w-full py-4 bg-[var(--charcoal)] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-[var(--charcoal)]/20 transition-all active:scale-95"
                >
                  Return to Planner
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Serving Anomaly Nudge — Soft, non-blocking confirmation */}
      <AnimatePresence>
        {servingAnomaly && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setServingAnomaly(null); setPendingSaveAfterAnomaly(false); }}
              className="absolute inset-0 bg-[var(--charcoal)]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative bg-[var(--cream)] rounded-[32px] shadow-2xl border border-white p-6 max-w-sm w-full"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--terracotta)]/10 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-[var(--terracotta)]" />
                </div>
                <div>
                  <h3 className="text-sm font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-1">Serving Check</h3>
                  <p className="text-[11px] text-[var(--warm-gray)] leading-relaxed">{servingAnomaly.message}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    // User confirms the implied serving count — update items
                    const updateServings = (items: MealItem[]) =>
                      items.map(item => item.nutrition?.servings != null
                        ? { ...item, nutrition: { ...item.nutrition, servings: servingAnomaly.impliedServings } }
                        : item
                      );
                    setBreakfastItems(updateServings(breakfastItems));
                    setLunchItems(updateServings(lunchItems));
                    setSnacksItems(updateServings(snacksItems));
                    setDinnerItems(updateServings(dinnerItems));
                    setServingAnomaly(null);
                    setPendingSaveAfterAnomaly(false);
                    handleSave(true);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest bg-[var(--charcoal)] text-white py-3 rounded-2xl hover:bg-[var(--charcoal-soft)] transition-all active:scale-95"
                >
                  Yes, {servingAnomaly.impliedServings} people
                </button>
                <button
                  onClick={() => {
                    setServingAnomaly(null);
                    setPendingSaveAfterAnomaly(false);
                    handleSave(true);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest bg-white text-[var(--charcoal)] py-3 rounded-2xl border border-[var(--cream-dark)] hover:shadow-md transition-all active:scale-95"
                >
                  No, {servingAnomaly.householdSize} people
                </button>
              </div>
              <button
                onClick={() => { setServingAnomaly(null); setPendingSaveAfterAnomaly(false); }}
                className="w-full mt-2 text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] opacity-60 hover:opacity-100 py-1 transition-all"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroceryModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroceryModal(false)}
              className="absolute inset-0 bg-[var(--charcoal)]/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-[var(--charcoal)] p-8 text-white relative shrink-0">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--terracotta)]/20 to-transparent pointer-events-none" />
                <button 
                  onClick={() => setShowGroceryModal(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                    <ShoppingCart size={20} className="text-[var(--terracotta)]" />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Provisioning</h3>
                    <h2 className="text-2xl font-[var(--font-display)] font-bold tracking-tight">Grocery Draft</h2>
                  </div>
                </div>
              </div>

              {/* List Area */}
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  {groceryList.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      layout
                      className="group flex items-center justify-between p-4 bg-[var(--cream)]/30 rounded-2xl border border-[var(--cream-dark)]/50 hover:border-[var(--terracotta)]/20 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-5 h-5 rounded-md border-2 border-[var(--cream-dark)] flex items-center justify-center group-hover:border-[var(--terracotta)]/40 transition-colors">
                          <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[var(--terracotta)]/20" />
                        </div>
                        <span className="text-sm font-bold text-[var(--charcoal)]">{item}</span>
                      </div>
                      <button 
                        onClick={() => setGroceryList(prev => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover:opacity-100 p-2 text-[var(--warm-gray)] hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                  {groceryList.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-[var(--warm-gray)] font-bold text-sm italic">Your list is clear. Ready to shop!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-8 bg-[var(--cream)]/30 border-t border-[var(--cream-dark)]/50 flex gap-4 shrink-0">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-4 bg-white text-[var(--charcoal)] border border-[var(--cream-dark)] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3"
                >
                  <Share2 size={16} className="text-[var(--terracotta)]" />
                  Print / Share
                </button>
                <button 
                  onClick={() => setShowGroceryModal(false)}
                  className="flex-1 py-4 bg-[var(--charcoal)] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-[var(--charcoal)]/20 transition-all"
                >
                  Confirm List
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nutrition Sync Progress Overlay */}
      {syncingNutrition && (
        <div className="fixed inset-0 bg-[var(--charcoal)]/40 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl text-center"
          >
            <div className="w-20 h-20 bg-[var(--terracotta)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <PieChart size={32} className="text-[var(--terracotta)] animate-pulse" />
            </div>
            <h3 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-2">Analyzing Nutrition</h3>
            <p className="text-sm text-[var(--charcoal-soft)] mb-8">AI is estimating values for your recipe library...</p>
            
            {nutritionSyncProgress && (
              <div className="space-y-4">
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[var(--terracotta)]"
                    style={{ width: `${(nutritionSyncProgress.processed / nutritionSyncProgress.total) * 100}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)]">
                  <span>{nutritionSyncProgress.processed} / {nutritionSyncProgress.total} Items</span>
                  <span>{nutritionSyncProgress.updated} Updated</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
