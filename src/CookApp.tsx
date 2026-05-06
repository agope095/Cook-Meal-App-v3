import React, { useState, useEffect } from 'react';
import { auth, db, logout } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, updateDoc, deleteDoc } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import CookView from './components/CookView';
import { Home, PlusCircle, LogOut, ChevronRight, MapPin, Building2, User as UserIcon, Mail, Lock } from 'lucide-react';

interface HouseholdMapping {
  ownerId: string;
  society: string;
  tower: string;
  flat: string;
}

export default function CookApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [households, setHouseholds] = useState<HouseholdMapping[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(() => {
    return localStorage.getItem('souschef_active_owner_id');
  });

  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') || '');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(!!searchParams.get('invite'));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch cook profile
        try {
          const cookDoc = await getDoc(doc(db, 'cooks', currentUser.uid));
          if (cookDoc.exists()) {
            const data = cookDoc.data();
            setUserProfile(data);
            
            // Reconstruct households from Firestore
            if (data.ownerIds && data.ownerIds.length > 0) {
              const houses: HouseholdMapping[] = [];
              for (const oid of data.ownerIds) {
                const ownerSnap = await getDoc(doc(db, 'owners', oid));
                if (ownerSnap.exists()) {
                  const oData = ownerSnap.data();
                  houses.push({
                    ownerId: oid,
                    society: oData.society || 'Unknown Society',
                    tower: oData.tower || '',
                    flat: oData.flat || ''
                  });
                }
              }
              setHouseholds(houses);
            }

            // Auto-connect if invite code in URL
            const urlInvite = searchParams.get('invite');
            if (urlInvite) {
              await handleDeepLinkConnect(currentUser, urlInvite);
            }
          } else {
            setUserProfile(null);
            setHouseholds([]);
          }
        } catch (err) {
          console.error("Error fetching cook profile:", err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setHouseholds([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeepLinkConnect = async (currentUser: User, code: string) => {
    try {
      setLoading(true);
      const inviteRef = doc(db, 'inviteCodes', code.toUpperCase());
      const inviteSnap = await getDoc(inviteRef);
      
      if (inviteSnap.exists()) {
        const { ownerId } = inviteSnap.data();
        
        // 1. Register cook
        const cookRef = doc(db, 'cooks', currentUser.uid);
        await updateDoc(cookRef, {
          ownerIds: arrayUnion(ownerId),
          updatedAt: new Date().toISOString()
        });

        // 2. Invalidate code
        await deleteDoc(inviteRef);

        // 3. Update local state
        const ownerSnap = await getDoc(doc(db, 'owners', ownerId));
        if (ownerSnap.exists()) {
          const data = ownerSnap.data();
          const newHouse: HouseholdMapping = {
            ownerId: ownerId,
            society: data.society || 'Unknown Society',
            tower: data.tower || '',
            flat: data.flat || ''
          };
          setHouseholds(prev => prev.find(h => h.ownerId === ownerId) ? prev : [...prev, newHouse]);
          setActiveOwnerId(ownerId);
        }
      }
      // Clear URL params
      setSearchParams({});
      setIsAddingNew(false);
    } catch (err) {
      console.error("Deep link connection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOwnerId) {
      localStorage.setItem('souschef_active_owner_id', activeOwnerId);
    } else {
      localStorage.removeItem('souschef_active_owner_id');
    }
  }, [activeOwnerId]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) throw new Error("Please enter your name");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create cook profile
        await setDoc(doc(db, 'cooks', userCredential.user.uid), {
          name: name,
          email: email,
          ownerIds: [],
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    
    try {
      const code = inviteCode.toUpperCase().trim();
      const inviteRef = doc(db, 'inviteCodes', code);
      const inviteSnap = await getDoc(inviteRef);
      
      if (!inviteSnap.exists()) {
        setError('Invalid kitchen code. Please check with the owner.');
        setLoading(false);
        return;
      }

      const { ownerId } = inviteSnap.data();

      // 1. Register this cook's UID with the owner
      const cookRef = doc(db, 'cooks', user.uid);
      await updateDoc(cookRef, {
        ownerIds: arrayUnion(ownerId),
        updatedAt: new Date().toISOString()
      });

      // 2. Invalidate the invite code (One-time use)
      await deleteDoc(inviteRef);

      // 3. Fetch owner details for UI
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId));
      if (ownerSnap.exists()) {
        const data = ownerSnap.data();
        const newHouse: HouseholdMapping = {
          ownerId: ownerId,
          society: data.society || 'Unknown Society',
          tower: data.tower || '',
          flat: data.flat || ''
        };
        
        if (!households.find(h => h.ownerId === ownerId)) {
          setHouseholds([...households, newHouse]);
        }
      }
      
      setActiveOwnerId(ownerId);
      setInviteCode('');
      setIsAddingNew(false);
    } catch (err: any) {
      console.error("Connection error:", err);
      setError(err.message || 'Failed to connect.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-orange-100 p-8">
          <div className="text-center mb-8">
            <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg rotate-3">
              <Home size={32} />
            </div>
            <h1 className="text-3xl font-black text-gray-900">Cook Portal</h1>
            <p className="text-gray-500 font-medium">Join a kitchen to start your shift</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={18} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-bold"
                    placeholder="Enter your name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-bold"
                  placeholder="cook@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-bold px-1">{error}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50 flex items-center justify-center"
            >
              {authLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-orange-600 text-sm font-bold hover:underline"
            >
              {authMode === 'login' ? "New here? Create an account" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard / Selection View
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
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <button 
              onClick={() => logout()}
              className="p-2 bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-inner"
              title="Sign Out"
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

  return (
    <div className="min-h-screen bg-orange-50 p-6 flex flex-col items-center">
      <div className="max-w-md w-full mt-8 text-center">
        <div className="bg-orange-500 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-3">
          <UserIcon size={40} strokeWidth={3} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2">Hi, {userProfile?.name?.split(' ')[0] || 'Cook'}!</h1>
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
                    placeholder="6-character code"
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
              
              <div className="flex flex-col gap-2 mt-4">
                {households.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="w-full text-center text-gray-400 hover:text-gray-600 font-bold text-sm"
                  >
                    Back to kitchen list
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full text-center text-red-400 hover:text-red-600 font-bold text-sm"
                >
                  Sign Out
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
