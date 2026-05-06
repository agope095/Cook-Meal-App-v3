import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB18NGqP_VNTccZjLofAZCAp7rZQQVtQg8",
  authDomain: "gen-lang-client-0849796469.firebaseapp.com",
  projectId: "gen-lang-client-0849796469",
  storageBucket: "gen-lang-client-0849796469.firebasestorage.app",
  messagingSenderId: "560901801754",
  appId: "1:560901801754:web:c8a6f0a78ab1a916e2cea3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-d9972222-ba67-48c8-89d2-682015a45699");
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

export const loginWithGoogle = async () => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

