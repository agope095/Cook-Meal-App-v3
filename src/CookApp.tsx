import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import CookView from './components/CookView';
import { Home, PlusCircle, LogOut, ChevronRight, MapPin, Building2 } from 'lucide-react';

interface HouseholdMapping {
  ownerId: string;
  society: string;
  tower: string;
  flat: string;
}

export default function CookApp() {
  const [households, setHouseholds] = useState<HouseholdMapping[]>(() => {
    const saved = localStorage.getItem('souschef_cook_households');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(() => {
    return localStorage.getItem('souschef_active_owner_id');
  });

  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
  }, []);

  useEffect(() => {
    localStorage.setItem('souschef_cook_households', JSON.stringify(households));
  }, [households]);

  useEffect(() => {
    if (activeOwnerId) {
      localStorage.setItem('souschef_active_owner_id', activeOwnerId);
    } else {
      localStorage.removeItem('souschef_active_owner_id');
    }
  }, [activeOwnerId]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Check for auth first
      if (!auth.currentUser) {
        console.log('[DEBUG] Auth not ready, attempting sign-in...');
        try {
          await signInAnonymously(auth);
        } catch (authErr: any) {
          console.error('[ERROR] Anonymous sign-in failed during connection:', authErr);
          setError('Authentication failed. Please check your Firebase settings.');
          setLoading(false);
          return;
        }
      }

      const uid = auth.currentUser?.uid;
      if (!uid) {
        setError('Authentication error. Please try again.');
        setLoading(false);
        return;
      }

      // 1. Resolve the 6-digit invite code
      console.log('[DEBUG] Resolving invite code:', inviteCode.toUpperCase());
      const inviteRef = doc(db, 'inviteCodes', inviteCode.toUpperCase());
      const inviteSnap = await getDoc(inviteRef);
      
      if (!inviteSnap.exists()) {
        setError('Invalid kitchen code. Please check with the owner.');
        setLoading(false);
        return;
      }

      const { ownerId } = inviteSnap.data();
      console.log('[DEBUG] Invite code resolved to ownerId:', ownerId);

      // 2. Register this cook's UID with the owner in Firestore FIRST (for Security Rules)
      const cookRef = doc(db, 'cooks', uid);
      await setDoc(cookRef, {
        ownerIds: arrayUnion(ownerId),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('[DEBUG] Cook UID registered with ownerId');

      // 3. NOW Fetch owner details for local display (Rules will allow this now)
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId));
      if (!ownerSnap.exists()) {
        setError('Kitchen data not found in owners collection.');
        setLoading(false);
        return;
      }

      const data = ownerSnap.data();
      const newHouse: HouseholdMapping = {
        ownerId: ownerId,
        society: data.society || 'Unknown Society',
        tower: data.tower || '',
        flat: data.flat || ''
      };
      
      // Check if already exists in local list
      if (!households.find(h => h.ownerId === ownerId)) {
        setHouseholds([...households, newHouse]);
      }
      
      setActiveOwnerId(ownerId);
      setInviteCode('');
      setIsAddingNew(false);
    } catch (err: any) {
      console.error("[CRITICAL] Connection error:", err);
      // More specific error for Permission Denied
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please ensure Anonymous Auth is enabled in Firebase.');
      } else {
        setError('Failed to connect. Please check your internet or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const removeHouse = (ownerId: string) => {
    setHouseholds(households.filter(h => h.ownerId !== ownerId));
    if (activeOwnerId === ownerId) setActiveOwnerId(null);
  };

  // 1. Show the Active Kitchen if selected
  if (activeOwnerId && !isAddingNew) {
    const activeHouse = households.find(h => h.ownerId === activeOwnerId);
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col">
        <header className="bg-orange-600 text-white p-4 shadow-lg flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Home size={24} />
            <span className="font-black text-lg tracking-tight">SousChefAI</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-[10px] uppercase tracking-tighter opacity-90 leading-tight">
              <span className="font-black truncate max-w-[100px] text-orange-100">{activeHouse?.society}</span>
              <span className="font-bold">{activeHouse?.tower} {activeHouse?.flat}</span>
            </div>
            <button 
              onClick={() => setActiveOwnerId(null)}
              className="p-2 bg-orange-700 rounded-xl hover:bg-orange-800 transition-colors shadow-inner"
              title="Switch Kitchen"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto">
          <CookView ownerId={activeOwnerId} />
        </main>
      </div>
    );
  }

  // 2. Dashboard / Selection View
  return (
    <div className="min-h-screen bg-orange-50 p-6 flex flex-col items-center">
      <div className="max-w-md w-full mt-8 text-center">
        <div className="bg-orange-500 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-3">
          <Home size={40} strokeWidth={3} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2">Cook Portal</h1>
        <p className="text-gray-500 font-medium mb-10">Select a kitchen to start your shift</p>

        {households.length > 0 && !isAddingNew ? (
          <div className="space-y-4 text-left">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 ml-2">Connected Kitchens</h2>
            {households.map((h) => (
              <button
                key={h.ownerId}
                onClick={() => setActiveOwnerId(h.ownerId)}
                className="w-full bg-white p-5 rounded-3xl border-2 border-transparent hover:border-orange-500 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-orange-50 p-3 rounded-2xl text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-lg">{h.society}</p>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-tighter">
                      {h.tower} • {h.flat}
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" size={24} />
              </button>
            ))}
            
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full mt-6 flex items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-3xl text-gray-400 hover:text-orange-500 hover:border-orange-500 transition-all font-bold"
            >
              <PlusCircle size={24} />
              Connect Another Kitchen
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-orange-100 w-full text-left">
            <h2 className="text-2xl font-black text-gray-800 mb-2">Connect Kitchen</h2>
            <p className="text-sm font-medium text-gray-400 mb-8 uppercase tracking-widest">Enter the code from the owner app</p>
            
            <form onSubmit={handleConnect} className="space-y-6">
              <div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={20} />
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-lg"
                    placeholder="6-character code (e.g. AB12CD)"
                  />
                </div>
                {error && <p className="mt-2 text-red-500 text-xs font-bold px-4">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Connect & Open Menu'}
              </button>
              
              {households.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="w-full text-center text-gray-400 hover:text-gray-600 font-bold text-sm pt-2"
                >
                  Back to kitchen list
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
