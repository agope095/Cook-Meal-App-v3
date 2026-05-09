import React from 'react';
import { MealItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Users } from 'lucide-react';
import { deriveServingContext } from '../services/nutritionService';

interface MealNutritionSummaryProps {
  lunch: MealItem[];
  dinner: MealItem[];
  householdSize?: number;
}

export default function MealNutritionSummary({ lunch, dinner, householdSize = 2 }: MealNutritionSummaryProps) {
  const allItems = [...lunch, ...dinner].filter(item => item.nutrition);
  
  if (allItems.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 mb-6 bg-[var(--cream-dark)]/30 border border-dashed border-[var(--warm-gray-light)] rounded-[28px] p-8 text-center"
      >
        <Activity className="mx-auto mb-3 text-[var(--warm-gray)] opacity-40" size={32} />
        <h3 className="text-sm font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-1">No Nutritional Data</h3>
        <p className="text-[10px] text-[var(--warm-gray)] uppercase tracking-widest leading-relaxed max-w-[200px] mx-auto">
          Add ingredients to your dishes in the library to see daily macro insights.
        </p>
      </motion.div>
    );
  }

  // Derive both household totals and per-person via nutrition service
  const { householdTotal: totals, perPerson, inferredServings, hasServingData } = deriveServingContext(allItems, householdSize);

  // Calculate percentages based on calories
  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const totalKcalCalc = proteinKcal + carbsKcal + fatKcal;
  
  const pPercent = totalKcalCalc > 0 ? (proteinKcal / totalKcalCalc) * 100 : 0;
  const cPercent = totalKcalCalc > 0 ? (carbsKcal / totalKcalCalc) * 100 : 0;
  const fPercent = totalKcalCalc > 0 ? (fatKcal / totalKcalCalc) * 100 : 0;

  // Balance Score Logic — Editorial & Warm
  let balanceScore = "Balanced Fuel";
  let balanceColor = "var(--sage)";
  
  if (pPercent > 35) {
    balanceScore = "Protein Focused";
    balanceColor = "var(--terracotta)";
  } else if (cPercent > 60) {
    balanceScore = "High Carbs";
    balanceColor = "var(--sage-light)";
  } else if (fPercent > 35) {
    balanceScore = "Healthy Fats";
    balanceColor = "var(--terracotta-light)";
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 mb-6 bg-[var(--cream)]/70 backdrop-blur-xl rounded-[28px] p-5 border border-white shadow-lg relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[var(--charcoal)] text-white rounded-xl flex items-center justify-center shadow-md">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="text-sm font-[var(--font-display)] font-bold text-[var(--charcoal)]">Daily Nutrition</h3>
              <div className="flex items-center gap-2">
                <div className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: balanceColor }}>
                  {balanceScore}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-[var(--font-display)] font-bold text-[var(--charcoal)] leading-none">
              {totals.kcal}
            </div>
            {/* Per-person context line — muted secondary, shown when serving data is available */}
            {perPerson && inferredServings ? (
              <div className="flex items-center justify-end gap-1 mt-1">
                <Users size={9} className="text-[var(--warm-gray)] opacity-50" />
                <div className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] opacity-60">
                  ~{perPerson.kcal} kcal · {inferredServings} {inferredServings === 1 ? 'person' : 'people'}
                </div>
              </div>
            ) : (
              <div className="text-[9px] font-black uppercase tracking-widest text-[var(--warm-gray)] mt-1 opacity-60">
                of ~2,000 kcal target
              </div>
            )}
          </div>
        </div>

        {/* Premium Animated Macro Bar */}
        <div className="space-y-4">
          <div className="h-8 w-full bg-[var(--cream-dark)]/40 rounded-xl overflow-hidden flex relative border border-white/20 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${pPercent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className="h-full bg-[var(--terracotta)] flex items-center justify-center relative group"
            >
              <AnimatePresence>
                {pPercent > 12 && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap"
                  >
                    Protein
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${cPercent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
              className="h-full bg-[var(--sage-light)] flex items-center justify-center border-l border-white/20"
            >
              <AnimatePresence>
                {cPercent > 12 && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap"
                  >
                    Carbs
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${fPercent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
              className="h-full bg-[var(--warm-gray)] flex items-center justify-center border-l border-white/20"
            >
              <AnimatePresence>
                {fPercent > 12 && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap"
                  >
                    Fats
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/40 p-2.5 rounded-xl border border-white/60">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--terracotta)] mb-0.5">
                Protein {totals.protein}g
              </div>
              {perPerson && (
                <div className="text-[8px] text-[var(--warm-gray)] opacity-60 font-semibold">
                  ~{perPerson.protein}g/person
                </div>
              )}
            </div>
            <div className="bg-white/40 p-2.5 rounded-xl border border-white/60">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--sage)] mb-0.5">
                Carbs {totals.carbs}g
              </div>
              {perPerson && (
                <div className="text-[8px] text-[var(--warm-gray)] opacity-60 font-semibold">
                  ~{perPerson.carbs}g/person
                </div>
              )}
            </div>
            <div className="bg-white/40 p-2.5 rounded-xl border border-white/60">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-0.5">
                Fats {totals.fat}g
              </div>
              {perPerson && (
                <div className="text-[8px] text-[var(--warm-gray)] opacity-60 font-semibold">
                  ~{perPerson.fat}g/person
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
