import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, ChefHat, Maximize2, Minimize2 } from 'lucide-react';
import { chatWithCulinaryAssistant } from '../services/geminiService';
import { getPastMeals, getFavorites } from '../services/historyService';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatAssistantProps {
  householdId: string;
}

export default function ChatAssistant({ householdId }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string, city?: string, society?: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const snap = await getDoc(doc(db, 'owners', auth.currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({ 
            name: data.name, 
            city: data.city || 'Unknown', 
            society: data.society || 'Unknown' 
          });
        }
      } catch (e) {
        console.warn("Profile fetch failed", e);
      }
    };
    fetchProfile();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOpen = () => {
    setIsFullscreen(false); // always start small
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsFullscreen(false); // reset for next open
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const pastMeals = await getPastMeals(householdId, new Date(), 30);
      const favorites = await getFavorites(householdId);
      const response = await chatWithCulinaryAssistant(newMessages, userProfile, pastMeals, favorites);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };


  // Mobile: always full screen (left-0 top-0 w-full h-dvh, no rounding)
  // Desktop small: bottom-right floating panel (w-96, h-600px, rounded)
  // Desktop fullscreen: inset-6 covering most of screen
  const windowClass = isFullscreen
    ? "fixed inset-4 sm:inset-10 bg-white/60 backdrop-blur-3xl rounded-[40px] shadow-[0_32px_120px_rgba(0,0,0,0.15)] border border-white flex flex-col z-50 overflow-hidden transition-all duration-500 ease-out"
    : "fixed bottom-0 right-0 left-0 top-0 sm:bottom-28 sm:right-10 sm:left-auto sm:top-auto sm:w-[400px] sm:h-[650px] sm:max-h-[85vh] bg-white/60 backdrop-blur-3xl sm:rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.15)] border border-white flex flex-col z-50 overflow-hidden transition-all duration-500 ease-out";

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleOpen}
          className="fixed bottom-28 right-6 sm:right-10 p-5 bg-[var(--charcoal)] text-white rounded-[24px] shadow-2xl z-50 flex items-center justify-center border border-white/10 hover:shadow-[0_20px_50px_rgba(42,37,32,0.3)] transition-all"
          title="Culinary Assistant"
        >
          <div className="relative">
            <ChefHat size={32} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--terracotta)] rounded-full border-2 border-[var(--charcoal)] animate-pulse" />
          </div>
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={windowClass}
          >
            {/* Header */}
            <div className="bg-[var(--charcoal)] p-6 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-[var(--terracotta)]/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <ChefHat size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Concierge</h3>
                  <h3 className="font-[var(--font-display)] font-bold text-xl tracking-tight leading-none">Culinary Assistant</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden sm:flex w-10 h-10 items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  title={isFullscreen ? "Minimise" : "Full screen"}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={handleClose}
                  className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-[var(--cream)]/50 flex flex-col gap-6 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 my-auto py-10">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-white rounded-3xl shadow-xl border border-gray-100 flex items-center justify-center mx-auto mb-6"
                  >
                    <ChefHat size={32} className="text-gray-900" />
                  </motion.div>
                  <p className="text-3xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight mb-2">
                    Bonjour{userProfile.name ? `, ${userProfile.name}` : ''}
                  </p>
                  <p className="text-base font-medium text-[var(--charcoal-soft)] opacity-70 max-w-xs mx-auto">
                    I'm your AI Concierge. Ask me about your nutrition, meal history, or for recipe ideas!
                  </p>
                  <div className="mt-8 grid grid-cols-1 gap-2">
                    {['Suggest high protein dinner', 'Analyze my last week', 'What can I make with Paneer?'].map((suggestion) => (
                      <button 
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-4 py-2 bg-white/60 hover:bg-white border border-white rounded-xl text-xs font-bold text-gray-600 transition-all shadow-sm"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`max-w-[85%] rounded-[24px] p-4 ${
                    msg.role === 'user'
                      ? 'bg-[var(--charcoal)] text-white self-end rounded-br-none shadow-xl border border-white/5'
                      : 'bg-white border border-[var(--cream-dark)] text-[var(--charcoal)] self-start rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm prose-gray max-w-none prose-p:leading-relaxed prose-p:text-gray-600 prose-headings:text-gray-900 prose-headings:font-black prose-headings:tracking-tight">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <div className="bg-white border border-gray-100 self-start rounded-[24px] rounded-bl-none shadow-sm p-4 flex items-center gap-2">
                  <div className="flex gap-1">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/90 backdrop-blur-xl border-t border-[var(--cream-dark)]">
              <form onSubmit={handleSend} className="flex gap-3 bg-[var(--cream-dark)]/30 p-1.5 rounded-[24px] border border-[var(--cream-dark)] focus-within:ring-2 focus-within:ring-[var(--charcoal)]/5 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message concierge..."
                  className="flex-1 px-4 py-2 bg-transparent border-none rounded-full focus:outline-none text-[13px] font-bold text-gray-900 placeholder:text-gray-400"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 bg-[var(--charcoal)] text-white rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center shadow-lg"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
