import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout, db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogIn, LogOut, Shield, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Navbar() {
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      
      // Cleanup previous profile listener if any
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (u) {
        const profilePath = `profiles/${u.uid}`;
        profileUnsub = onSnapshot(doc(db, 'profiles', u.uid), (doc) => {
          setProfile(doc.data());
        }, (error) => {
          // Only log if user is still logged in to avoid reporting expected errors during logout
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, profilePath);
          }
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="gold-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-gold/20">
            <span className="font-display font-bold text-black">M</span>
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white sm:block hidden">
            MASTER PROMPT <span className="text-gold">AI</span>
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-gold sm:hidden block">
            MASTER
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-xs font-medium text-white/60">Welcome back</span>
                <span className="text-sm font-semibold">{user.displayName}</span>
              </div>
              
              <div className="flex items-center gap-2 rounded-full bg-white/5 p-1 pl-3 pr-2 border border-white/10">
                <div className="flex items-center gap-1">
                  {profile?.status === 'vip' || profile?.status === 'admin' ? (
                    <Crown className="h-4 w-4 text-gold fill-gold" />
                  ) : (
                    <span className="text-xs font-bold text-white/50">{profile?.usage_count || 0}/5</span>
                  )}
                </div>
                <img
                  src={user.photoURL || ''}
                  alt={user.displayName || ''}
                  className="h-8 w-8 rounded-full border border-gold/20"
                />
              </div>

              {profile?.status === 'admin' && (
                <Link 
                  to="/admin" 
                  className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 transition-colors"
                  title="Admin Dashboard"
                >
                  <Shield className="h-5 w-5" />
                </Link>
              )}

              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="gold-gradient flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-gold/20 transition-transform active:scale-95"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
