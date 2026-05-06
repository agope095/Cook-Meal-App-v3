import React, { useState, useEffect } from 'react';
import { auth, db, logout } from './firebase';
import { onAuthStateChanged, User, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
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

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(!!searchParams.get('invite'));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const cookDoc = await getDoc(doc(db, 'cooks', currentUser.uid));
          if (cookDoc.exists()) {
            const data = cookDoc.data();
            setUserProfile(data);
            
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

            const urlInvite = searchParams.get('invite');
            if (urlInvite) {
              await handleDeepLinkConnect(currentUser, urlInvite);
            }
          } else {
            // New cook through phone auth
            setUserProfile({ name: 'New Cook' });
            setHouseholds([]);
          }
        } catch (err) {
          console.error("Error fetching cook profile:", err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setHouseholds([]);
        setAuthStep('phone');
        setConfirmationResult(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const initRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          console.log("reCAPTCHA solved");
        }
      });
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      initRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      
      // Ensure phone number starts with + and country code
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone; // Default to India if no code
      }

      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setAuthStep('otp');
    } catch (err: any) {
      console.error("OTP Send Error:", err);
      setError(err.message || "Failed to send OTP. Please check the number.");
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      const result = await confirmationResult.confirm(verificationCode);
      const user = result.user;
      
      // Create profile if it doesn't exist
      const cookRef = doc(db, 'cooks', user.uid);
      const cookSnap = await getDoc(cookRef);
      if (!cookSnap.exists()) {
        await setDoc(cookRef, {
          phoneNumber: user.phoneNumber,
          ownerIds: [],
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error("OTP Verify Error:", err);
      setError("Invalid code. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeepLinkConnect = async (currentUser: User, code: string) => {
    try {
      setLoading(true);
      const inviteRef = doc(db, 'inviteCodes', code.toUpperCase());
      const inviteSnap = await getDoc(inviteRef);
      
      if (inviteSnap.exists()) {
        const { ownerId } = inviteSnap.data();
        const cookRef = doc(db, 'cooks', currentUser.uid);
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
          setHouseholds(prev => prev.find(h => h.ownerId === ownerId) ? prev : [...prev, newHouse]);
          setActiveOwnerId(ownerId);
        }
      }
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
      <div className="flex items-center justify-center min-h-screen bg-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
        <div id="recaptcha-container"></div>
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-orange-100 p-8">
          <div className="text-center mb-8">
            <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg rotate-3">
              <Home size={32} />
            </div>
            <h1 className="text-3xl font-black text-gray-900">Cook Portal</h1>
            <p className="text-gray-500 font-medium">
              {authStep === 'phone' ? 'Enter your phone to start' : 'Enter the 6-digit code'}
            </p>
          </div>

          {authStep === 'phone' ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">+91</span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-black text-xl tracking-widest"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs font-bold px-1">{error}</p>}

              <button
                type="submit"
                disabled={authLoading || phoneNumber.length < 10}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {authLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : (
                  <>
                    Send OTP
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Verification Code</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-black text-3xl tracking-[1rem] text-center"
                  placeholder="000000"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-bold px-1 text-center">{error}</p>}

              <button
                type="submit"
                disabled={authLoading || verificationCode.length < 6}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50 flex items-center justify-center"
              >
                {authLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => setAuthStep('phone')}
                className="w-full text-center text-orange-600 text-sm font-bold hover:underline mt-2"
              >
                Change Phone Number
              </button>
            </form>
          )}

          <p className="mt-8 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest leading-relaxed">
            By signing in, you agree to receive an SMS for verification. Standard rates apply.
          </p>
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
