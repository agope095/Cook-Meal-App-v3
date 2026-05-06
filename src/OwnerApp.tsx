import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { LogIn, LogOut, User as UserIcon, Settings, Database, Home, Mail, Lock } from 'lucide-react';
import OwnerDashboard from './components/OwnerDashboard';
import ChatAssistant from './components/ChatAssistant';
import OwnerProfile from './components/OwnerProfile';
import ManageCooks from './components/ManageCooks';
import ManageFamily from './components/ManageFamily';
import { Calendar, Users, Heart } from 'lucide-react';

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

  useEffect(() => {
    // 1. Handle the redirect result first
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect auth error:", error);
    });

    // 2. Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
        try {
          // Check if they have an owner profile
          const ownerDoc = await getDoc(doc(db, 'owners', currentUser.uid));
          
          if (ownerDoc.exists()) {
             const ownerData = ownerDoc.data();
             setHouseholdId(ownerData?.joinedHouseholdId || currentUser.uid);
             setIsOwner(!!(ownerData?.pincode || ownerData?.joinedHouseholdId));
             setUserProfile(ownerData);
           } else {
             setHouseholdId(currentUser.uid);
             setIsOwner(false);
             setUserProfile(null);
           }
        } catch (error) {
          console.error("Owner check failed:", error);
          setHouseholdId(currentUser.uid);
          setIsOwner(false);
        }
      } else {
        setUser(null);
        setHouseholdId(null);
        setIsOwner(false);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
      <div className="flex items-center justify-center min-h-screen bg-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-orange-500 text-white p-2 rounded-lg">
                <UserIcon size={24} />
              </div>
              <span className="text-xl font-bold text-gray-900">SousChefAI</span>
            </Link>
            
            <div className="flex items-center gap-4">
              {user && (
                 <div className="relative">
                   <button
                     onClick={() => setIsMenuOpen(!isMenuOpen)}
                     className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-xl transition-all"
                   >
                     <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold">
                       {(userProfile?.name || user.displayName || user.email)?.[0].toUpperCase()}
                     </div>
                     <div className="hidden sm:block text-left">
                       <p className="text-xs font-black text-gray-900 leading-tight">
                         Hi, {(userProfile?.name || user.displayName || 'Friend').split(' ')[0]}
                       </p>
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Owner</p>
                     </div>
                     <Settings size={14} className={`text-gray-400 transition-transform ${isMenuOpen ? 'rotate-90' : ''}`} />
                   </button>

                   {isMenuOpen && (
                     <>
                       <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                       <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden">
                         <Link
                           to="/owner/profile"
                           onClick={() => setIsMenuOpen(false)}
                           className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                         >
                           <UserIcon size={18} />
                           Profile Settings
                         </Link>
                         <div className="h-px bg-gray-100 my-1"></div>
                         <button
                           onClick={() => { logout(); setIsMenuOpen(false); }}
                           className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                         >
                           <LogOut size={18} />
                           Sign Out
                         </button>
                       </div>
                     </>
                   )}
                 </div>
               )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {!user ? (
            <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
              <div className="text-center mb-8">
                <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="text-orange-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">SousChefAI</h2>
                <p className="text-gray-500 text-sm mt-1">Manage your kitchen with ease</p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setShowReset(true); setResetEmail(email); }}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Password Reset Section */}
                {showReset && (
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mb-4">
                    <h3 className="font-bold text-orange-900 mb-2 text-sm">Reset Password</h3>
                    {resetSent ? (
                      <p className="text-xs text-green-700">Check your email for instructions to reset your password.</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] text-orange-700 uppercase font-bold tracking-tight">Enter your email for reset link</p>
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
                          placeholder="your-email@example.com"
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleResetPassword(e as any)}
                            disabled={authLoading}
                            className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 disabled:opacity-50"
                          >
                            Send Reset Link
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReset(false)}
                            className="px-3 py-2 text-gray-500 hover:text-gray-700 text-xs"
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
                  className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-md"
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

              <div className="mt-6 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-orange-600 text-sm font-medium hover:underline"
                >
                  {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                </button>
              </div>
            </div>
          ) : !isOwner ? (
            <div className="max-w-4xl mx-auto py-8">
              <OwnerProfile onProfileComplete={() => setIsOwner(true)} onProfileUpdate={setUserProfile} />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 mb-8 max-w-fit">
                <Link
                  to="/owner"
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Calendar size={18} className="mr-2" />
                  Meal Planner
                </Link>
                <Link
                  to="/owner/cooks"
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Users size={18} className="mr-2" />
                  Manage Cooks
                </Link>
                <Link
                  to="/owner/family"
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Heart size={18} className="mr-2" />
                  Manage Family
                </Link>
                <Link
                  to="/owner/profile"
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Settings size={18} className="mr-2" />
                  Profile Settings
                </Link>
              </div>
              
              <Routes>
                <Route path="/" element={<OwnerDashboard householdId={householdId!} />} />
                <Route path="/cooks" element={<ManageCooks householdId={householdId!} />} />
                <Route path="/family" element={<ManageFamily householdId={householdId!} />} />
                <Route path="/profile" element={<OwnerProfile onProfileComplete={() => setIsOwner(true)} onProfileUpdate={setUserProfile} />} />
                <Route path="*" element={<Navigate to="/owner" replace />} />
              </Routes>
            </div>
          )}
        </main>
        
        {isOwner && <ChatAssistant householdId={householdId!} />}
      </div>
    );
}
