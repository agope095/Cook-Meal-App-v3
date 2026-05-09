import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { MealPlan, MealItem } from '../types';
import { motion } from 'framer-motion';

interface MonthlyViewProps {
  currentDate: Date;
  data: Record<string, MealPlan>;
  onDateSelect: (date: Date) => void;
}

export default function MonthlyView({ currentDate, data, onDateSelect }: MonthlyViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getHeroDish = (plan: MealPlan | undefined): MealItem | undefined => {
    if (!plan) return undefined;
    const allItems = [...(plan.lunch || []), ...(plan.dinner || [])];
    return allItems.find(item => item.isHero) || allItems[0];
  };

  return (
    <div className="bg-white/40 backdrop-blur-md rounded-[40px] p-8 border border-white/60 shadow-sm">
      <div className="grid grid-cols-7 mb-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {calendarDays.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const plan = data[dateStr];
          const hero = getHeroDish(plan);
          const isCurrentMonth = isSameMonth(date, monthStart);
          const isToday = isSameDay(date, new Date());

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.01 }}
              key={dateStr}
              onClick={() => onDateSelect(date)}
              className={`min-h-[100px] p-2 rounded-2xl border transition-all cursor-pointer group flex flex-col ${
                !isCurrentMonth ? 'opacity-20 pointer-events-none' : ''
              } ${
                isToday 
                  ? 'bg-gray-900 border-gray-900 shadow-xl' 
                  : hero 
                    ? 'bg-white border-gray-100 hover:border-gray-900 shadow-sm' 
                    : 'bg-gray-50/50 border-dashed border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-black ${isToday ? 'text-white' : 'text-gray-400'}`}>
                  {format(date, 'd')}
                </span>
                {hero && (
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    hero.dietaryType === 'veg' ? 'bg-green-500' : hero.dietaryType === 'egg' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                )}
              </div>

              {hero && (
                <p className={`text-[10px] font-bold leading-tight line-clamp-2 ${isToday ? 'text-white/80' : 'text-gray-700'}`}>
                  {hero.name}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
