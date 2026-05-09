import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Youtube, Sparkles, X, ChevronRight } from 'lucide-react';
import { MealItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface DiscoveryViewProps {
  householdId: string;
  onSelect: (item: Partial<MealItem>) => void;
}

export default function DiscoveryView({ householdId, onSelect }: DiscoveryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const q = query(
          collection(db, 'recipeProposals'),
          where('ownerId', '==', householdId),
          orderBy('lastUpdated', 'desc'),
          limit(6)
        );
        const snap = await getDocs(q);
        setTrending(snap.docs.map(d => d.data()));
      } catch (e) {
        console.error("Discovery trending fetch failed:", e);
      }
    };
    fetchTrending();
  }, [householdId]);

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Simple prefix search using Firestore query
      const q = query(
        collection(db, 'recipeProposals'),
        where('ownerId', '==', householdId),
        where('id', '>=', val.toLowerCase()),
        where('id', '<=', val.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      setResults(snap.docs.map(d => d.data()));
    } catch (e) {
      console.error("Discovery search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = (item: any) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect({
        name: item.name,
        bengaliName: item.bengaliName,
        videoUrl: item.videoUrl,
        bengaliVideoUrl: item.bengaliVideoUrl
      })}
      className="group bg-white p-4 rounded-2xl border border-gray-100 hover:border-gray-900 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-colors">
          {item.videoUrl ? <Youtube size={20} /> : <Plus size={20} />}
        </div>
        <div>
          <p className="font-bold text-gray-900">{item.name}</p>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.bengaliName || 'No translation'}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
    </motion.div>
  );

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search your kitchen history..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-gray-100 border-none rounded-[24px] pl-12 pr-4 py-4 font-bold focus:ring-2 focus:ring-gray-900 transition-all outline-none"
        />
        {searchTerm && (
          <button 
            onClick={() => handleSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {searchTerm.length >= 2 ? (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Search Results</h3>
            {loading ? (
              <div className="py-10 text-center text-gray-400 font-bold">Searching...</div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((item, i) => (
                  <div key={item.id}>{renderItem(item)}</div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-400 font-bold">No matches found in your history.</div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-indigo-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Recently Cooked</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trending.map((item, i) => (
                <div key={item.id}>{renderItem(item)}</div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
