import React, { useState } from 'react';
import { Copy, Check, Crown, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PromptCardProps {
  prompt: {
    id: string;
    title: string;
    description: string;
    content: string;
    is_vip: boolean;
    category: string;
    image_url: string;
  };
  canAccess: boolean;
  onCopy: () => void;
}

export default function PromptCard({ prompt, canAccess, onCopy }: PromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!canAccess) return;
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="glass-card group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-gold/10"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={prompt.image_url || `https://picsum.photos/seed/${prompt.id}/800/500`}
          alt={prompt.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute top-4 left-4">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold backdrop-blur-md border border-gold/30">
            {prompt.category}
          </span>
        </div>

        {prompt.is_vip && (
          <div className="absolute top-4 right-4">
            <div className="gold-gradient flex items-center gap-1 rounded-full px-2 py-1 shadow-lg shadow-gold/20">
              <Crown className="h-3 w-3 text-black fill-black" />
              <span className="text-[10px] font-black text-black">VIP</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-display text-lg font-bold text-white mb-2 line-clamp-1">{prompt.title}</h3>
        <p className="text-sm leading-relaxed text-white/50 line-clamp-2 mb-6 h-10">
          {prompt.description}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            disabled={!canAccess}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95",
              canAccess 
                ? "gold-gradient text-black" 
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
          >
            {canAccess ? (
              <>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'COPIED!' : 'COPY PROMPT'}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                VIP ONLY
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
