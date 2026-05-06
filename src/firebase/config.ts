import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
// Adding full drive scope to ensure app can write to the externally created folder provided by user
googleProvider.addScope('https://www.googleapis.com/auth/drive');

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    if (token) {
      sessionStorage.setItem('google_drive_token', token);
    }
    return { user: result.user, accessToken: token };
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const getStoredDriveToken = () => {
  return sessionStorage.getItem('google_drive_token');
};

export const logout = () => {
  sessionStorage.removeItem('google_drive_token');
  return signOut(auth);
};

// Quota Logic
export const checkAndResetQuota = async (userId: string) => {
  const userRef = doc(db, 'profiles', userId);
  const path = `profiles/${userId}`;
  
  try {
    const userSnap = await getDoc(userRef);
    const today = new Date().toISOString().split('T')[0];
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      const isAdminEmail = auth.currentUser?.email === 'misteraphiwat@gmail.com';
      
      let updatedData = { ...data };
      let needsUpdate = false;

      // Force admin status for the specific email if not already set
      if (isAdminEmail && data.status !== 'admin') {
        updatedData.status = 'admin';
        needsUpdate = true;
      }

      // Handle daily reset
      if (data.last_reset_date !== today) {
        updatedData.usage_count = 0;
        updatedData.last_reset_date = today;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(userRef, {
          status: updatedData.status,
          usage_count: updatedData.usage_count,
          last_reset_date: updatedData.last_reset_date
        });
      }
      
      return updatedData;
    } else {
      // New user
      const isAdmin = auth.currentUser?.email === 'misteraphiwat@gmail.com';
      const newData = {
        email: auth.currentUser?.email,
        status: isAdmin ? 'admin' : 'free',
        usage_count: 0,
        last_reset_date: today
      };
      await setDoc(userRef, newData);
      return newData;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
