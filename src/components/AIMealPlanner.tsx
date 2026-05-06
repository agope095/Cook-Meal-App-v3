import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Sparkles, Send, Check, Loader2, Trash2, Edit2, Heart } from 'lucide-react';
import { generateMealPlanDraft, AIMealDraft } from '../services/geminiService';
import { getPastMeals, getFavorites, addFavorite } from '../services/historyService';
import { auth } from '../firebase';
import { MealItem } from '../types';

interface AIMealPlannerProps {
  onApprove: (drafts: AIMealDraft[]) => Promise<void>;
  startDate: Date;
  householdId: string;
}

export default function AIMealPlanner({ onApprove, startDate, householdId }: AIMealPlannerProps) {
  const [prompt, setPrompt] = useState('');
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [drafts, setDrafts] = useState<AIMealDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string, city?: string, society?: string, cookLanguage?: 'Bengali' | 'Hindi' }>({});
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
            cookLanguage: data.cookLanguage || 'Bengali'
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
      const newDrafts = await generateMealPlanDraft(prompt, startDateStr, userProfile, undefined, pastMeals, favorites);
      
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


  const updateItem = (dateIndex: number, mealType: 'lunch' | 'dinner', itemIndex: number, field: keyof AIMealItem, value: string) => {
    const newDrafts = [...(drafts || [])];
    if (!newDrafts[dateIndex]) return;
    (newDrafts[dateIndex][mealType][itemIndex] as any)[field] = value;
    setDrafts(newDrafts);
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
            <Sparkles size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">AI Meal Planner</h2>
          <p className="text-gray-600 mt-2">Describe what you want to eat, and let AI plan it for you.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Plan meal plan for next 2 days veg. Add tea in lunch mandatorily. Use the spinach in my fridge."
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] resize-y"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-4 w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Generating Plan...
              </>
            ) : (
              <>
                <Sparkles className="mr-2" size={20} />
                Generate Meal Plan
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Sparkles className="text-indigo-600 mr-2" size={24} />
              Review Draft Plan
            </h2>
            <p className="text-gray-600 mt-1">Add quantities, tweak instructions, or ask AI to change it.</p>
          </div>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex items-center py-2 px-6 border border-transparent rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isApproving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Processing & Saving...
              </>
            ) : (
              <>
                <Check className="mr-2" size={20} />
                Approve & Save to Calendar
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div className="space-y-8">
          {drafts.map((day, dayIndex) => (
            <div key={day.date} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">
                  {format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}
                </h3>
              </div>
              
              <div className="p-4 space-y-6">
                {/* Lunch */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-orange-400 mr-2"></span>
                    Lunch
                  </h4>
                  {day.lunch.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No items planned.</p>
                  ) : (
                    <div className="space-y-3">
                      {day.lunch.map((item, itemIndex) => (
                        <div key={itemIndex} className="bg-white border border-gray-100 p-4 rounded-lg shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <div className="font-medium text-gray-800 min-w-[150px] flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="font-bold">{item.name}</span>
                                {item.nameBn && <span className="text-sm text-indigo-600 font-local-script">{item.nameBn}</span>}
                              </div>
                              <button onClick={() => handleAddFavorite(item.name)} className="text-gray-400 hover:text-red-500 transition-colors ml-2" title="Add to Favorites">
                                <Heart size={16} />
                              </button>
                            </div>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Quantity (e.g., 2 cups)"
                                value={item.quantity}
                                onChange={(e) => updateItem(dayIndex, 'lunch', itemIndex, 'quantity', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {item.quantityBn && (
                                <input
                                  type="text"
                                  value={item.quantityBn}
                                  onChange={(e) => updateItem(dayIndex, 'lunch', itemIndex, 'quantityBn', e.target.value)}
                                  className="w-full px-3 py-1 text-xs border border-indigo-100 rounded bg-indigo-50/30 text-indigo-700 font-medium"
                                  placeholder={`${userProfile.cookLanguage || 'Bengali'} quantity`}
                                />
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Special Instructions"
                                value={item.instruction}
                                onChange={(e) => updateItem(dayIndex, 'lunch', itemIndex, 'instruction', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {item.instructionBn && (
                                <input
                                  type="text"
                                  value={item.instructionBn}
                                  onChange={(e) => updateItem(dayIndex, 'lunch', itemIndex, 'instructionBn', e.target.value)}
                                  className="w-full px-3 py-1 text-xs border border-indigo-100 rounded bg-indigo-50/30 text-indigo-700 font-medium"
                                  placeholder={`${userProfile.cookLanguage || 'Bengali'} instruction`}
                                />
                              )}

                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dinner */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
                    Dinner
                  </h4>
                  {day.dinner.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No items planned.</p>
                  ) : (
                    <div className="space-y-3">
                      {day.dinner.map((item, itemIndex) => (
                        <div key={itemIndex} className="bg-white border border-gray-100 p-4 rounded-lg shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <div className="font-medium text-gray-800 min-w-[150px] flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="font-bold">{item.name}</span>
                                {item.nameBn && <span className="text-sm text-indigo-600 font-local-script">{item.nameBn}</span>}
                              </div>
                              <button onClick={() => handleAddFavorite(item.name)} className="text-gray-400 hover:text-red-500 transition-colors ml-2" title="Add to Favorites">
                                <Heart size={16} />
                              </button>
                            </div>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Quantity (e.g., 2 cups)"
                                value={item.quantity}
                                onChange={(e) => updateItem(dayIndex, 'dinner', itemIndex, 'quantity', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {item.quantityBn && (
                                <input
                                  type="text"
                                  value={item.quantityBn}
                                  onChange={(e) => updateItem(dayIndex, 'dinner', itemIndex, 'quantityBn', e.target.value)}
                                  className="w-full px-3 py-1 text-xs border border-indigo-100 rounded bg-indigo-50/30 text-indigo-700 font-medium"
                                  placeholder={`${userProfile.cookLanguage || 'Bengali'} quantity`}
                                />
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Special Instructions"
                                value={item.instruction}
                                onChange={(e) => updateItem(dayIndex, 'dinner', itemIndex, 'instruction', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {item.instructionBn && (
                                <input
                                  type="text"
                                  value={item.instructionBn}
                                  onChange={(e) => updateItem(dayIndex, 'dinner', itemIndex, 'instructionBn', e.target.value)}
                                  className="w-full px-3 py-1 text-xs border border-indigo-100 rounded bg-indigo-50/30 text-indigo-700 font-medium"
                                  placeholder={`${userProfile.cookLanguage || 'Bengali'} instruction`}
                                />
                              )}

                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tweak Box */}
      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center">
          <Edit2 size={18} className="mr-2" />
          Tweak this plan
        </h3>
        <p className="text-sm text-indigo-700 mb-4">Don't like something? Ask AI to change it.</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={tweakPrompt}
            onChange={(e) => setTweakPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTweak()}
            placeholder="e.g., Swap tomorrow's dinner for something lighter like Khichdi"
            className="flex-1 px-4 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleTweak}
            disabled={isGenerating || !tweakPrompt.trim()}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
