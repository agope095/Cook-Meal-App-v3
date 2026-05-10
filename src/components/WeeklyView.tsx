import React from 'react';
import { format, addDays } from 'date-fns';
import { MealPlan, MealItem } from '../types';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';

interface WeeklyViewProps {
  startDate: Date;
  data: Record<string, MealPlan>;
  onDateSelect: (date: Date) => void;
}

export default function WeeklyView({ startDate, data, onDateSelect }: WeeklyViewProps) {
  const weekDays = [...Array(7)].map((_, i) => addDays(startDate, i));

  const getHero = (items: MealItem[] | undefined) => {
    return items?.find(item => item.isHero) || items?.[0];
  };

  const renderMealCell = (items: MealItem[] | undefined, type: 'lunch' | 'dinner', date: Date) => {
    const hero = getHero(items);
    
    return (
      <div 
        onClick={() => onDateSelect(date)}
        className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer group ${
          hero 
            ? 'bg-white border-gray-100 hover:border-gray-900 shadow-sm' 
            : 'bg-gray-50/50 border-dashed border-gray-200 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">{type}</span>
        {hero ? (
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              hero.dietaryType === 'veg' ? 'bg-green-500' : hero.dietaryType === 'egg' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-sm font-bold text-gray-900 line-clamp-1">{hero.name}</span>
            {hero.isHero && <Sparkles size={10} className="text-gray-400" />}
          </div>
        ) : (
          <div className="flex items-center text-gray-300 gap-1 text-xs font-bold">
            <Plus size={12} />
            <span>Plan</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {weekDays.map((date, idx) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const plan = data[dateStr];
        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

        return (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={dateStr}
            className={`flex flex-col md:flex-row gap-4 p-4 rounded-[32px] border-2 transition-all ${
              isToday ? 'bg-white border-gray-900 shadow-xl' : 'bg-white/40 border-white/60'
            }`}
          >
            <div className="md:w-32 flex flex-row md:flex-col items-center justify-center md:border-r border-gray-100 pr-4 gap-2">
              <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">
                {format(date, 'EEE')}
              </span>
              <span className={`text-2xl font-black ${isToday ? 'text-gray-900' : 'text-gray-400'}`}>
                {format(date, 'dd')}
              </span>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4">
              {renderMealCell(plan?.lunch, 'lunch', date)}
              {renderMealCell(plan?.dinner, 'dinner', date)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
