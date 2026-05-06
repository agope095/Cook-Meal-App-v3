import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { MealPlan } from '../types';
import { Clock, Utensils, Youtube, Sun, Moon, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Languages, CheckCircle2, Circle, MessageSquare, Save } from 'lucide-react';

const getYouTubeId = (url: string) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
};

interface CookViewProps {
  ownerId: string;
}

export default function CookView({ ownerId }: CookViewProps) {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerLanguage, setOwnerLanguage] = useState<'Bengali' | 'Hindi'>('Bengali');
  
  // State for the currently viewed date
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // State for the current real time
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Determine default meal based on time (before 2 PM = lunch, after 2 PM = dinner)
  const isDefaultLunch = currentTime.getHours() < 14;
  const [selectedMeal, setSelectedMeal] = useState<'lunch' | 'dinner'>(isDefaultLunch ? 'lunch' : 'dinner');

  // Language state (persisted)
  const [language, setLanguage] = useState<'en' | 'local'>(() => {
    return (localStorage.getItem('souschef_cook_language') as 'en' | 'local') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('souschef_cook_language', language);
  }, [language]);

  // Fetch owner profile for language preference
  useEffect(() => {
    const fetchOwner = async () => {
      const docSnap = await getDoc(doc(db, 'owners', ownerId));
      if (docSnap.exists()) {
        setOwnerLanguage(docSnap.data().cookLanguage || 'Bengali');
      }
    };
    fetchOwner();
  }, [ownerId]);

  // Update real time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // When selectedDate changes, if it's today, apply the time rule. Otherwise default to lunch.
  useEffect(() => {
    if (isSameDay(selectedDate, new Date())) {
      setSelectedMeal(new Date().getHours() < 14 ? 'lunch' : 'dinner');
    } else {
      setSelectedMeal('lunch');
    }
  }, [selectedDate]);

  // Fetch meal plan for the selected date
  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${ownerId}_${dateStr}`);

    setLoading(true);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setMealPlan(docSnap.data() as MealPlan);
      } else {
        setMealPlan(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching meal plan:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, ownerId]);

  const getPhoneticNumber = (val: string, lang: 'Bengali' | 'Hindi') => {
    if (!val) return '';
    
    const map: Record<string, { bn: string, hi: string }> = {
      '1': { bn: 'Ek', hi: 'Ek' },
      '2': { bn: 'Dui', hi: 'Do' },
      '3': { bn: 'Tin', hi: 'Teen' },
      '4': { bn: 'Char', hi: 'Chaar' },
      '5': { bn: 'Paanch', hi: 'Paanch' },
      '6': { bn: 'Chhoy', hi: 'Chhay' },
      '7': { bn: 'Saat', hi: 'Saat' },
      '8': { bn: 'Aat', hi: 'Aath' },
      '9': { bn: 'Noy', hi: 'Nau' },
      '10': { bn: 'Dosh', hi: 'Das' },
      '11': { bn: 'Egaro', hi: 'Gyarah' },
      '12': { bn: 'Baro', hi: 'Baarah' },
      '15': { bn: 'Ponero', hi: 'Pandrah' },
      '20': { bn: 'Kuri', hi: 'Bees' },
      '25': { bn: 'Pochish', hi: 'Pachees' },
      '50': { bn: 'Ponchaash', hi: 'Pachaas' },
      '100': { bn: 'Eksho', hi: 'Sau' },
      '1/2': { bn: 'Adha', hi: 'Aadha' },
      '0.5': { bn: 'Adha', hi: 'Aadha' },
      'kg': { bn: 'Kilo', hi: 'Kilo' },
      'g': { bn: 'Gram', hi: 'Gram' },
      'gm': { bn: 'Gram', hi: 'Gram' },
      'gms': { bn: 'Gram', hi: 'Gram' },
      'cup': { bn: 'Kapp', hi: 'Cup' },
      'tsp': { bn: 'Chamoch', hi: 'Chammach' },
      'tbsp': { bn: 'Chamoch', hi: 'Chammach' }
    };

    // Split by space and also handle cases like "12kg"
    return val.split(/\s+/).map(word => {
      const lowerWord = word.toLowerCase();
      
      // Direct map hit
      if (map[lowerWord]) {
        return lang === 'Bengali' ? map[lowerWord].bn : map[lowerWord].hi;
      }
      
      // Handle "12kg" or "500gm"
      const match = word.match(/^(\d+|\d+\.\d+|\d+\/\d+)([a-zA-Z]+)$/);
      if (match) {
        const num = match[1];
        const unit = match[2].toLowerCase();
        const phoneticNum = map[num] ? (lang === 'Bengali' ? map[num].bn : map[num].hi) : num;
        const phoneticUnit = map[unit] ? (lang === 'Bengali' ? map[unit].bn : map[unit].hi) : unit;
        return `${phoneticNum} ${phoneticUnit}`;
      }
      
      return word;
    }).join(' ');
  };

  const currentItems = mealPlan ? (selectedMeal === 'lunch' ? mealPlan.lunch : mealPlan.dinner) : [];
  const isViewingToday = isSameDay(selectedDate, new Date());
  const isLocal = language === 'local';
  const localLabel = ownerLanguage === 'Hindi' ? 'HI' : 'বাং';
  const localName = ownerLanguage || 'Local';
  
  const translations = {
    dailyMenu: isLocal ? (ownerLanguage === 'Hindi' ? 'दैनिक मेनू' : 'দৈনিক মেনু') : 'Daily Menu',
    today: isLocal ? (ownerLanguage === 'Hindi' ? 'आज' : 'আজ') : 'Today',
    lunch: isLocal ? (ownerLanguage === 'Hindi' ? 'दोपहर का भोजन' : 'দুপুরের খাবার') : 'Lunch',
    dinner: isLocal ? (ownerLanguage === 'Hindi' ? 'रात का खाना' : 'রাতের খাবার') : 'Dinner',
    plan: isLocal ? (ownerLanguage === 'Hindi' ? 'योजना' : 'মেনু') : 'Plan',
    currentMeal: isLocal ? (ownerLanguage === 'Hindi' ? 'वर्तमान भोजन' : 'বর্তমান খাবার') : 'Current Meal',
    quantity: isLocal ? (ownerLanguage === 'Hindi' ? 'मात्रा' : 'পরিমাণ') : 'Quantity',
    instruction: isLocal ? (ownerLanguage === 'Hindi' ? 'विशेष निर्देश' : 'বিশেষ নির্দেশনা') : 'Special Instruction',
    watchRecipe: isLocal ? (ownerLanguage === 'Hindi' ? 'रेसिपी देखें' : 'রেসিপি দেখুন') : 'Watch Recipe',
    noItems: isLocal ? (ownerLanguage === 'Hindi' ? 'कोई भोजन निर्धारित नहीं' : 'কোন খাবার নির্ধারিত নেই') : 'No items scheduled for',
    checkBack: isLocal ? (ownerLanguage === 'Hindi' ? 'बाद में जांचें या मालिक से संपर्क करें।' : 'পরে আবার চেক করুন বা মালিকের সাথে যোগাযোগ করুন।') : 'Check back later or contact the owner.',
    on: isLocal ? (ownerLanguage === 'Hindi' ? 'को' : 'তারিখে') : 'on',
    prepared: isLocal ? (ownerLanguage === 'Hindi' ? 'तैयार' : 'প্রস্তুত') : 'Prepared',
    addNote: isLocal ? (ownerLanguage === 'Hindi' ? 'नोट जोड़ें' : 'নোট লিখুন') : 'Add Note',
    saveNote: isLocal ? (ownerLanguage === 'Hindi' ? 'सुरक्षित करें' : 'সেভ করুন') : 'Save'
  };

  const handleTogglePrepared = async (itemId: string) => {
    if (!mealPlan) return;
    
    const updatedLunch = (mealPlan.lunch || []).map(item => 
      item.id === itemId ? { ...item, prepared: !item.prepared } : item
    );
    const updatedDinner = (mealPlan.dinner || []).map(item => 
      item.id === itemId ? { ...item, prepared: !item.prepared } : item
    );
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${ownerId}_${dateStr}`);
    await updateDoc(docRef, {
      lunch: updatedLunch,
      dinner: updatedDinner
    });
  };

  const handleSaveNote = async (itemId: string, note: string) => {
    if (!mealPlan) return;
    
    const updatedLunch = (mealPlan.lunch || []).map(item => 
      item.id === itemId ? { ...item, note } : item
    );
    const updatedDinner = (mealPlan.dinner || []).map(item => 
      item.id === itemId ? { ...item, note } : item
    );
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'mealPlans', `${ownerId}_${dateStr}`);
    await updateDoc(docRef, {
      lunch: updatedLunch,
      dinner: updatedDinner
    });
  };

  if (loading && !mealPlan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-orange-100">
        <div className="bg-orange-500 p-8 text-white text-center relative">
          <h1 className="text-3xl font-black mb-6 tracking-tight">{translations.dailyMenu}</h1>
          
          <div className="flex items-center justify-center bg-orange-600 rounded-2xl p-2 max-w-sm mx-auto shadow-inner border border-orange-400">
            <button
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-3 hover:bg-orange-700 rounded-xl transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 flex items-center justify-center font-bold text-lg">
              <CalendarIcon size={20} className="mr-2 opacity-80" />
              {isViewingToday ? translations.today : format(selectedDate, 'MMM do, yyyy')}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-3 hover:bg-orange-700 rounded-xl transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => setSelectedMeal('lunch')}
              className={`flex-1 flex items-center justify-center py-4 rounded-xl font-bold transition-all ${
                selectedMeal === 'lunch' ? 'bg-white shadow-sm text-orange-600 scale-[1.02]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sun size={20} className="mr-2" />
              {translations.lunch}
            </button>
            <button
              onClick={() => setSelectedMeal('dinner')}
              className={`flex-1 flex items-center justify-center py-4 rounded-xl font-bold transition-all ${
                selectedMeal === 'dinner' ? 'bg-white shadow-sm text-orange-600 scale-[1.02]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Moon size={20} className="mr-2" />
              {translations.dinner}
            </button>
          </div>

          <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
            <h2 className="text-2xl font-black text-gray-800 flex items-center">
              <Utensils className="mr-3 text-orange-500" />
              {selectedMeal === 'lunch' ? translations.lunch : translations.dinner} {translations.plan}
            </h2>
            <div className="flex bg-gray-100 p-1 rounded-xl items-center border border-gray-200">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  language === 'en' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('local')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  language === 'local' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {localLabel}
              </button>
            </div>
          </div>

          {currentItems && currentItems.length > 0 ? (
            <ul className="space-y-6">
              {currentItems.map((item) => {
                const displayName = isLocal && item.bengaliName ? item.bengaliName : item.name;
                const displayQuantity = isLocal && item.bengaliQuantity ? item.bengaliQuantity : item.quantity;
                const displayInstruction = isLocal && item.bengaliInstruction ? item.bengaliInstruction : item.instruction;
                
                const originalVideoUrlStr = item.videoUrl?.trim() || '';
                const hasOriginalVideo = originalVideoUrlStr !== '' && originalVideoUrlStr.toLowerCase() !== 'na' && originalVideoUrlStr.toLowerCase() !== 'n/a';
                const displayVideoUrl = hasOriginalVideo ? (isLocal && item.bengaliVideoUrl ? item.bengaliVideoUrl : originalVideoUrlStr) : '';
                const isValidUrl = displayVideoUrl !== '';
                const isSearchUrl = displayVideoUrl.includes('youtube.com/results?search_query=');
                const ytId = isValidUrl && !isSearchUrl ? getYouTubeId(displayVideoUrl) : null;

                return (
                  <li key={item.id} className={`bg-white border rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all ${item.prepared ? 'border-green-200 bg-green-50/20' : 'border-gray-100'}`}>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleTogglePrepared(item.id)}
                            className={`shrink-0 transition-all ${item.prepared ? 'text-green-500 scale-110' : 'text-gray-300 hover:text-gray-400'}`}
                          >
                            {item.prepared ? <CheckCircle2 size={28} weight="fill" /> : <Circle size={28} />}
                          </button>
                          <h3 className={`text-xl font-black leading-tight transition-all ${item.prepared ? 'text-green-800 line-through opacity-60' : 'text-gray-800'}`}>
                            {displayName}
                          </h3>
                        </div>

                        {/* Right-aligned Prominent Quantity Badge */}
                        {displayQuantity && (
                          <div className={`shrink-0 flex flex-col items-end gap-1 transition-all ${item.prepared ? 'opacity-60' : ''}`}>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              item.prepared ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                            }`}>
                              {translations.quantity}
                            </span>
                            <span className={`text-xl font-black tracking-tighter ${
                              item.prepared ? 'text-green-800' : 'text-orange-700'
                            }`}>
                              {isLocal ? getPhoneticNumber(displayQuantity, ownerLanguage) : displayQuantity}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {displayInstruction && (
                        <div className={`mt-4 p-4 border rounded-2xl text-sm leading-relaxed ${item.prepared ? 'bg-green-100/30 border-green-100 text-green-800 opacity-60' : 'bg-yellow-50/50 border-yellow-100 text-yellow-900'}`}>
                          <span className={`font-black block mb-2 text-xs uppercase tracking-widest ${item.prepared ? 'text-green-700' : 'text-yellow-700'}`}>{translations.instruction}</span>
                          <p className="font-medium">{displayInstruction}</p>
                        </div>
                      )}

                      {/* Cook Note Section */}
                      <div className="mt-6 border-t border-gray-50 pt-6">
                        {item.note ? (
                          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                            <MessageSquare size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-bold text-blue-900">{item.note}</p>
                              <button 
                                onClick={() => handleSaveNote(item.id, '')}
                                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-600 mt-2"
                              >
                                Edit Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                            <input 
                              type="text"
                              placeholder={translations.addNote}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveNote(item.id, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                              className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-blue-400 focus:bg-white outline-none transition-all text-sm font-bold"
                            />
                            <button 
                              onClick={(e) => {
                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                if (input.value) {
                                  handleSaveNote(item.id, input.value);
                                  input.value = '';
                                }
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-600"
                            >
                              <Save size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isValidUrl && (
                      <div className="flex items-center gap-4 mt-2">
                        {!isSearchUrl && (
                          <div className="w-24 h-16 shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                            <img 
                              src={ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : `https://picsum.photos/seed/${encodeURIComponent(item.name)}/200/120`} 
                              alt="Recipe" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <a
                          href={displayVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center py-4 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition-all text-sm gap-2"
                        >
                          <Youtube size={20} />
                          {isSearchUrl ? (isLocal ? (ownerLanguage === 'Hindi' ? 'रेसिपी खोजें' : 'রেসিপি খুঁজুন') : 'Search Recipe') : translations.watchRecipe}
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Utensils className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-600 font-bold text-xl px-6">{translations.noItems} {selectedMeal === 'lunch' ? translations.lunch : translations.dinner} {translations.on} {isViewingToday ? translations.today : format(selectedDate, 'MMM do')}.</p>
              <p className="text-gray-400 font-medium mt-2">{translations.checkBack}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
