import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Users, Plus, Trash2, Save, CheckCircle, Mail, UserCheck } from 'lucide-react';

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
        authorizedEmails: arrayRemove(userToRemove.email.toLowerCase())
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
    return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Users className="mr-2 text-indigo-500" />
            Family Members
          </h2>
          <p className="text-gray-500 text-sm mt-1">Add family members and their dietary preferences for your cook to see.</p>
        </div>
        {success && (
          <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
            <CheckCircle size={16} className="mr-1" /> Saved
          </div>
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

          <div className="flex gap-3 mb-8">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="family-member@email.com"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
              disabled={authorizedEmails.length + authorizedUsers.length >= 4}
            />
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim() || authorizedEmails.length + authorizedUsers.length >= 4}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center"
            >
              <Plus size={18} className="mr-1" />
              Invite
            </button>
          </div>

          <div className="space-y-4">
            {authorizedEmails.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Pending Invites</h4>
                <div className="space-y-2">
                  {authorizedEmails.map(email => (
                    <div key={email} className="flex items-center justify-between bg-orange-50 p-3 rounded-lg border border-orange-100">
                      <span className="text-sm font-medium text-orange-800">{email}</span>
                      <button onClick={() => removeInvite(email)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
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
                    <div key={user.uid} className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-100">
                      <div className="flex items-center">
                        <UserCheck size={18} className="text-green-600 mr-2" />
                        <div>
                          <p className="text-sm font-bold text-green-900">{user.name}</p>
                          <p className="text-xs text-green-700">{user.email}</p>
                        </div>
                      </div>
                      <button onClick={() => removeUser(user.uid)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-gray-100 mb-10"></div>

        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6">
          <h3 className="text-sm font-bold text-indigo-800 mb-3">Add Member Profile (for Cook)</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Grandma)"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={newPreferences}
              onChange={(e) => setNewPreferences(e.target.value)}
              placeholder="Dietary Notes (e.g. No salt, pure veg)"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
            />
            <button
              onClick={addMember}
              disabled={!newName.trim() || saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center shrink-0"
            >
              <Plus size={18} className="mr-1" /> Add
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">No member profiles added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((member) => (
              <li key={member.id} className="py-4 flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{member.name}</p>
                  {member.preferences && (
                    <p className="text-sm text-gray-600 mt-1 bg-gray-100 inline-block px-2 py-1 rounded">
                      {member.preferences}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
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
