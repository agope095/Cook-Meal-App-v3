import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { Calendar, Calendar as CalendarIcon, Users, Heart, LogIn, LogOut, User as UserIcon, Settings, Home, Mail, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OwnerDashboard from './components/OwnerDashboard';
import ChatAssistant from './components/ChatAssistant';
import OwnerProfile from './components/OwnerProfile';
import ManageCooks from './components/ManageCooks';
import ManageFamily from './components/ManageFamily';
import VerificationGate from './components/VerificationGate';

export default function OwnerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // 1. Handle the redirect result first
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect auth error:", error);
    });

    let unsubscribeProfile: (() => void) | null = null;

    // 2. Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        // Use a listener for real-time profile updates
        unsubscribeProfile = onSnapshot(doc(db, 'owners', currentUser.uid), async (ownerDoc) => {
          if (ownerDoc.exists()) {
            const ownerData = ownerDoc.data();
            setHouseholdId(ownerData?.joinedHouseholdId || currentUser.uid);
            setIsOwner(!!(ownerData?.pincode || ownerData?.joinedHouseholdId));
            setUserProfile(ownerData);

            // Determine verification state
            if (!currentUser.emailVerified && !currentUser.phoneNumber && !ownerData?.verified) {
              setNeedsVerification(true);
              setIsExistingUser(true);
            } else {
              setNeedsVerification(false);
            }
          } else {
            setHouseholdId(currentUser.uid);
            setIsOwner(false);
            setUserProfile(null);
            // New user, no profile yet — require verification
            if (!currentUser.emailVerified && !currentUser.phoneNumber) {
              setNeedsVerification(true);
              setIsExistingUser(false);
            }
          }
          setUser(currentUser);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setUser(null);
        setHouseholdId(null);
        setIsOwner(false);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send reset email.');
    } finally {
      setAuthLoading(false);
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (user && needsVerification) {
    return (
      <VerificationGate
        user={user}
        role="owner"
        isExistingUser={isExistingUser}
        onVerifyComplete={() => setNeedsVerification(false)}
        onSkip={() => setNeedsVerification(false)}
      />
    );
  }

  return (
    <div className="h-screen bg-[var(--cream)] paper-grain flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--cream-dark)] sticky top-0 z-40 transition-all shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link to="/owner" className="flex items-center gap-3 group">
              <div className="bg-[var(--charcoal)] text-[var(--paper)] p-2.5 rounded-2xl group-hover:rotate-6 transition-transform shadow-lg">
                <CalendarIcon size={24} />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight">SousChefAI</span>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--warm-gray)] -mt-1">Kitchen Management</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-6">
              {user && (
                 <div className="relative">
                   <button
                     onClick={() => setIsMenuOpen(!isMenuOpen)}
                     className="flex items-center gap-3 p-1.5 pr-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-100/50"
                   >
                     <div className="w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black shadow-md">
                       {(userProfile?.name || user.displayName || user.email)?.[0].toUpperCase()}
                     </div>
                     <div className="hidden md:block text-left">
                       <p className="text-xs font-black text-gray-900 leading-tight">
                         {(userProfile?.name || user.displayName || 'Owner').split(' ')[0]}
                       </p>
                       <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Household Admin</p>
                     </div>
                     <Settings size={14} className={`text-gray-400 transition-transform ${isMenuOpen ? 'rotate-90' : ''}`} />
                   </button>

                   <AnimatePresence>
                    {isMenuOpen && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsMenuOpen(false)}
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-64 bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 py-3 z-20 overflow-hidden"
                        >
                           <div className="px-5 py-4 border-b border-[var(--cream-dark)] mb-2">
                             <p className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] mb-1">Signed in as</p>
                             <p className="text-sm font-black text-[var(--charcoal)] truncate">{user.email}</p>
                           </div>
                           <Link
                             to="/owner/profile"
                             onClick={() => setIsMenuOpen(false)}
                             className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-[var(--charcoal)] hover:bg-[var(--cream)] transition-colors"
                           >
                             <div className="w-8 h-8 rounded-lg bg-[var(--sage)]/10 text-[var(--sage)] flex items-center justify-center">
                               <UserIcon size={18} />
                             </div>
                             Profile Settings
                           </Link>
                           
                           <Link
                             to="/cook"
                             onClick={() => setIsMenuOpen(false)}
                             className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-[var(--charcoal)] hover:bg-[var(--cream)] transition-colors"
                           >
                             <div className="w-8 h-8 rounded-lg bg-[var(--terracotta)]/10 text-[var(--terracotta)] flex items-center justify-center">
                               <Home size={18} />
                             </div>
                             Switch to Cook
                           </Link>

                           <div className="h-px bg-gray-50 my-2 mx-5"></div>
                           
                           <button
                             onClick={() => { logout(); setIsMenuOpen(false); }}
                             className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                           >
                             <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                               <LogOut size={18} />
                             </div>
                             Sign Out
                           </button>
                        </motion.div>
                      </>
                    )}
                   </AnimatePresence>
                 </div>
               )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {!user ? (
            <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(184,80,59,0.1)] border border-[var(--cream-dark)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--terracotta)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="text-center mb-8 relative z-10">
                <div className="bg-[var(--terracotta)] w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
                  <UserIcon className="text-white" size={32} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)]">SousChefAI</h2>
                <p className="text-[var(--charcoal-soft)] text-sm font-medium opacity-60 mt-1">Manage your kitchen with ease</p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--charcoal-soft)] mb-2 ml-1 opacity-50">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[var(--cream)]/50 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400 shadow-inner"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--charcoal-soft)] mb-2 ml-1 opacity-50">Password</label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setShowReset(true); setResetEmail(email); }}
                        className="text-xs text-[var(--terracotta)] hover:underline absolute right-0 -top-6"
                      >
                        Forgot Password?
                      </button>
                    )}
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--terracotta)] opacity-40 group-focus-within:opacity-100 transition-opacity" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[var(--cream)]/50 border-2 border-transparent rounded-2xl focus:border-[var(--terracotta)]/30 focus:bg-white outline-none transition-all font-bold text-[var(--charcoal)] placeholder:text-gray-400 shadow-inner"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Password Reset Section */}
                {showReset && (
                  <div className="p-5 bg-[var(--terracotta)]/5 rounded-2xl border border-[var(--terracotta)]/10 mb-6 relative overflow-hidden">
                    <h3 className="font-bold text-[var(--terracotta)] mb-2 text-sm">Reset Password</h3>
                    {resetSent ? (
                      <p className="text-xs text-[var(--sage)] font-bold">Check your email for reset instructions.</p>
                    ) : (
                      <div className="space-y-4">
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--cream-dark)] text-xs font-bold"
                          placeholder="your-email@example.com"
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleResetPassword(e as any)}
                            disabled={authLoading}
                            className="flex-1 py-2.5 bg-[var(--terracotta)] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--terracotta-deep)] disabled:opacity-50 transition-all shadow-md"
                          >
                            Send Reset Link
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReset(false)}
                            className="px-4 py-2.5 text-[var(--charcoal-soft)] hover:text-[var(--charcoal)] text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {authError && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[var(--terracotta)] text-white py-4 rounded-2xl font-black text-lg hover:bg-[var(--terracotta-deep)] transition-all shadow-[0_12px_24px_rgba(184,80,59,0.2)] hover:shadow-[0_16px_32px_rgba(184,80,59,0.3)] disabled:opacity-50"
                >
                  {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                onClick={loginWithGoogle}
                className="mt-6 w-full flex items-center justify-center gap-2 border border-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </button>

              <div className="mt-8 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-[var(--terracotta)] text-sm font-bold hover:underline opacity-80 hover:opacity-100"
                >
                  {authMode === 'login' ? "New here? Create an account" : "Already have an account? Sign In"}
                </button>
              </div>
            </div>
          ) : !isOwner ? (
            <div className="max-w-4xl mx-auto py-8">
              <OwnerProfile onProfileComplete={() => setIsOwner(true)} onProfileUpdate={setUserProfile} />
            </div>
          ) : (
            <div className="max-w-5xl mx-auto px-4 pb-32">
              <Routes>
                <Route path="/" element={<OwnerDashboard householdId={householdId!} />} />
                <Route path="/cooks" element={<ManageCooks householdId={householdId!} />} />
                <Route path="/family" element={<ManageFamily householdId={householdId!} />} />
                <Route path="/profile" element={<OwnerProfile onProfileComplete={() => setIsOwner(true)} onProfileUpdate={setUserProfile} />} />
                <Route path="*" element={<Navigate to="/owner" replace />} />
              </Routes>

              {/* Bottom Navigation for Mobile / Fixed Navigation for Desktop */}
              <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--charcoal)]/90 backdrop-blur-xl border border-white/10 px-3 py-3 rounded-[32px] shadow-2xl z-50 flex items-center gap-2">
                {[
                  { to: '/owner', icon: Calendar, label: 'Planner' },
                  { to: '/owner/cooks', icon: Users, label: 'Cooks' },
                  { to: '/owner/family', icon: Heart, label: 'Family' },
                  { to: '/owner/profile', icon: Settings, label: 'Settings' }
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[24px] transition-all relative ${
                      location.pathname.replace(/\/$/, '') === item.to.replace(/\/$/, '')
                        ? 'bg-[var(--paper)] text-[var(--charcoal)] shadow-lg scale-105' 
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${location.pathname === item.to ? 'block' : 'hidden md:block'}`}>
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </main>
        
        {isOwner && <ChatAssistant householdId={householdId!} />}
      </div>
    );
}
