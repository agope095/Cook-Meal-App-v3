import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDocs, collection, query, where, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User as UserIcon, Home, MapPin, Building, CheckCircle, Mail, Users, AlertTriangle, Languages } from 'lucide-react';

interface OwnerProfileProps {
  onProfileComplete: () => void;
  onProfileUpdate?: (profile: any) => void;
}

export default function OwnerProfile({ onProfileComplete, onProfileUpdate }: OwnerProfileProps) {
  const [name, setName] = useState(auth.currentUser?.displayName || '');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [society, setSociety] = useState('');
  const [tower, setTower] = useState('');
  const [flat, setFlat] = useState('');
  const [cookLanguage, setCookLanguage] = useState<'Bengali' | 'Hindi'>('Bengali');
  const [dietaryPreference, setDietaryPreference] = useState<'veg' | 'non-veg' | 'egg'>('non-veg');
  const [viewPreference, setViewPreference] = useState<'casual' | 'power'>('casual');
  const [householdSize, setHouseholdSize] = useState(2);
  const [appetiteMultiplier, setAppetiteMultiplier] = useState(1.0);
  const [plannedMeals, setPlannedMeals] = useState<('breakfast' | 'lunch' | 'snacks' | 'dinner')[]>(['lunch', 'dinner']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [societies, setSocieties] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Invitation / Existing Household logic
  const [invitations, setInvitations] = useState<{id: string, ownerName: string, email: string}[]>([]);
  const [existingHousehold, setExistingHousehold] = useState<any>(null);
  const [mode, setMode] = useState<'create' | 'join' | 'detecting'>('detecting');
  const [success, setSuccess] = useState(false);

  // Status check (invites + existing)
  useEffect(() => {
    const checkStatus = async () => {
      if (!auth.currentUser) return;
      setMode('detecting');
      
      try {
        const userEmail = auth.currentUser.email?.toLowerCase();
        
        // 1. Check if already owns a household (Priority)
        const ownRef = doc(db, 'owners', auth.currentUser.uid);
        const ownSnap = await getDoc(ownRef);
        let hasOwnHousehold = false;

        if (ownSnap.exists()) {
          const data = ownSnap.data();
          if (data.pincode) {
            setExistingHousehold(data);
            setName(data.name || '');
            setPincode(data.pincode || '');
            setCity(data.city || '');
            setSociety(data.society || '');
            setTower(data.tower || '');
            setFlat(data.flat || '');
            setCookLanguage(data.cookLanguage || 'Bengali');
            setDietaryPreference(data.dietaryPreference || 'non-veg');
            setViewPreference(data.viewPreference || 'casual');
            setHouseholdSize(data.householdSize || 2);
            setAppetiteMultiplier(data.appetiteMultiplier || 1.0);
            if (data.plannedMeals && Array.isArray(data.plannedMeals)) {
              setPlannedMeals(data.plannedMeals);
            }
            hasOwnHousehold = true;
          }
        }

        // 2. Check for invitations
        if (userEmail) {
          const invitesQuery = query(
            collection(db, 'owners'),
            where('authorizedEmails', 'array-contains', userEmail)
          );
          const inviteSnap = await getDocs(invitesQuery);
          const inviteList = inviteSnap.docs.map(d => ({
            id: d.id,
            ownerName: d.data().name || 'Someone',
            email: d.data().email
          }));
          setInvitations(inviteList);
          
          // If they have invitations and NO household of their own, show Join mode
          if (inviteList.length > 0 && !hasOwnHousehold) {
            setMode('join');
          } else {
            setMode('create');
          }
        } else {
          setMode('create');
        }
      } catch (err) {
        console.error("Status check failed:", err);
        setMode('create');
      }
    };
    checkStatus();
  }, [auth.currentUser]);


  // Fetch societies based on pincode
  useEffect(() => {
    if (pincode.length === 6) {
      const fetchSocieties = async () => {
        try {
          const q = query(collection(db, 'localities'), where('pincode', '==', pincode));
          const querySnapshot = await getDocs(q);
          const results: string[] = [];
          let detectedCity = '';
          
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.society) {
              results.push(data.society);
            }
            if (data.city && !detectedCity) {
              detectedCity = data.city;
            }
          });
          
          setSocieties(Array.from(new Set(results)));
          if (detectedCity && !city) {
            setCity(detectedCity);
          }
        } catch (err) {
          console.error("Error fetching localities", err);
        }
      };
      fetchSocieties();
    } else {
      setSocieties([]);
    }
  }, [pincode, city]);

  const handleJoinHousehold = async (householdId: string) => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    
    try {
      const user = auth.currentUser;
      const email = user.email!.toLowerCase();
      
      // 1. Add this user to the target household's authorizedUsers
      const ownerRef = doc(db, 'owners', householdId);
      await updateDoc(ownerRef, {
        authorizedUsers: arrayUnion({
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email
        }),
        authorizedUids: arrayUnion(user.uid),
        authorizedEmails: arrayRemove(email)
      });
      
      // 2. Mark this user as having joined this household (Option A)
      const userProfileRef = doc(db, 'owners', user.uid);
      await setDoc(userProfileRef, {
        joinedHouseholdId: householdId,
        joinedAt: new Date().toISOString()
      }, { merge: true });
      
      setSuccess(true);
      const joinedSnap = await getDoc(doc(db, 'owners', householdId));
      if (joinedSnap.exists() && onProfileUpdate) onProfileUpdate(joinedSnap.data());
      setTimeout(() => onProfileComplete(), 1500);
    } catch (err: any) {
      console.error(err);
      setError("Failed to join household. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');

    try {
      const uid = auth.currentUser.uid;
      const ownerData = {
        name,
        pincode,
        city,
        society,
        tower,
        flat,
        cookLanguage,
        dietaryPreference,
        email: auth.currentUser.email,
        updatedAt: new Date().toISOString(),
        joinedHouseholdId: null,
        viewPreference,
        householdSize,
        appetiteMultiplier,
        plannedMeals,
        authorizedUids: arrayUnion(uid)
      };

      await setDoc(doc(db, 'owners', uid), ownerData, { merge: true });

      
      // If they had joined a household, remove them from that household's authorizedUsers
      if (existingHousehold?.joinedHouseholdId) {
        const oldHouseholdRef = doc(db, 'owners', existingHousehold.joinedHouseholdId);
        await updateDoc(oldHouseholdRef, {
          authorizedUsers: arrayRemove({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            name: name || auth.currentUser.displayName || auth.currentUser.email
          })
        }).catch(err => console.warn("Could not remove from old household:", err));
      }

      setSuccess(true);
      if (onProfileUpdate) onProfileUpdate(ownerData);
      setTimeout(() => onProfileComplete(), 1500);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'detecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--terracotta)] mb-4"></div>
        <p className="text-[var(--warm-gray)] font-medium">Checking for family invitations...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto my-6 p-6 bg-white rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 bg-[var(--sage)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-[var(--sage)]" size={32} />
        </div>
        <h2 className="text-xl font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-1">Success!</h2>
        <p className="text-xs text-[var(--charcoal-soft)] opacity-70">You have joined the household. Getting things ready...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 bg-white rounded-2xl shadow-sm border border-gray-100 mt-4">
      <div className="flex border-b border-gray-100 -mx-6 md:-mx-8 mb-6">
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center ${mode === 'create' ? 'text-[var(--terracotta)] border-b-2 border-[var(--terracotta)] bg-[var(--terracotta)]/5' : 'text-[var(--warm-gray)] hover:text-[var(--charcoal)]'}`}
        >
          <Home size={18} className="mr-2" />
          My Household
        </button>
        <button
          onClick={() => setMode('join')}
          disabled={invitations.length === 0}
          className={`flex-1 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center ${mode === 'join' ? 'text-[var(--terracotta)] border-b-2 border-[var(--terracotta)] bg-[var(--terracotta)]/5' : 'text-[var(--warm-gray)] hover:text-[var(--charcoal)] disabled:opacity-30'}`}
        >
          <Users size={18} className="mr-2" />
          Invitations ({invitations.length})
        </button>
      </div>

      <div className="flex justify-center mb-4">
        <div className="bg-[var(--terracotta)]/10 text-[var(--terracotta)] p-5 rounded-[24px] shadow-sm">
          {mode === 'create' ? <Home size={32} /> : <Mail size={32} />}
        </div>
      </div>

      <h2 className="text-2xl font-[var(--font-display)] font-bold text-center text-[var(--charcoal)] mb-2">
        {mode === 'create' ? 'Household Profile' : 'Family Invitations'}
      </h2>
      <p className="text-center text-[var(--charcoal-soft)] opacity-60 font-medium mb-6 max-w-sm mx-auto text-sm">
        {mode === 'create' 
          ? 'Tell us about your household to personalize your experience.'
          : 'You have been invited to join an existing household.'}
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {mode === 'create' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {existingHousehold && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start mb-6">
              <AlertTriangle className="text-yellow-600 mr-3 mt-0.5 shrink-0" size={20} />
              <p className="text-sm text-yellow-800">
                You already have a household at <strong>{existingHousehold.society}</strong>. 
                Updating details here will update your current household.
              </p>
            </div>
          )}
          {/* ... existing fields ... */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-3 text-[var(--terracotta)] opacity-40" size={20} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--cream)]/50 border border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400"
              placeholder="Your Name"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pincode *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                placeholder="e.g. 560001"
                maxLength={6}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                placeholder="e.g. Noida"
                required
              />
            </div>
          </div>
        </div>

        <div className="relative mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Society / Building Name *</label>
          <div className="relative">
            <Building className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              value={society}
              onChange={(e) => {
                setSociety(e.target.value);
                setShowAutocomplete(true);
              }}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="e.g. Prestige Shantiniketan"
              required
            />
          </div>
            
            {showAutocomplete && societies.filter(s => s.toLowerCase().includes(society.toLowerCase())).length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {societies
                  .filter(s => s.toLowerCase().includes(society.toLowerCase()))
                  .map((s, idx) => (
                  <li 
                    key={idx}
                    className="px-4 py-2 hover:bg-orange-50 cursor-pointer text-gray-700"
                    onClick={() => {
                      setSociety(s);
                      setShowAutocomplete(false);
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tower / Block (Optional)</label>
            <input
              type="text"
              value={tower}
              onChange={(e) => setTower(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="e.g. Tower A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Flat / Villa No. (Optional)</label>
            <input
              type="text"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="e.g. 402"
            />
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-3 ml-1">Cook's Language Preference</label>
          <div className="flex gap-4">
            {['Hindi', 'Bengali'].map((lang) => (
              <label key={lang} className={`flex-1 flex items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${cookLanguage === lang ? 'border-[var(--terracotta)] bg-[var(--terracotta)]/5 text-[var(--terracotta-deep)] shadow-sm' : 'border-[var(--cream-dark)] bg-white text-[var(--warm-gray)] hover:border-[var(--terracotta)]/20'}`}>
                <input
                  type="radio"
                  className="hidden"
                  name="cookLanguage"
                  value={lang}
                  checked={cookLanguage === lang}
                  onChange={() => setCookLanguage(lang as any)}
                />
                <Languages size={18} className="mr-2" />
                <span className="font-black text-xs uppercase tracking-widest">{lang}</span>
              </label>
            ))}
          </div>
          <p className="text-[9px] text-[var(--warm-gray)] mt-3 uppercase tracking-widest opacity-60">The AI will generate recipes and instructions in this script.</p>
        </div>

        <div className="mt-8">
          <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-3 ml-1">Household Dietary Preference</label>
          <div className="flex gap-4">
            {[
              { id: 'veg', label: 'Vegetarian', icon: '🟢' },
              { id: 'egg', label: 'Eggitarian', icon: '🟡' },
              { id: 'non-veg', label: 'Non-Veg', icon: '🔴' }
            ].map((pref) => (
              <label key={pref.id} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${dietaryPreference === pref.id ? 'border-[var(--terracotta)] bg-[var(--terracotta)]/5 text-[var(--terracotta-deep)] shadow-sm' : 'border-[var(--cream-dark)] bg-white text-[var(--warm-gray)] hover:border-[var(--terracotta)]/20'}`}>
                <input
                  type="radio"
                  className="hidden"
                  name="dietaryPreference"
                  value={pref.id}
                  checked={dietaryPreference === pref.id}
                  onChange={() => setDietaryPreference(pref.id as any)}
                />
                <span className="text-2xl mb-2">{pref.icon}</span>
                <span className="font-black text-[10px] uppercase tracking-widest">{pref.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[9px] text-[var(--warm-gray)] mt-3 uppercase tracking-widest opacity-60">AI suggestions will prioritize this preference.</p>
        </div>

        <div className="mt-8">
          <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-3 ml-1">Meals to Plan</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
              { id: 'lunch', label: 'Lunch', icon: '☀️' },
              { id: 'snacks', label: 'Snacks', icon: '☕' },
              { id: 'dinner', label: 'Dinner', icon: '🌙' }
            ].map((meal) => (
              <label key={meal.id} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${plannedMeals.includes(meal.id as any) ? 'border-[var(--terracotta)] bg-[var(--terracotta)]/5 text-[var(--terracotta-deep)] shadow-sm' : 'border-[var(--cream-dark)] bg-white text-[var(--warm-gray)] hover:border-[var(--terracotta)]/20'}`}>
                <input
                  type="checkbox"
                  className="hidden"
                  value={meal.id}
                  checked={plannedMeals.includes(meal.id as any)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPlannedMeals([...plannedMeals, meal.id as any]);
                    } else {
                      setPlannedMeals(plannedMeals.filter(m => m !== meal.id));
                    }
                  }}
                />
                <span className="text-2xl mb-2">{meal.icon}</span>
                <span className="font-black text-[10px] uppercase tracking-widest">{meal.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[9px] text-[var(--warm-gray)] mt-3 uppercase tracking-widest opacity-60">Select the meals you typically want to plan for.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-3 ml-1">Household Size</label>
            <div className="relative">
              <Users className="absolute left-3 top-3 text-[var(--terracotta)] opacity-40" size={20} />
              <input
                type="number"
                min="1"
                max="20"
                value={householdSize}
                onChange={(e) => setHouseholdSize(parseInt(e.target.value) || 1)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--cream)]/50 border border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)]"
                placeholder="Number of people"
              />
            </div>
            <p className="text-[9px] text-[var(--warm-gray)] mt-2 uppercase tracking-widest opacity-60">Used for per-person nutrition calculation.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-3 ml-1">Your Appetite</label>
            <select
              value={appetiteMultiplier}
              onChange={(e) => setAppetiteMultiplier(parseFloat(e.target.value))}
              className="w-full px-4 py-3 bg-[var(--cream)]/50 border border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] appearance-none"
            >
              <option value="0.7">Light Eater (70%)</option>
              <option value="0.85">Small Appetite (85%)</option>
              <option value="1.0">Normal / Average (100%)</option>
              <option value="1.2">Healthy Appetite (120%)</option>
              <option value="1.4">Heavy Eater (140%)</option>
            </select>
            <p className="text-[9px] text-[var(--warm-gray)] mt-2 uppercase tracking-widest opacity-60">Adjusts per-person nutrition for you.</p>
          </div>
        </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-[var(--charcoal)] hover:bg-[var(--charcoal-soft)] text-white rounded-[24px] font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6 shadow-xl hover:shadow-[var(--charcoal)]/20 hover:-translate-y-0.5"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckCircle className="mr-2" size={18} />
            )}
            {existingHousehold ? 'Update Profile' : 'Create My Household'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {existingHousehold && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start mb-6">
              <AlertTriangle className="text-orange-600 mr-3 mt-0.5 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-orange-900">Switching Household?</p>
                <p className="text-xs text-orange-800">
                  Joining a new family will disconnect you from your current household (<strong>{existingHousehold.society}</strong>). 
                  You will now manage the new family's plans.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {invitations.map(invite => (
              <div key={invite.id} className="p-6 bg-[var(--terracotta)]/5 rounded-3xl border border-[var(--terracotta)]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[var(--terracotta)] shadow-sm mr-4 border border-[var(--terracotta)]/10">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="font-black text-[var(--charcoal)] uppercase text-xs tracking-widest">{invite.ownerName}'s Household</p>
                    <p className="text-sm text-[var(--warm-gray)]">{invite.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinHousehold(invite.id)}
                  disabled={loading}
                  className="w-full sm:w-auto px-8 py-3 bg-[var(--charcoal)] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--charcoal-soft)] transition-all shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Family'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
