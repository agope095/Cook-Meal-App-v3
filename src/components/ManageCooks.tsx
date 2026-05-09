import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Users, UserPlus, Key, Trash2, CheckCircle, Copy, Share2, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { generateSecureCode } from '../utils/crypto';

interface InviteCode {
  code: string;
  createdAt: string;
  status: 'active' | 'used';
}

interface Cook {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface ManageCooksProps {
  householdId: string;
}

export default function ManageCooks({ householdId }: ManageCooksProps) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser || !householdId) return;

    // Real-time listener for invite codes
    const qCodes = query(collection(db, 'inviteCodes'), where('ownerId', '==', householdId));
    const unsubscribeCodes = onSnapshot(qCodes, (snapshot) => {
      const codes: InviteCode[] = [];
      snapshot.forEach((doc) => {
        codes.push({ code: doc.id, ...doc.data() } as InviteCode);
      });
      setInviteCodes(codes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    // Real-time listener for linked cooks
    const qCooks = query(collection(db, 'cooks'), where('ownerIds', 'array-contains', householdId));
    const unsubscribeCooks = onSnapshot(qCooks, (snapshot) => {
      const linkedCooks: Cook[] = [];
      snapshot.forEach((doc) => {
        linkedCooks.push({ id: doc.id, ...doc.data() } as Cook);
      });
      setCooks(linkedCooks);
    });

    return () => {
      unsubscribeCodes();
      unsubscribeCooks();
    };
  }, [householdId]);

  const generateInviteCode = async () => {
    if (!auth.currentUser || !householdId) return;
    setGenerating(true);
    
    try {
      const code = generateSecureCode(6);
      await setDoc(doc(db, 'inviteCodes', code), {
        ownerId: householdId,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
    } catch (error) {
      console.error("Error generating code:", error);
    } finally {
      setGenerating(false);
    }
  };

  const deleteInviteCode = async (code: string) => {
    try {
      await deleteDoc(doc(db, 'inviteCodes', code));
    } catch (error) {
      console.error("Error deleting code:", error);
    }
  };

  const handleUnlink = async (cookId: string) => {
    if (!householdId) return;
    if (!window.confirm("Are you sure you want to unlink this cook? they will lose access to your menu.")) return;
    
    try {
      await updateDoc(doc(db, 'cooks', cookId), {
        ownerIds: arrayRemove(householdId),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error unlinking cook:", error);
      alert("Failed to unlink cook.");
    }
  };

  const shareViaWhatsApp = (code: string) => {
    const url = `${window.location.origin}/cook?invite=${code}`;
    const text = `Hi! Join my kitchen on SousChefAI using this link: ${url}\nOr use code: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaText = (code: string) => {
    const url = `${window.location.origin}/cook?invite=${code}`;
    const text = `Join my kitchen on SousChefAI: ${url}`;
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/cook?invite=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-10 w-10 border-4 border-[var(--terracotta)] border-t-transparent mx-auto shadow-lg"
        />
      </div>
    );
  }

  return (
    <div className="bg-white/40 backdrop-blur-md rounded-[32px] shadow-sm border border-white/60 overflow-hidden mb-8 group">
      <div className="p-8 border-b border-[var(--cream-dark)]/50 flex justify-between items-center relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-32 h-32 bg-[var(--terracotta)]/5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] flex items-center">
            <Users className="mr-3 text-[var(--terracotta)]" />
            Manage Cooks
          </h2>
          <p className="text-[var(--warm-gray)] text-xs font-bold uppercase tracking-widest mt-1 opacity-60">Household Access Control</p>
        </div>
        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="flex items-center px-6 py-3 bg-[var(--charcoal)] text-white rounded-2xl hover:bg-[var(--charcoal-soft)] transition-all shadow-lg active:scale-95 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest"
        >
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Key size={16} className="mr-2 text-[var(--terracotta)]" />
          )}
          New Code
        </button>
      </div>

      <div className="p-8">
        <h3 className="text-[10px] font-black text-[var(--warm-gray)] uppercase tracking-widest mb-6 opacity-40">Active Invite Links</h3>
        {inviteCodes.filter(c => c.status === 'active').length === 0 ? (
          <p className="text-gray-500 italic mb-6">No active invite codes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {inviteCodes.filter(c => c.status === 'active').map((code) => (
              <div key={code.code} className="flex flex-col p-6 bg-[var(--terracotta)]/5 rounded-[28px] border border-[var(--terracotta)]/10 gap-4 shadow-sm relative overflow-hidden group/card">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <span className="text-2xl font-mono font-bold tracking-[0.2em] text-[var(--terracotta-deep)]">{code.code}</span>
                    <div className="text-[10px] uppercase font-black tracking-widest text-[var(--terracotta)] opacity-40 mt-1">One-time Use Code</div>
                  </div>
                  <button 
                    onClick={() => deleteInviteCode(code.code)}
                    className="p-2.5 text-[var(--warm-gray)] hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Revoke code"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                
                <div className="flex gap-2 relative z-10">
                  <button 
                    onClick={() => shareViaWhatsApp(code.code)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => copyToClipboard(code.code)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--charcoal)] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                    title="Copy Link"
                  >
                    {copiedCode === code.code ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {copiedCode === code.code ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Linked Cooks</h3>
        {cooks.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">No cooks are currently linked to your household.</p>
            <p className="text-sm text-gray-400 mt-1">Generate an invite code and share it with your cook.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {cooks.map((cook) => (
              <li key={cook.id} className="p-5 flex items-center justify-between bg-white/60 hover:bg-white transition-colors border border-transparent hover:border-[var(--cream-dark)] rounded-2xl mb-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--terracotta)]/10 flex items-center justify-center text-[var(--terracotta)] font-black text-xl shadow-inner">
                    {(cook.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--charcoal)]">{cook.name || 'Unnamed Cook'}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] opacity-60">{cook.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleUnlink(cook.id)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
