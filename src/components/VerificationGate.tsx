import React, { useState, useEffect, useCallback } from 'react';
import { User, sendEmailVerification, RecaptchaVerifier, linkWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ShieldCheck, Mail, Phone, Send, RefreshCw, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

interface VerificationGateProps {
  user: User;
  role: 'owner' | 'cook';
  isExistingUser?: boolean;
  onVerifyComplete: () => void;
  onSkip: () => void;
}

type VerifyStep = 'choose' | 'email-sent' | 'phone-input' | 'phone-otp' | 'complete';

export default function VerificationGate({
  user,
  role,
  isExistingUser = false,
  onVerifyComplete,
  onSkip,
}: VerificationGateProps) {
  const [step, setStep] = useState<VerifyStep>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Check if email or phone is already verified on mount
  useEffect(() => {
    if (user.emailVerified || user.phoneNumber) {
      markVerified(user.emailVerified ? 'email' : 'phone');
      onVerifyComplete();
    }
  }, []);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        } catch (e) {
          console.warn("Recaptcha cleanup error", e);
        }
      }
    };
  }, []);

  // Cooldown timer logic
  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const markVerified = async (method: 'email' | 'phone') => {
    try {
      const collection = role === 'owner' ? 'owners' : 'cooks';
      const ref = doc(db, collection, user.uid);
      await setDoc(ref, {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedMethod: method,
      }, { merge: true });
    } catch (e) {
      console.warn('Failed to write verified flag:', e);
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    setError('');
    try {
      await sendEmailVerification(user);
      setStep('email-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0) return;
    setResent(false);
    setError('');
    try {
      await sendEmailVerification(user);
      setResent(true);
      setCooldown(60);
      setTimeout(() => setResent(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend.');
    }
  };

  const handleCheckEmailVerified = async () => {
    setChecking(true);
    try {
      await user.reload();
      const freshUser = auth.currentUser;
      if (freshUser?.emailVerified) {
        await markVerified('email');
        setStep('complete');
        setTimeout(onVerifyComplete, 1200);
      } else {
        setError('Email not verified yet. Check your inbox and click the link, then try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check verification status.');
    } finally {
      setChecking(false);
    }
  };

  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) return;
    try {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
      });
    } catch (err) {
      console.error("Recaptcha setup failed", err);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setLoading(true);
    setError('');
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setStep('phone-otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Make sure the number is in international format (e.g. +91...)');
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;
    setChecking(true);
    setError('');
    try {
      await confirmationResult.confirm(otp);
      await markVerified('phone');
      setStep('complete');
      setTimeout(onVerifyComplete, 1200);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (isExistingUser) {
    return (
      <div className="fixed inset-0 bg-black/30 z-40 flex items-end sm:items-center justify-center p-4">
        <div id="recaptcha-container"></div>
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl p-6 sm:p-8 animate-slide-up">
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-amber-100 p-3 rounded-2xl shrink-0">
              <ShieldCheck size={24} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Secure Your Account</h2>
              <p className="text-sm text-gray-500 mt-1">
                Verify your email or phone to protect your data and access all features. Unverified accounts may face access restrictions.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
          )}

          <div className="space-y-3">
            {step === 'choose' && (
              <>
                <button
                  onClick={handleSendEmail}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <Mail size={20} />
                  {loading ? 'Sending...' : 'Verify with Email'}
                </button>
                <button
                  onClick={() => setStep('phone-input')}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-orange-100 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors"
                >
                  <Phone size={20} />
                  Verify with Phone
                </button>
              </>
            )}

            {step === 'phone-input' && (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-orange-500 outline-none transition-all font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
                <button onClick={() => setStep('choose')} className="w-full text-xs text-gray-400 font-bold">Back</button>
              </form>
            )}

            {step === 'phone-otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input
                  type="text"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-orange-500 outline-none transition-all font-bold text-center tracking-[0.5em]"
                  maxLength={6}
                  required
                />
                <button
                  type="submit"
                  disabled={checking}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  {checking ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            )}

            <button
              onClick={onSkip}
              className="w-full py-3 px-4 text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // New user — required verification
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-6">
      <div id="recaptcha-container"></div>
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-orange-100 p-8">
        {(step === 'choose' || step === 'phone-input') && (
          <>
            <div className="text-center mb-8">
              <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} className="text-orange-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900">Verify Your Account</h2>
              <p className="text-gray-500 font-medium mt-2">
                Choose how you'd like to verify. Required to access all features.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
            )}

            <div className="space-y-4">
              {step === 'choose' ? (
                <>
                  <button
                    onClick={handleSendEmail}
                    disabled={loading}
                    className="w-full flex items-center gap-4 p-5 bg-orange-50 border-2 border-orange-100 rounded-2xl hover:border-orange-500 transition-all group disabled:opacity-50"
                  >
                    <div className="bg-orange-100 p-3 rounded-xl text-orange-600 group-hover:bg-orange-200 transition-colors">
                      <Mail size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-800">Email Verification</p>
                      <p className="text-sm text-gray-500">
                        {loading ? 'Sending link...' : `Send a link to ${user.email}`}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setStep('phone-input')}
                    className="w-full flex items-center gap-4 p-5 bg-white border-2 border-gray-100 rounded-2xl hover:border-orange-500 transition-all group"
                  >
                    <div className="bg-gray-100 p-3 rounded-xl text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                      <Phone size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-800">Phone Verification</p>
                      <p className="text-sm text-gray-500">Fast OTP verification</p>
                    </div>
                  </button>
                </>
              ) : (
                <form onSubmit={handleSendOtp} className="space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                     <button onClick={() => setStep('choose')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                       <ArrowLeft size={20} className="text-gray-400" />
                     </button>
                     <span className="font-bold text-gray-600">Enter Phone Number</span>
                   </div>
                   <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-lg"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50"
                  >
                    {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {step === 'phone-otp' && (
          <div className="text-center">
            <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Phone size={36} className="text-orange-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Enter OTP</h2>
            <p className="text-gray-500 font-medium mb-6">
              We sent a 6-digit code to<br />
              <strong className="text-gray-700">{phoneNumber}</strong>
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-orange-500 focus:bg-white outline-none transition-all font-black text-3xl text-center tracking-[0.5em]"
                maxLength={6}
                required
              />
              <button
                type="submit"
                disabled={checking}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200 disabled:opacity-50"
              >
                {checking ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep('phone-input')}
                className="w-full py-2 text-gray-400 font-bold text-sm"
              >
                Change Number
              </button>
            </form>
          </div>
        )}

        {step === 'email-sent' && (
          <div className="text-center">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Send size={36} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Check Your Inbox</h2>
            <p className="text-gray-500 font-medium mb-6">
              We sent a verification link to<br />
              <strong className="text-gray-700">{user.email}</strong>
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCheckEmailVerified}
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {checking ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <CheckCircle size={20} />
                )}
                {checking ? 'Checking...' : "I've Verified My Email"}
              </button>

              <button
                onClick={handleResendEmail}
                disabled={cooldown > 0}
                className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {resent ? 'Sent!' : cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get the email? Resend"}
              </button>
              
              <button
                onClick={() => setStep('choose')}
                className="w-full py-2 text-gray-400 font-bold text-xs uppercase tracking-widest"
              >
                Try Phone Instead
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Verified!</h2>
            <p className="text-gray-500 font-medium">Setting up your account...</p>
          </div>
        )}
      </div>
    </div>
  );
}