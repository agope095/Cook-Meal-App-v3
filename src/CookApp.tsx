import React, { useState, useEffect } from 'react';
import { auth, db, logout, loginWithGoogle } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, updateDoc, deleteDoc, arrayRemove, onSnapshot, query, collection, where, documentId, getDocs } from 'firebase/firestore';
import { useSearchParams, Link } from 'react-router-dom';
import CookView from './components/CookView';
import VerificationGate from './components/VerificationGate';
import { Home, PlusCircle, LogOut, ChevronRight, MapPin, Building2, User as UserIcon, Mail, Lock, Sparkles, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [error, setError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(!!searchParams.get('invite'));
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isExistingCook, setIsExistingCook] = useState(false);

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        unsubscribeProfile = onSnapshot(doc(db, 'cooks', currentUser.uid), async (cookDoc) => {
          if (cookDoc.exists()) {
            const data = cookDoc.data();
            setUserProfile(data);

            if (!currentUser.emailVerified && !currentUser.phoneNumber && !data?.verified) {
              setNeedsVerification(true);
              setIsExistingCook(true);
            } else {
              setNeedsVerification(false);
            }

            if (data.ownerIds && data.ownerIds.length > 0) {
              const houses: HouseholdMapping[] = [];
              const ownersQuery = query(
                collection(db, 'owners'),
                where(documentId(), 'in', data.ownerIds)
              );
              const ownersSnap = await getDocs(ownersQuery);
              ownersSnap.forEach(ownerDoc => {
                const oData = ownerDoc.data();
                houses.push({
                  ownerId: ownerDoc.id,
                  society: oData.society || 'Unknown Society',
                  tower: oData.tower || '',
                  flat: oData.flat || ''
                });
              });
              setHouseholds(houses);
            } else {
              setHouseholds([]);
            }
          } else {
            const newProfile = {
              name: currentUser.displayName || 'New Cook',
              email: currentUser.email,
              ownerIds: [],
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'cooks', currentUser.uid), newProfile);
            
            if (!currentUser.emailVerified && !currentUser.phoneNumber) {
              setNeedsVerification(true);
              setIsExistingCook(false);
            }
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setUser(null);
        setUserProfile(null);
        setHouseholds([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    const urlInvite = searchParams.get('invite');
    const isVerified = user?.emailVerified || user?.phoneNumber || userProfile?.verified;
    if (user && urlInvite && !loading && isVerified) {
      handleDeepLinkConnect(user, urlInvite);
    }
  }, [user, searchParams, loading, userProfile]);

  const handleDeepLinkConnect = async (currentUser: User, code: string) => {
    try {
      setLoading(true);
      const inviteRef = doc(db, 'inviteCodes', code.toUpperCase().trim());
      const inviteSnap = await getDoc(inviteRef);
      
      if (!inviteSnap.exists()) {
        setError('This invite link is invalid or has already been used.');
        setSearchParams({});
        setLoading(false);
        return;
      }

      const { ownerId } = inviteSnap.data();
      const cookRef = doc(db, 'cooks', currentUser.uid);
      const cookSnap = await getDoc(cookRef);
      if (!cookSnap.exists()) {
        await setDoc(cookRef, {
          name: name || 'New Cook',
          email: currentUser.email,
          ownerIds: [ownerId],
          createdAt: new Date().toISOString()
        });
      } else {
        await updateDoc(cookRef, {
          ownerIds: arrayUnion(ownerId),
          updatedAt: new Date().toISOString()
        });
      }

      await deleteDoc(inviteRef);

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
      
      setSearchParams({});
      setIsAddingNew(false);
    } catch (err: any) {
      console.error("Deep link connection failed:", err);
      setError(err.message || 'Failed to connect via link.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveKitchen = async (ownerId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to leave this kitchen? You will no longer have access to their menu.")) return;
    
    try {
      setLoading(true);
      const cookRef = doc(db, 'cooks', user.uid);
      await updateDoc(cookRef, {
        ownerIds: arrayRemove(ownerId),
        updatedAt: new Date().toISOString()
      });
      
      if (activeOwnerId === ownerId) {
        setActiveOwnerId(null);
      }
      
      setHouseholds(prev => prev.filter(h => h.ownerId !== ownerId));
    } catch (err: any) {
      console.error("Failed to leave kitchen:", err);
      setError(err.message || 'Failed to leave kitchen.');
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
        if (!name.trim()) throw new Error("Please enter your name");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'cooks', userCredential.user.uid), {
          name: name.trim(),
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

  const handleManualConnect = async (e: React.FormEvent) => {
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
      const cookRef = doc(db, 'cooks', user.uid);
      
      await updateDoc(cookRef, {
        ownerIds: arrayUnion(ownerId),
        updatedAt: new Date().toISOString()
      });
      
      await deleteDoc(inviteRef);

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
      <div className="flex items-center justify-center min-h-screen bg-[var(--cream)] paper-grain">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-12 w-12 border-4 border-[var(--terracotta)] border-t-transparent shadow-xl"
        />
      </div>
    );
  }

  if (user && needsVerification) {
    return (
      <VerificationGate
        user={user}
        role="cook"
        isExistingUser={isExistingCook}
        onVerifyComplete={() => setNeedsVerification(false)}
        onSkip={() => setNeedsVerification(false)}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--cream)] paper-grain flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(184,80,59,0.15)] border border-[var(--cream-dark)] p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--terracotta)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="text-center mb-10 relative z-10">
            <div className="bg-[var(--terracotta)] w-20 h-20 rounded-[28px] flex items-center justify-center text-white mx-auto mb-6 shadow-[0_12px_24px_rgba(184,80,59,0.3)] rotate-3 animate-float-slow">
              <ChefHat size={40} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight">Cook Portal</h1>
            <p className="text-[var(--charcoal-soft)] font-medium opacity-60">Join a kitchen to start your shift</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6 relative z-10">
            <AnimatePresence mode="wait">
              {authMode === 'register' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--charcoal-soft)] mb-2 ml-1 opacity-50">Full Name</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={20} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--cream)]/50 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400 shadow-inner"
                      placeholder="Enter your name"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--charcoal-soft)] mb-2 ml-1 opacity-50">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-[var(--cream)]/50 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400 shadow-inner"
                  placeholder="cook@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--charcoal-soft)] mb-2 ml-1 opacity-50">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-[var(--cream)]/50 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400 shadow-inner"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-[var(--terracotta)] text-xs font-bold px-1">{error}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[var(--terracotta)] text-white py-5 rounded-2xl font-black text-lg hover:bg-[var(--terracotta-deep)] transition-all shadow-[0_12px_24px_rgba(184,80,59,0.2)] hover:shadow-[0_16px_32px_rgba(184,80,59,0.3)] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {authLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-[var(--terracotta)] text-sm font-bold hover:underline opacity-80 hover:opacity-100"
            >
              {authMode === 'login' ? "New here? Create an account" : "Already have an account? Sign In"}
            </button>
          </div>

          <div className="mt-10 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--cream-dark)]"></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="px-4 bg-white text-gray-400 font-black uppercase tracking-widest">Secure Login</span>
            </div>
          </div>

          <button
            onClick={loginWithGoogle}
            className="mt-8 w-full flex items-center justify-center gap-3 bg-white border-2 border-[var(--cream-dark)] py-4 rounded-2xl font-bold text-[var(--charcoal)] hover:bg-[var(--cream)] transition-all shadow-sm group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (activeOwnerId && !isAddingNew) {
    const activeHouse = households.find(h => h.ownerId === activeOwnerId);
    return (
      <div className="min-h-screen bg-[var(--cream)] paper-grain flex flex-col">
        {/* Conduct-style Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--cream-dark)] p-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <Link to="/owner" className="p-2 bg-[var(--cream)] rounded-xl text-[var(--charcoal-soft)] hover:bg-[var(--cream-dark)] transition-colors shadow-inner">
              <Home size={20} />
            </Link>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--terracotta)] opacity-60">Chef Mode</span>
              <span className="font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight">SousChefAI</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end text-[10px] uppercase tracking-tighter opacity-70 leading-tight mr-2">
              <span className="font-black text-[var(--charcoal)]">{activeHouse?.society}</span>
              <span className="font-bold text-[var(--terracotta)]">{activeHouse?.tower} {activeHouse?.flat}</span>
            </div>
            <button 
              onClick={() => setActiveOwnerId(null)}
              className="p-3 bg-[var(--cream)] text-[var(--charcoal-soft)] rounded-xl hover:bg-[var(--cream-dark)] transition-colors shadow-inner flex items-center gap-2"
              title="Switch Kitchen"
            >
              <ChevronRight size={18} className="rotate-180" />
              <span className="hidden md:inline text-xs font-black uppercase tracking-widest">Switch</span>
            </button>
            <button 
              onClick={() => logout()}
              className="p-3 bg-[var(--terracotta)]/10 text-[var(--terracotta)] rounded-xl hover:bg-[var(--terracotta)] hover:text-white transition-all shadow-sm"
              title="Sign Out"
            >
              <LogOut size={18} />
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
    <div className="min-h-screen bg-[var(--cream)] paper-grain p-6 flex flex-col items-center">
      <div className="max-w-md w-full mt-12 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[var(--terracotta)] w-24 h-24 rounded-[32px] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl rotate-3"
        >
          <UserIcon size={48} strokeWidth={2.5} />
        </motion.div>
        
        <motion.h1 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-3 tracking-tight"
        >
          Hi, {userProfile?.name?.split(' ')[0] || 'Chef'}!
        </motion.h1>
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-[var(--charcoal-soft)] font-medium mb-12 opacity-60"
        >
          Select a kitchen to start your shift
        </motion.p>

        {households.length > 0 && !isAddingNew ? (
          <div className="space-y-4 text-left">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--charcoal-soft)] ml-4 mb-4 opacity-40">Connected Kitchens</h2>
            <div className="stagger">
              {households.map((h, idx) => (
                <motion.div 
                  key={h.ownerId} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="relative group mb-4"
                >
                  <button
                    onClick={() => setActiveOwnerId(h.ownerId)}
                    className="w-full bg-white p-6 rounded-[32px] border border-transparent hover:border-[var(--terracotta)]/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(184,80,59,0.1)] transition-all flex items-center justify-between group-hover:pr-20"
                  >
                    <div className="flex items-center gap-5">
                      <div className="bg-[var(--cream)] p-4 rounded-2xl text-[var(--terracotta)] group-hover:bg-[var(--terracotta)] group-hover:text-white transition-all shadow-inner">
                        <Building2 size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="font-[var(--font-display)] font-bold text-[var(--charcoal)] text-xl text-left tracking-tight">{h.society}</p>
                        <p className="text-[10px] font-black text-[var(--charcoal-soft)] uppercase tracking-widest opacity-40 text-left mt-1">
                          {h.tower} • {h.flat}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="text-gray-300 group-hover:text-[var(--terracotta)] group-hover:translate-x-1 transition-all" size={24} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLeaveKitchen(h.ownerId);
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                    title="Leave Kitchen"
                  >
                    <LogOut size={22} />
                  </button>
                </motion.div>
              ))}
            </div>
            
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => setIsAddingNew(true)}
              className="w-full mt-8 flex items-center justify-center gap-3 p-6 border-2 border-dashed border-[var(--cream-dark)] rounded-[32px] text-[var(--charcoal-soft)] opacity-50 hover:opacity-100 hover:text-[var(--terracotta)] hover:border-[var(--terracotta)]/30 transition-all font-bold group"
            >
              <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-sm font-black uppercase tracking-widest">Connect Another Kitchen</span>
            </motion.button>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-[var(--cream-dark)] w-full text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--terracotta)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] mb-2 tracking-tight relative z-10">Connect Kitchen</h2>
            <p className="text-[10px] font-black text-[var(--charcoal-soft)] mb-10 uppercase tracking-widest opacity-40 relative z-10">Enter the code from the owner app</p>
            
            <form onSubmit={handleManualConnect} className="space-y-6 relative z-10">
              <div>
                <div className="relative group">
                  <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={24} />
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 bg-[var(--cream)]/50 border-2 border-transparent rounded-[24px] focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] text-xl placeholder:text-gray-300 shadow-inner"
                    placeholder="6-character code"
                  />
                </div>
                {error && <p className="mt-3 text-[var(--terracotta)] text-xs font-bold px-5">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={authLoading || !inviteCode.trim()}
                className="w-full bg-[var(--terracotta)] text-white py-5 rounded-[24px] font-black text-lg hover:bg-[var(--terracotta-deep)] transition-all shadow-[0_12px_24px_rgba(184,80,59,0.2)] hover:shadow-[0_16px_32px_rgba(184,80,59,0.3)] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {authLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : (
                  <>
                    <Sparkles size={20} />
                    <span>Connect & Open Menu</span>
                  </>
                )}
              </button>
              
              <div className="flex flex-col gap-4 mt-6">
                {households.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="w-full text-center text-[var(--charcoal-soft)] opacity-40 hover:opacity-100 font-black text-[10px] uppercase tracking-widest transition-opacity"
                  >
                    Back to kitchen list
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full text-center text-red-300 hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
