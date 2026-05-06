import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Users, UserPlus, Key, Trash2, CheckCircle, Copy, Share2, MessageCircle } from 'lucide-react';

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
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Users className="mr-2 text-indigo-500" />
            Manage Cooks
          </h2>
          <p className="text-gray-500 text-sm mt-1">Generate invite codes to link your cook to your household.</p>
        </div>
        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Key size={16} className="mr-2" />
          )}
          Generate Code
        </button>
      </div>

      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Active Invite Links</h3>
        {inviteCodes.filter(c => c.status === 'active').length === 0 ? (
          <p className="text-gray-500 italic mb-6">No active invite codes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {inviteCodes.filter(c => c.status === 'active').map((code) => (
              <div key={code.code} className="flex flex-col p-4 bg-indigo-50 rounded-2xl border border-indigo-100 gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-mono font-bold tracking-widest text-indigo-700">{code.code}</span>
                    <div className="text-[10px] uppercase font-black tracking-tighter text-indigo-400 mt-1">One-time Use</div>
                  </div>
                  <button 
                    onClick={() => deleteInviteCode(code.code)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Revoke code"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => shareViaWhatsApp(code.code)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-colors shadow-sm"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => shareViaText(code.code)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    <Share2 size={14} />
                    SMS
                  </button>
                  <button 
                    onClick={() => copyToClipboard(code.code)}
                    className="p-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm"
                    title="Copy Link"
                  >
                    {copiedCode === code.code ? <CheckCircle size={16} /> : <Copy size={16} />}
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
              <li key={cook.id} className="p-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                    {cook.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{cook.name}</p>
                    <p className="text-sm text-gray-500">{cook.email}</p>
                  </div>
                </div>
                <button className="text-sm text-red-600 hover:text-red-800 font-medium">
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
