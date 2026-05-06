import React, { useState, useEffect } from 'react';
import { db, auth, checkAndResetQuota } from '../firebase/config';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Zap, Search } from 'lucide-react';
import PromptCard from '../components/PromptCard';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Home() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    // Fetch Prompts
    const promptsPath = 'prompts';
    const q = query(collection(db, promptsPath), orderBy('createdAt', 'desc'));
    const unsubscribePrompts = onSnapshot(q, (snapshot) => {
      setPrompts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, promptsPath);
    });

    let profileUnsub: (() => void) | null = null;

    // Handle Auth & Quota
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (user) {
        try {
          const profile = await checkAndResetQuota(user.uid);
          setUserProfile(profile);
          
          // Listen for profile updates
          const profilePath = `profiles/${user.uid}`;
          profileUnsub = onSnapshot(doc(db, 'profiles', user.uid), (doc) => {
            setUserProfile(doc.data());
          }, (error) => {
            if (auth.currentUser) {
              handleFirestoreError(error, OperationType.GET, profilePath);
            }
          });
        } catch (error) {
          console.error("Quota Check Error", error);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribePrompts();
      unsubscribeAuth();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const handleCopy = async (promptId: string) => {
    if (!auth.currentUser || !userProfile) return;
    
    // Admins and VIPs have unlimited usage
    if (userProfile.status === 'admin' || userProfile.status === 'vip') return;

    // Normal users increment usage
    if (userProfile.usage_count < 5) {
      const path = `profiles/${auth.currentUser.uid}`;
      try {
        await updateDoc(doc(db, 'profiles', auth.currentUser.uid), {
          usage_count: increment(1)
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  const categories = ['All', 'Marketing', 'Creative', 'Technical', 'Business', 'Productivity'];

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const canAccess = (isVip: boolean) => {
    if (!auth.currentUser) return false;
    if (userProfile?.status === 'admin' || userProfile?.status === 'vip') return true;
    if (isVip) return false;
    return (userProfile?.usage_count || 0) < 5;
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[500px] w-full overflow-hidden flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=2000"
            alt="AI Hero"
            className="h-full w-full object-cover opacity-30 grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/50 to-[#050505]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-gold/10 px-4 py-1.5 border border-gold/20"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-xs font-bold tracking-widest text-gold uppercase">Best Prompt Thailand 2026</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-5xl font-black tracking-tighter text-white sm:text-7xl lg:text-8xl"
          >
            KRU-NUENG <br />
            <span className="text-gold">MASTER PROMPT</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-white/50 max-w-2xl mx-auto"
          >
            ยกระดับการใช้งาน AI ของคุณให้ถึงขีดสุด พลิกโลกด้วยพลังแห่ง Master Prompt ที่ถูกคัดสรรมาอย่างดีที่สุดโดย Vibes FullStack Architect
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-2 pr-4 ring-1 ring-white/10 backdrop-blur-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-black shadow-lg shadow-gold/20">
                 <Zap className="h-6 w-6 font-bold" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">VIP LIFETIME</div>
                <div className="text-[10px] text-white/50">Unlimited access to all prompts</div>
              </div>
              <button className="gold-gradient ml-4 rounded-lg px-4 py-1.5 text-xs font-black text-black">UPGRADE</button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl px-4 py-20">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between mb-16">
          <div>
            <h2 className="font-display text-3xl font-bold text-white">คลัง Prompt มาสเตอร์</h2>
            <p className="text-white/50 mt-1">สำรวจและคัดสรร Prompt ที่เหมาะสมกับงานของคุณ</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="ค้นหา prompt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white/5 pl-12 pr-4 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-gold sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-12 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-full px-6 py-2.5 text-xs font-bold tracking-wider transition-all",
                selectedCategory === cat 
                  ? "gold-gradient text-black" 
                  : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
              )}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Quota Info for Mobile/Small Screens */}
        <AnimatePresence>
          {auth.currentUser && userProfile?.status === 'free' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Daily Quota: {userProfile.usage_count}/5</div>
                    <div className="text-[10px] text-white/50">คุณสามารถใช้ Prompt ได้ 5 ครั้งต่อวัน</div>
                  </div>
                </div>
                {userProfile.usage_count >= 5 && (
                  <button className="gold-gradient rounded-lg px-4 py-1.5 text-[10px] font-black text-black">UNLOCK VIP</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              canAccess={canAccess(prompt.is_vip)}
              onCopy={() => handleCopy(prompt.id)}
            />
          ))}
          {!loading && filteredPrompts.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="mx-auto h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Search className="h-10 w-10 text-white/20" />
              </div>
              <h3 className="text-xl font-bold text-white">ไม่พบ Prompt ที่คุณค้นหา</h3>
              <p className="text-white/40 mt-2">ลองใช้คำค้นหาอื่นหรือเปลี่ยนหมวดหมู่</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-black py-10">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="gold-gradient h-6 w-6 rounded flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">M</span>
            </div>
            <span className="font-display text-sm font-bold tracking-widest text-white/40 uppercase">Kru-Nueng Master AI</span>
          </div>
          <p className="text-xs text-white/30">© 2026 Vibes FullStack Architect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
