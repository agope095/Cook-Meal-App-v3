import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Sparkles, Send, Check, Loader2, Trash2, Edit2, Heart } from 'lucide-react';
import { generateMealPlanDraft, AIMealDraft, AIMealItemDraft } from '../services/geminiService';
import { getPastMeals, getFavorites, addFavorite } from '../services/historyService';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { MealItem, MealPlan } from '../types';

interface AIMealPlannerProps {
  onApprove: (drafts: AIMealDraft[]) => Promise<void>;
  startDate: Date;
  householdId: string;
  currentMealPlan?: MealPlan | null;
}

export default function AIMealPlanner({ onApprove, startDate, householdId, currentMealPlan }: AIMealPlannerProps) {
  const [prompt, setPrompt] = useState('');
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [drafts, setDrafts] = useState<AIMealDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string, city?: string, society?: string, cookLanguage?: 'Bengali' | 'Hindi', plannedMeals?: string[] }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDoc(doc(db, 'owners', auth.currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({ 
            name: data.name, 
            city: data.city || 'Unknown', 
            society: data.society || 'Unknown',
            cookLanguage: data.cookLanguage || 'Bengali',
            plannedMeals: data.plannedMeals || ['lunch', 'dinner']
          });
        }
      } catch (e) {
        console.warn("Profile fetch failed", e);
      }
    };
    fetchProfile();
  }, []);

  const showMessage = (msg: string, isError: boolean = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const pastMeals = await getPastMeals(householdId, startDate, 30);
      const favorites = await getFavorites(householdId);

      // Convert currentMealPlan to Draft format so AI can see it
      let existingDraft: AIMealDraft[] | undefined = undefined;
      if (currentMealPlan) {
        existingDraft = [{
          date: startDateStr,
          breakfast: currentMealPlan.breakfast?.map(m => ({ name: m.name, quantity: m.quantity || '', instruction: m.instruction || '' })) || [],
          lunch: currentMealPlan.lunch?.map(m => ({ name: m.name, quantity: m.quantity || '', instruction: m.instruction || '' })) || [],
          snacks: currentMealPlan.snacks?.map(m => ({ name: m.name, quantity: m.quantity || '', instruction: m.instruction || '' })) || [],
          dinner: currentMealPlan.dinner?.map(m => ({ name: m.name, quantity: m.quantity || '', instruction: m.instruction || '' })) || []
        }];
      }

      const newDrafts = await generateMealPlanDraft(prompt, startDateStr, userProfile, existingDraft, pastMeals, favorites);
      
      if (Array.isArray(newDrafts) && newDrafts.length > 0) {
        setDrafts(newDrafts);
      } else {
        showMessage("AI couldn't generate a valid plan. Please try a different request.", true);
      }
    } catch (error: any) {
      console.error("Failed to generate plan:", error);
      showMessage(`Failed to generate meal plan: ${error.message || 'Please try again.'}`, true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTweak = async () => {
    if (!tweakPrompt.trim() || !drafts || drafts.length === 0) return;
    setIsGenerating(true);
    setError(null);
    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const pastMeals = await getPastMeals(householdId, startDate, 30);
      const favorites = await getFavorites(householdId);
      const updatedDrafts = await generateMealPlanDraft(tweakPrompt, startDateStr, userProfile, drafts, pastMeals, favorites);
      
      if (Array.isArray(updatedDrafts) && updatedDrafts.length > 0) {
        setDrafts(updatedDrafts);
        setTweakPrompt('');
      } else {
        showMessage("AI couldn't update the plan. Please try a different tweak.", true);
      }
    } catch (error: any) {
      console.error("Failed to tweak plan:", error);
      showMessage(`Failed to update meal plan: ${error.message || 'Please try again.'}`, true);
    } finally {
      setIsGenerating(false);
    }
  };


  const updateItem = (dateIndex: number, mealType: string, itemIndex: number, field: keyof AIMealItemDraft, value: string) => {
    const newDrafts = [...(drafts || [])];
    if (!newDrafts[dateIndex]) return;
    const mealArray = (newDrafts[dateIndex] as any)[mealType] as AIMealItemDraft[] | undefined;
    if (mealArray && mealArray[itemIndex]) {
      // create a shallow copy to prevent direct state mutation
      const updatedItem = { ...mealArray[itemIndex], [field]: value };
      const updatedMealArray = [...mealArray];
      updatedMealArray[itemIndex] = updatedItem;
      (newDrafts[dateIndex] as any)[mealType] = updatedMealArray;

      setDrafts(newDrafts);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      await onApprove(drafts || []);
      setDrafts([]);
      setPrompt('');
      showMessage('Meal plan approved and saved successfully!');
    } catch (error: any) {
      console.error("Failed to approve plan:", error);
      showMessage(`Failed to save meal plan: ${error.message || 'Please try again.'}`, true);
    } finally {
      setIsApproving(false);
    }
  };

  const handleAddFavorite = async (name: string) => {
    try {
      await addFavorite(householdId, name);
      showMessage(`Added ${name} to favorites!`);
    } catch (error) {
      showMessage(`Failed to add favorite: ${error}`, true);
    }
  };

  if (!drafts || drafts.length === 0) {
    return (
      <div className="bg-white/40 backdrop-blur-xl border-2 border-white rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-100/30 rounded-full blur-[100px] -ml-32 -mb-32" />

        <div className="relative text-center mb-12">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gray-900 text-white mb-6 shadow-2xl"
          >
            <Sparkles size={32} />
          </motion.div>
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-4">AI Meal Planner</h2>
          <p className="text-gray-500 font-medium max-w-md mx-auto">
            Describe your cravings, dietary needs, or what's in your fridge. Let our AI curate your perfect week.
          </p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-xs font-bold uppercase tracking-widest text-center">
            {error}
          </motion.div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="relative group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g., Plan 3 days of healthy veg meals. Include my favorite Dal Tadka once."
              className="w-full p-6 bg-white/60 border-2 border-white rounded-[32px] focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900 min-h-[160px] resize-none transition-all shadow-inner outline-none text-gray-900 font-medium"
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-focus-within:text-gray-400">Describe & Generate</span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full flex items-center justify-center py-5 px-8 rounded-[32px] bg-gray-900 text-white shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <span className="text-xs font-black uppercase tracking-[0.2em]">Craft My Meal Plan</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="bg-white/40 backdrop-blur-xl border-2 border-white rounded-[40px] p-6 md:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-900 text-white rounded-xl flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Draft Plan</h2>
            </div>
            <p className="text-gray-500 text-sm font-medium">Review and refine your curated selection.</p>
          </div>
          
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full md:w-auto flex items-center justify-center py-4 px-10 rounded-[24px] bg-gray-900 text-white shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {isApproving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <span className="text-xs font-black uppercase tracking-widest">Approve & Save</span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {drafts.map((day, dayIndex) => (
            <motion.div 
              key={day.date}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: dayIndex * 0.1 }}
              className="bg-white/60 border border-white rounded-[32px] overflow-hidden shadow-sm"
            >
              <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  {format(parseISO(day.date), 'EEEE, MMM dd')}
                </h3>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" title="Veg Available" />
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {((userProfile as any).plannedMeals || ['lunch', 'dinner']).map((mealType: string) => {
                  const items = (day as any)[mealType] || [];
                  return (
                  <div key={mealType} className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${mealType === 'lunch' ? 'bg-orange-400' : mealType === 'dinner' ? 'bg-indigo-400' : 'bg-yellow-500'}`} />
                      {mealType}
                    </h4>
                    {items.length === 0 ? (
                      <div className="p-4 rounded-2xl border border-dashed border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Empty</div>
                    ) : (
                      <div className="space-y-4">
                        {items.map((item: AIMealItemDraft, itemIndex: number) => (
                          <div key={itemIndex} className="bg-white p-5 rounded-2xl border border-gray-50 shadow-sm space-y-4 hover:shadow-md transition-all group">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="font-black text-gray-900 tracking-tight">{item.name}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.nameBn && <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{item.nameBn}</span>}
                                    {item.nutrition && (
                                      <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                                        {item.nutrition.kcal} kcal
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button onClick={() => handleAddFavorite(item.name)} className="p-2 text-gray-200 hover:text-red-500 transition-colors">
                                  <Heart size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="text"
                                    placeholder="Quantity"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(dayIndex, mealType, itemIndex, 'quantity', e.target.value)}
                                    className="w-full px-3 py-2 text-[11px] font-bold border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 transition-all outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="text"
                                    placeholder="Special Instructions"
                                    value={item.instruction}
                                    onChange={(e) => updateItem(dayIndex, mealType, itemIndex, 'instruction', e.target.value)}
                                    className="w-full px-3 py-2 text-[11px] font-bold border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 transition-all outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Premium Tweak Box */}
      <div className="bg-gray-900 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3">
            <Edit2 size={20} className="text-indigo-400" />
            Tweak the Curation
          </h3>
          <p className="text-gray-400 text-sm font-medium mb-6">Want something lighter? More spicy? Just ask.</p>
          
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={tweakPrompt}
              onChange={(e) => setTweakPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTweak()}
              placeholder="e.g., Make Tuesday's dinner lighter, maybe some soup."
              className="flex-1 px-6 py-4 bg-white/10 border border-white/10 rounded-[24px] text-white font-medium focus:ring-2 focus:ring-white/20 transition-all outline-none placeholder:text-gray-500"
            />
            <button
              onClick={handleTweak}
              disabled={isGenerating || !tweakPrompt.trim()}
              className="flex items-center justify-center py-4 px-8 bg-white text-gray-900 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : 'Update Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
