import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { MealPlan } from '../types';
import { Clock, Utensils, Youtube, Sun, Moon, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Languages, CheckCircle2, Circle, MessageSquare, Save, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const isDefaultLunch = currentTime.getHours() < 14;
  const [selectedMeal, setSelectedMeal] = useState<'lunch' | 'dinner'>(isDefaultLunch ? 'lunch' : 'dinner');
  const [language, setLanguage] = useState<'en' | 'local'>(() => {
    return (localStorage.getItem('souschef_cook_language') as 'en' | 'local') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('souschef_cook_language', language);
  }, [language]);

  useEffect(() => {
    const fetchOwner = async () => {
      const docSnap = await getDoc(doc(db, 'owners', ownerId));
      if (docSnap.exists()) {
        setOwnerLanguage(docSnap.data().cookLanguage || 'Bengali');
      }
    };
    fetchOwner();
  }, [ownerId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSameDay(selectedDate, new Date())) {
      setSelectedMeal(new Date().getHours() < 14 ? 'lunch' : 'dinner');
    } else {
      setSelectedMeal('lunch');
    }
  }, [selectedDate]);

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

    return val.split(/\s+/).map(word => {
      const lowerWord = word.toLowerCase();
      if (map[lowerWord]) return lang === 'Bengali' ? map[lowerWord].bn : map[lowerWord].hi;
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
  
  const translations = {
    dailyMenu: isLocal ? (ownerLanguage === 'Hindi' ? 'दैनिक मेनू' : 'দৈনিক মেনু') : 'Daily Menu',
    today: isLocal ? (ownerLanguage === 'Hindi' ? 'आज' : 'আজ') : 'Today',
    lunch: isLocal ? (ownerLanguage === 'Hindi' ? 'दोपहर का भोजन' : 'দুপুরের খাবার') : 'Lunch',
    dinner: isLocal ? (ownerLanguage === 'Hindi' ? 'रात का खाना' : 'রাতের খাবার') : 'Dinner',
    plan: isLocal ? (ownerLanguage === 'Hindi' ? 'योजना' : 'মেনু') : 'Plan',
    quantity: isLocal ? (ownerLanguage === 'Hindi' ? 'मात्रा' : 'পরিমাণ') : 'Quantity',
    instruction: isLocal ? (ownerLanguage === 'Hindi' ? 'विशेष निर्देश' : 'বিশেষ নির্দেশনা') : 'Special Instruction',
    watchRecipe: isLocal ? (ownerLanguage === 'Hindi' ? 'रेसिपी देखें' : 'রেসিপি দেখুন') : 'Watch Recipe',
    noItems: isLocal ? (ownerLanguage === 'Hindi' ? 'कोई भोजन निर्धारित नहीं' : 'কোন খাবার নির্ধারিত নেই') : 'No items scheduled for',
    checkBack: isLocal ? (ownerLanguage === 'Hindi' ? 'बाद में जांचें या मालिक से संपर्क करें।' : 'পরে আবার চেক করুন বা মালিকের সাথে যোগাযোগ করুন।') : 'Check back later or contact the owner.',
    on: isLocal ? (ownerLanguage === 'Hindi' ? 'को' : 'তারিখে') : 'on',
    addNote: isLocal ? (ownerLanguage === 'Hindi' ? 'नोट जोड़ें' : 'নোট লিখুন') : 'Add Note',
  };

  const handleTogglePrepared = async (itemId: string) => {
    if (!mealPlan) return;
    const updatedLunch = (mealPlan.lunch || []).map(item => item.id === itemId ? { ...item, prepared: !item.prepared } : item);
    const updatedDinner = (mealPlan.dinner || []).map(item => item.id === itemId ? { ...item, prepared: !item.prepared } : item);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await updateDoc(doc(db, 'mealPlans', `${ownerId}_${dateStr}`), { lunch: updatedLunch, dinner: updatedDinner });
  };

  const handleSaveNote = async (itemId: string, note: string) => {
    if (!mealPlan) return;
    const updatedLunch = (mealPlan.lunch || []).map(item => item.id === itemId ? { ...item, note } : item);
    const updatedDinner = (mealPlan.dinner || []).map(item => item.id === itemId ? { ...item, note } : item);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await updateDoc(doc(db, 'mealPlans', `${ownerId}_${dateStr}`), { lunch: updatedLunch, dinner: updatedDinner });
  };

  if (loading && !mealPlan) {
    return (
      <div className="flex items-center justify-center py-20 bg-[var(--cream)]/30">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-10 w-10 border-4 border-[var(--terracotta)] border-t-transparent rounded-full shadow-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 animate-fade-up">
      {/* Date Navigator */}
      <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--cream-dark)]">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-3 bg-[var(--cream)] rounded-2xl text-[var(--charcoal-soft)] hover:bg-[var(--cream-dark)] transition-colors shadow-inner focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] outline-none"
            aria-label="Previous day"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--terracotta)] opacity-60 mb-1">{translations.dailyMenu}</p>
            <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight">
              {isViewingToday ? translations.today : format(selectedDate, 'MMMM do')}
            </h2>
          </div>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-3 bg-[var(--cream)] rounded-2xl text-[var(--charcoal-soft)] hover:bg-[var(--cream-dark)] transition-colors shadow-inner focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] outline-none"
            aria-label="Next day"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Meal & Language Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-2 rounded-[24px] shadow-sm border border-[var(--cream-dark)] flex">
          <button onClick={() => setSelectedMeal('lunch')} className={`flex-1 flex items-center justify-center py-3 rounded-2xl font-bold transition-all ${selectedMeal === 'lunch' ? 'bg-[var(--terracotta)] text-white shadow-lg' : 'text-[var(--charcoal-soft)] opacity-40 hover:opacity-100'}`}>
            <Sun size={18} className="mr-2" />
            <span className="text-sm uppercase tracking-widest">{translations.lunch}</span>
          </button>
          <button onClick={() => setSelectedMeal('dinner')} className={`flex-1 flex items-center justify-center py-3 rounded-2xl font-bold transition-all ${selectedMeal === 'dinner' ? 'bg-[var(--terracotta)] text-white shadow-lg' : 'text-[var(--charcoal-soft)] opacity-40 hover:opacity-100'}`}>
            <Moon size={18} className="mr-2" />
            <span className="text-sm uppercase tracking-widest">{translations.dinner}</span>
          </button>
        </div>

        <div className="bg-white p-2 rounded-[24px] shadow-sm border border-[var(--cream-dark)] flex">
          <button onClick={() => setLanguage('en')} className={`flex-1 flex items-center justify-center py-3 rounded-2xl font-black text-xs transition-all ${language === 'en' ? 'bg-[var(--charcoal)] text-white shadow-lg' : 'text-[var(--charcoal-soft)] opacity-40 hover:opacity-100'}`}>
            ENGLISH
          </button>
          <button onClick={() => setLanguage('local')} className={`flex-1 flex items-center justify-center py-3 rounded-2xl font-black text-xs transition-all ${language === 'local' ? 'bg-[var(--charcoal)] text-white shadow-lg' : 'text-[var(--charcoal-soft)] opacity-40 hover:opacity-100'}`}>
            {ownerLanguage === 'Hindi' ? 'HINDI' : 'BENGALI'}
          </button>
        </div>
      </div>

      {/* Meal Items */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`${selectedDate}-${selectedMeal}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {currentItems && currentItems.length > 0 ? (
            <div className="stagger">
              {currentItems.map((item) => {
                const isHindi = ownerLanguage === 'Hindi';
                const displayName = isLocal ? (isHindi ? (item.hindiName || item.name) : (item.bengaliName || item.name)) : item.name;
                const displayQuantity = isLocal ? (isHindi ? (item.hindiQuantity || item.quantity) : (item.bengaliQuantity || item.quantity)) : item.quantity;
                const displayInstruction = isLocal ? (isHindi ? (item.hindiInstruction || item.instruction) : (item.bengaliInstruction || item.instruction)) : item.instruction;
                
                const originalVideoUrlStr = item.videoUrl?.trim() || '';
                const hasOriginalVideo = originalVideoUrlStr !== '' && originalVideoUrlStr.toLowerCase() !== 'na' && originalVideoUrlStr.toLowerCase() !== 'n/a';
                const displayVideoUrl = hasOriginalVideo ? (isLocal ? (isHindi ? (item.hindiVideoUrl || item.videoUrl) : (item.bengaliVideoUrl || item.videoUrl)) : originalVideoUrlStr) : '';
                const ytId = hasOriginalVideo ? getYouTubeId(displayVideoUrl) : null;

                return (
                  <motion.div 
                    key={item.id} 
                    className={`bg-white rounded-[32px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] border transition-all ${item.prepared ? 'border-green-200 bg-green-50/10' : 'border-[var(--cream-dark)]'}`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleTogglePrepared(item.id)}
                          className={`shrink-0 transition-all focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] outline-none rounded-full ${item.prepared ? 'text-[var(--sage)] scale-110' : 'text-gray-200 hover:text-[var(--terracotta)]'}`}
                          aria-label={item.prepared ? `Mark ${displayName} as unprepared` : `Mark ${displayName} as prepared`}
                        >
                          {item.prepared ? <CheckCircle2 size={32} /> : <Circle size={32} strokeWidth={2} />}
                        </button>
                        <div>
                          <h3 className={`text-xl font-[var(--font-display)] font-bold tracking-tight leading-tight transition-all ${item.prepared ? 'text-[var(--sage)] opacity-40 line-through' : 'text-[var(--charcoal)]'}`}>
                            {displayName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)]">{translations.quantity}:</span>
                            <span className={`text-sm font-black ${item.prepared ? 'text-[var(--sage)] opacity-40' : 'text-[var(--terracotta)]'}`}>
                              {isLocal ? getPhoneticNumber(displayQuantity, ownerLanguage) : displayQuantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {displayInstruction && (
                      <div className={`p-5 rounded-2xl text-sm leading-relaxed mb-6 border ${item.prepared ? 'bg-green-50/50 border-green-100 text-green-800/40' : 'bg-[var(--cream)]/50 border-[var(--cream-dark)] text-[var(--charcoal-soft)]'}`}>
                        <span className={`font-black block mb-2 text-[10px] uppercase tracking-[0.2em] opacity-40`}>{translations.instruction}</span>
                        <p className="font-bold opacity-80">{displayInstruction}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      {/* Video Button */}
                      {displayVideoUrl && (
                        <a
                          href={displayVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-4 p-4 rounded-2xl transition-all border group ${item.prepared ? 'bg-[var(--sage-muted)]/50 border-[var(--sage-light)]/20 opacity-40' : 'bg-[var(--terracotta)]/5 border-[var(--terracotta)]/10 hover:bg-[var(--terracotta)]/10 hover:border-[var(--terracotta)]/20'}`}
                        >
                          <div className="w-14 h-10 shrink-0 bg-gray-200 rounded-lg overflow-hidden border border-white/50 shadow-sm relative">
                            <img 
                              src={ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : `https://picsum.photos/seed/${encodeURIComponent(item.name)}/100/100`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              alt="Recipe"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Youtube size={16} className="text-white" />
                            </div>
                          </div>
                          <span className="font-black text-xs uppercase tracking-widest text-[var(--terracotta)]">{translations.watchRecipe}</span>
                        </a>
                      )}

                      {/* Cook Note */}
                      <div className="relative">
                        {item.note ? (
                          <div className="bg-[var(--sage-muted)] border border-[var(--sage-light)]/20 rounded-2xl p-4 flex items-start gap-3 group">
                            <MessageSquare size={18} className="text-[var(--sage)] shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[var(--charcoal)] leading-tight">{item.note}</p>
                              <button 
                                onClick={() => handleSaveNote(item.id, '')}
                                className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] hover:text-[var(--sage-light)] mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Clear Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 opacity-40 group-focus-within:opacity-100 transition-opacity" size={18} />
                            <input 
                              type="text"
                              placeholder={translations.addNote}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveNote(item.id, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                              className="w-full pl-12 pr-12 py-4 bg-[var(--cream)]/30 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all text-xs font-bold shadow-inner"
                            />
                            <button 
                              onClick={(e) => {
                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                if (input.value) {
                                  handleSaveNote(item.id, input.value);
                                  input.value = '';
                                }
                              }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] hover:text-[var(--terracotta-deep)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] outline-none rounded-md"
                              aria-label={`Save note for ${displayName}`}
                            >
                              <Save size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-[var(--cream-dark)] shadow-sm"
            >
              <div className="w-20 h-20 bg-[var(--cream)] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <AlertCircle className="h-10 w-10 text-[var(--charcoal-soft)] opacity-20" />
              </div>
              <p className="text-[var(--charcoal)] font-bold text-lg px-8 tracking-tight">{translations.noItems} {selectedMeal === 'lunch' ? translations.lunch : translations.dinner} {translations.on} {isViewingToday ? translations.today : format(selectedDate, 'MMM do')}.</p>
              <p className="text-[var(--charcoal-soft)] font-medium mt-2 opacity-50 px-8 text-sm">{translations.checkBack}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
