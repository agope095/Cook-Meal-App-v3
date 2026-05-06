import React, { useState, useEffect } from 'react';
import { Heart, Trash2, Loader2, Plus } from 'lucide-react';
import { getFavorites, addFavorite, removeFavorite } from '../services/historyService';

interface FavoritesViewProps {
  householdId: string;
}

export default function FavoritesView({ householdId }: FavoritesViewProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFavorite, setNewFavorite] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const favs = await getFavorites(householdId);
      setFavorites(favs);
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFavorite.trim()) return;
    
    setIsAdding(true);
    try {
      await addFavorite(householdId, newFavorite.trim());
      setNewFavorite('');
      await loadFavorites();
    } catch (error) {
      console.error("Failed to add favorite:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await removeFavorite(householdId, name);
      await loadFavorites();
    } catch (error) {
      console.error("Failed to remove favorite:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center mb-6">
          <Heart className="text-red-500 mr-3" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Favorite Meals</h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          These meals will be prioritized by the AI Meal Planner and can bypass the "2-Day Rule".
        </p>

        <form onSubmit={handleAdd} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newFavorite}
            onChange={(e) => setNewFavorite(e.target.value)}
            placeholder="Add a new favorite meal (e.g., Chicken Tikka Masala)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isAdding || !newFavorite.trim()}
            className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isAdding ? <Loader2 className="animate-spin mr-2" size={20} /> : <Plus className="mr-2" size={20} />}
            Add
          </button>
        </form>

        {favorites.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Heart className="mx-auto text-gray-400 mb-3" size={32} />
            <p className="text-gray-500">You haven't added any favorites yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                <span className="font-medium text-gray-800">{fav}</span>
                <button
                  onClick={() => handleRemove(fav)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remove from favorites"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
