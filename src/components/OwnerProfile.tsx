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
        email: auth.currentUser.email,
        updatedAt: new Date().toISOString(),
        joinedHouseholdId: null 
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Checking for family invitations...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl shadow-xl text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-green-600" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
        <p className="text-gray-600">You have joined the household. Getting things ready...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 bg-white rounded-2xl shadow-sm border border-gray-100 mt-8">
      <div className="flex border-b border-gray-100 -mx-6 md:-mx-8 mb-8">
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center ${mode === 'create' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Home size={18} className="mr-2" />
          My Household
        </button>
        <button
          onClick={() => setMode('join')}
          disabled={invitations.length === 0}
          className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center ${mode === 'join' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-gray-500 hover:text-gray-700 disabled:opacity-30'}`}
        >
          <Users size={18} className="mr-2" />
          Invitations ({invitations.length})
        </button>
      </div>

      <div className="flex justify-center mb-4">
        <div className="bg-orange-100 text-orange-600 p-4 rounded-full">
          {mode === 'create' ? <Home size={32} /> : <Mail size={32} />}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
        {mode === 'create' ? 'Household Profile' : 'Family Invitations'}
      </h2>
      <p className="text-center text-gray-500 mb-8">
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
            <UserIcon className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Cook's Language Preference</label>
          <div className="flex gap-4">
            {['Bengali', 'Hindi'].map((lang) => (
              <label key={lang} className={`flex-1 flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${cookLanguage === lang ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}>
                <input
                  type="radio"
                  className="hidden"
                  name="cookLanguage"
                  value={lang}
                  checked={cookLanguage === lang}
                  onChange={() => setCookLanguage(lang as any)}
                />
                <Languages size={18} className="mr-2" />
                <span className="font-bold">{lang}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">The AI will generate recipes and instructions in this script.</p>
        </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-8"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckCircle className="mr-2" size={20} />
            )}
            {existingHousehold ? 'Update Profile' : 'Save Profile'}
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
              <div key={invite.id} className="p-6 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-orange-600 shadow-sm mr-4">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{invite.ownerName}'s Household</p>
                    <p className="text-sm text-gray-500">{invite.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinHousehold(invite.id)}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-md disabled:opacity-50"
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
