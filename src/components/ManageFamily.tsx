import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Users, Plus, Trash2, Save, CheckCircle, Mail, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface FamilyMember {
  id: string;
  name: string;
  preferences: string;
}

interface ManageFamilyProps {
  householdId: string;
}

export default function ManageFamily({ householdId }: ManageFamilyProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPreferences, setNewPreferences] = useState('');
  
  // Invite logic
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<{uid: string, email: string, name: string}[]>([]);

  useEffect(() => {
    const fetchFamily = async () => {
      if (!auth.currentUser || !householdId) return;
      try {
        const docRef = doc(db, 'owners', householdId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.familyMembers) setMembers(data.familyMembers);
          if (data.authorizedEmails) setAuthorizedEmails(data.authorizedEmails);
          if (data.authorizedUsers) setAuthorizedUsers(data.authorizedUsers);
        }
      } catch (error) {
        console.error("Error fetching family:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFamily();
  }, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !auth.currentUser || !householdId) return;
    if (auth.currentUser.uid !== householdId) {
      alert("Only the primary owner can send invites.");
      return;
    }
    if (authorizedEmails.length + authorizedUsers.length >= 4) {
      alert("You can have a maximum of 4 family members.");
      return;
    }
    
    setInviting(true);
    try {
      const email = inviteEmail.trim().toLowerCase();
      const ownerRef = doc(db, 'owners', householdId);
      await setDoc(ownerRef, {
        authorizedEmails: arrayUnion(email)
      }, { merge: true });
      
      setAuthorizedEmails(prev => [...prev, email]);
      setInviteEmail('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error sending invite:", error);
    } finally {
      setInviting(false);
    }
  };

  const removeInvite = async (email: string) => {
    if (!auth.currentUser || !householdId) return;
    if (auth.currentUser.uid !== householdId) {
      alert("Only the primary owner can remove invites.");
      return;
    }
    try {
      const ownerRef = doc(db, 'owners', householdId);
      await setDoc(ownerRef, {
        authorizedEmails: arrayRemove(email)
      }, { merge: true });
      setAuthorizedEmails(prev => prev.filter(e => e !== email));
    } catch (error) {
      console.error("Error removing invite:", error);
    }
  };

  const removeUser = async (uid: string) => {
    if (!auth.currentUser || !householdId) return;
    if (auth.currentUser.uid !== householdId) {
      alert("Only the primary owner can remove members.");
      return;
    }
    const userToRemove = authorizedUsers.find(u => u.uid === uid);
    if (!userToRemove) return;
    
    try {
      const ownerRef = doc(db, 'owners', householdId);
      await setDoc(ownerRef, {
        authorizedUsers: arrayRemove(userToRemove),
        authorizedEmails: arrayRemove(userToRemove.email.toLowerCase()),
        authorizedUids: arrayRemove(uid)
      }, { merge: true });
      setAuthorizedUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  const saveToFirestore = async (updatedMembers: FamilyMember[]) => {
    if (!auth.currentUser || !householdId) return;
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'owners', householdId), {
        familyMembers: updatedMembers
      }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving family:", error);
    } finally {
      setSaving(false);
    }
  };

  const addMember = () => {
    if (!newName.trim()) return;

    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: newName.trim(),
      preferences: newPreferences.trim()
    };

    const updatedMembers = [...members, newMember];
    setMembers(updatedMembers);
    saveToFirestore(updatedMembers);

    setNewName('');
    setNewPreferences('');
  };

  const removeMember = (id: string) => {
    const updatedMembers = members.filter(m => m.id !== id);
    setMembers(updatedMembers);
    saveToFirestore(updatedMembers);
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
        <div className="absolute -right-12 -top-12 w-32 h-32 bg-[var(--sage)]/5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] flex items-center">
            <Users className="mr-3 text-[var(--sage)]" />
            Family Members
          </h2>
          <p className="text-[var(--warm-gray)] text-xs font-bold uppercase tracking-widest mt-1 opacity-60">Dietary Profiles & Collaboration</p>
        </div>
        {success && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center text-[var(--sage)] bg-[var(--sage)]/5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-[var(--sage)]/10">
            <CheckCircle size={14} className="mr-1.5" /> Saved
          </motion.div>
        )}
      </div>

      <div className="p-6">
        {/* Collaboration Section */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4">
            <Mail className="mr-2 text-indigo-500" size={20} />
            Collaborative Access
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            Invite up to 4 family members to manage meal plans with you. They must log in with the email address you invite.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <div className="relative flex-1 group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sage)] opacity-40 group-focus-within:opacity-100 transition-all" size={18} />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="family-member@email.com"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[var(--cream)]/30 border-2 border-transparent focus:border-[var(--sage)]/20 focus:bg-white focus:outline-none transition-all font-bold text-[var(--charcoal)] shadow-inner"
                disabled={authorizedEmails.length + authorizedUsers.length >= 4}
              />
            </div>
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim() || authorizedEmails.length + authorizedUsers.length >= 4}
              className="px-8 py-3.5 bg-[var(--charcoal)] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--charcoal-soft)] disabled:opacity-50 flex items-center justify-center shadow-lg transition-all active:scale-95"
            >
              <Plus size={18} className="mr-2 text-[var(--sage)]" />
              Invite
            </button>
          </div>

          <div className="space-y-4">
            {authorizedEmails.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Pending Invites</h4>
                <div className="space-y-2">
                  {authorizedEmails.map(email => (
                    <div key={email} className="flex items-center justify-between bg-[var(--terracotta)]/5 p-4 rounded-2xl border border-[var(--terracotta)]/10 group/invite">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[var(--terracotta)] shadow-sm">
                           <Mail size={14} />
                        </div>
                        <span className="text-sm font-bold text-[var(--charcoal)]">{email}</span>
                      </div>
                      <button
                        onClick={() => removeInvite(email)}
                        className="text-[var(--warm-gray)] hover:text-red-500 p-2 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg outline-none"
                        aria-label={`Remove pending invite for ${email}`}
                        title="Remove invite"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {authorizedUsers.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Active Family Members</h4>
                <div className="space-y-2">
                  {authorizedUsers.map(user => (
                    <div key={user.uid} className="flex items-center justify-between bg-[var(--sage)]/5 p-4 rounded-2xl border border-[var(--sage)]/10 group/member">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--sage)] shadow-sm font-black">
                           {user.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[var(--charcoal)]">{user.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)] opacity-60">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeUser(user.uid)}
                        className="text-[var(--warm-gray)] hover:text-red-500 p-2 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg outline-none"
                        aria-label={`Remove access for ${user.email}`}
                        title="Remove user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gray-100 mb-10"></div>

        <div className="bg-[var(--cream)]/30 p-8 rounded-[32px] border border-[var(--cream-dark)]/50 mb-6">
          <h3 className="text-[10px] font-black text-[var(--warm-gray)] uppercase tracking-widest mb-6 opacity-60">Add Member Profile (for Cook)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Grandma)"
              className="w-full px-5 py-3 rounded-2xl bg-white border-2 border-transparent focus:border-[var(--sage)]/20 focus:outline-none transition-all font-bold text-[var(--charcoal)] shadow-sm"
            />
            <input
              type="text"
              value={newPreferences}
              onChange={(e) => setNewPreferences(e.target.value)}
              placeholder="Dietary Notes (e.g. No salt, pure veg)"
              className="w-full px-5 py-3 rounded-2xl bg-white border-2 border-transparent focus:border-[var(--sage)]/20 focus:outline-none transition-all font-bold text-[var(--charcoal)] shadow-sm"
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
            />
          </div>
          <button
            onClick={addMember}
            disabled={!newName.trim() || saving}
            className="w-full py-4 bg-[var(--charcoal)] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--charcoal-soft)] disabled:opacity-50 flex items-center justify-center shadow-lg transition-all active:scale-95"
          >
            <Plus size={18} className="mr-2 text-[var(--terracotta)]" /> Add Profile
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">No member profiles added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((member) => (
              <li key={member.id} className="py-4 flex justify-between items-start">
                <div>
                  <p className="font-bold text-[var(--charcoal)] text-lg">{member.name}</p>
                  {member.preferences && (
                    <p className="text-xs font-bold text-[var(--terracotta)] mt-1.5 bg-[var(--terracotta)]/5 inline-block px-3 py-1 rounded-full border border-[var(--terracotta)]/10">
                      {member.preferences}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-red-500 outline-none"
                  aria-label={`Delete family member profile for ${member.name}`}
                  title="Delete member"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
