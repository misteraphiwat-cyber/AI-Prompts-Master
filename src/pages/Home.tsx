import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, checkAndResetQuota } from '../firebase/config';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Zap, Search, X, Filter, Tag, RotateCcw, Crown, Layers } from 'lucide-react';
import PromptCard from '../components/PromptCard';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Home() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [accessFilter, setAccessFilter] = useState<'all' | 'vip' | 'free'>('all');

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

  const defaultCategories = ['All', 'Marketing', 'Creative', 'Technical', 'Business', 'Productivity'];

  // Extract all unique categories dynamically from database prompts and default list
  const categories = useMemo(() => {
    const fromPrompts = prompts
      .map((p) => p.category?.trim())
      .filter((c): c is string => Boolean(c) && c.toLowerCase() !== 'all');
    const set = new Set([...defaultCategories.filter((c) => c !== 'All'), ...fromPrompts]);
    return ['All', ...Array.from(set)];
  }, [prompts]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: prompts.length };
    prompts.forEach((p) => {
      const cat = p.category?.trim() || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [prompts]);

  // Check if search query matches any category names dynamically
  const matchingCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return categories.filter((c) => c !== 'All' && c.toLowerCase().includes(term));
  }, [searchTerm, categories]);

  // Dynamic filter for prompts: search across title, description, content body keywords, and category
  const filteredPrompts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return prompts.filter((p) => {
      const titleMatch = p.title?.toLowerCase().includes(term);
      const descMatch = p.description?.toLowerCase().includes(term);
      const contentMatch = p.content?.toLowerCase().includes(term);
      const catMatch = p.category?.toLowerCase().includes(term);
      const matchesSearch = !term || titleMatch || descMatch || contentMatch || catMatch;

      const matchesCategory =
        selectedCategory === 'All' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      const matchesAccess =
        accessFilter === 'all' ||
        (accessFilter === 'vip' && p.is_vip) ||
        (accessFilter === 'free' && !p.is_vip);

      return matchesSearch && matchesCategory && matchesAccess;
    });
  }, [prompts, searchTerm, selectedCategory, accessFilter]);

  const popularKeywords = ['Copywriting', 'Marketing', 'SEO', 'Midjourney', 'ChatGPT', 'Coding', 'Social Media', 'Email'];

  const hasActiveFilters = searchTerm.trim() !== '' || selectedCategory !== 'All' || accessFilter !== 'all';

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setAccessFilter('all');
  };

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
        <div className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gold/20 text-gold text-xs font-bold">★</span>
                <h2 className="font-display text-3xl font-bold text-white">คลัง Prompt มาสเตอร์</h2>
              </div>
              <p className="text-white/50 mt-1">
                สำรวจ ค้นหา และคัดสรร Prompt ที่เหมาะสมกับงานของคุณ
              </p>
            </div>

            {/* Quick Access Filter Tabs (All / VIP / Free) */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10 backdrop-blur-md self-start md:self-auto">
              <button
                onClick={() => setAccessFilter('all')}
                className={cn(
                  "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  accessFilter === 'all'
                    ? "bg-white/15 text-white shadow"
                    : "text-white/60 hover:text-white"
                )}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setAccessFilter('vip')}
                className={cn(
                  "flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  accessFilter === 'vip'
                    ? "gold-gradient text-black font-bold shadow-md shadow-gold/20"
                    : "text-gold/80 hover:text-gold"
                )}
              >
                <Crown className="h-3 w-3" />
                VIP
              </button>
              <button
                onClick={() => setAccessFilter('free')}
                className={cn(
                  "flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  accessFilter === 'free'
                    ? "bg-white/15 text-white shadow"
                    : "text-white/60 hover:text-white"
                )}
              >
                <Zap className="h-3 w-3" />
                ฟรี (Free)
              </button>
            </div>
          </div>

          {/* Dynamic Search Input Bar */}
          <div className="relative rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 shadow-2xl backdrop-blur-xl focus-within:ring-gold/60 transition-all">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gold" />
                <input
                  type="text"
                  placeholder="ค้นหาคีย์เวิร์ด, ชื่อ Prompt, คำสั่ง หรือหมวดหมู่..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-12 w-full rounded-xl bg-transparent pl-12 pr-10 text-sm text-white placeholder-white/30 focus:outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    title="ล้างข้อความค้นหา"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dynamic Category Selector Dropdown (Quick filter) */}
              <div className="flex items-center gap-2 border-t border-white/5 pt-2 sm:border-t-0 sm:border-l sm:border-white/10 sm:pt-0 sm:pl-3">
                <div className="flex items-center gap-1.5 text-xs text-white/40 pl-1">
                  <Filter className="h-3.5 w-3.5 text-gold" />
                  <span className="hidden md:inline">หมวดหมู่:</span>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 rounded-xl bg-black/60 px-3 pr-8 text-xs font-semibold text-white ring-1 ring-white/10 focus:outline-none focus:ring-gold cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#111] text-white">
                      {cat.toUpperCase()} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Smart dynamic matched categories banner when user types matching keyword */}
            {matchingCategories.length > 0 && selectedCategory === 'All' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2.5 px-2">
                <span className="text-[11px] font-medium text-gold/80 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  ตรงกับหมวดหมู่:
                </span>
                {matchingCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSearchTerm('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-gold/15 hover:bg-gold/25 px-2.5 py-1 text-[11px] font-bold text-gold border border-gold/30 transition-all"
                  >
                    <span>{cat}</span>
                    <span className="text-[9px] opacity-75">({categoryCounts[cat] || 0})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Keywords / Dynamic search chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/50">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-white/40 mr-1">
              <Tag className="h-3 w-3 text-gold/60" />
              คีย์เวิร์ดยอดนิยม:
            </span>
            {popularKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => setSearchTerm(searchTerm === kw ? '' : kw)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
                  searchTerm.toLowerCase() === kw.toLowerCase()
                    ? "bg-gold text-black font-bold"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5"
                )}
              >
                #{kw}
              </button>
            ))}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {categories.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition-all",
                    isSelected
                      ? "gold-gradient text-black shadow-lg shadow-gold/20 scale-105"
                      : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 hover:text-white"
                  )}
                >
                  <span>{cat.toUpperCase()}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      isSelected ? "bg-black/20 text-black" : "bg-white/10 text-white/40"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Results Summary & Active Filter Clear Button */}
          <div className="flex items-center justify-between text-xs text-white/40 border-b border-white/5 pb-3">
            <div>
              {loading ? (
                <span>กำลังโหลดข้อมูล Prompt...</span>
              ) : (
                <span>
                  แสดงผล <strong className="text-gold font-bold">{filteredPrompts.length}</strong> จาก {prompts.length} Prompt
                  {searchTerm && (
                    <span>
                      {' '}สำหรับคีย์เวิร์ด <strong className="text-white font-semibold">"{searchTerm}"</strong>
                    </span>
                  )}
                  {selectedCategory !== 'All' && (
                    <span>
                      {' '}ในหมวดหมู่ <strong className="text-white font-semibold">"{selectedCategory}"</strong>
                    </span>
                  )}
                  {accessFilter !== 'all' && (
                    <span>
                      {' '}แบบ <strong className="text-white font-semibold">"{accessFilter.toUpperCase()}"</strong>
                    </span>
                  )}
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 text-gold hover:text-gold/80 transition-colors font-medium hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
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
              <div className="mx-auto h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-4 ring-1 ring-white/10">
                <Search className="h-10 w-10 text-gold/40" />
              </div>
              <h3 className="text-xl font-bold text-white">ไม่พบ Prompt ที่คุณค้นหา</h3>
              <p className="text-white/40 mt-2 max-w-md mx-auto text-sm">
                ไม่พบข้อมูลที่ตรงกับคำค้นหาหรือหมวดหมู่ที่เลือก ลองใช้คำค้นหาอื่นหรือคลิกล้างตัวกรอง
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="mt-6 gold-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-gold/20 hover:scale-105 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                  ล้างตัวกรองและการค้นหาทั้งหมด
                </button>
              )}
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
