import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, ChefHat, Maximize2, Minimize2 } from 'lucide-react';
import { chatWithCulinaryAssistant } from '../services/geminiService';
import { getPastMeals, getFavorites } from '../services/historyService';
import { auth } from '../firebase';
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
    ? "fixed inset-4 sm:inset-6 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden transition-all duration-300"
    : "fixed bottom-0 right-0 left-0 top-0 sm:bottom-6 sm:right-6 sm:left-auto sm:top-auto sm:w-96 sm:h-[600px] sm:max-h-[80vh] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden transition-all duration-300";

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all z-50 flex items-center justify-center"
          title="Culinary Assistant"
        >
          <ChefHat size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={windowClass}>
          {/* Header */}
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ChefHat size={24} />
              <h3 className="font-bold text-lg">Culinary Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Fullscreen toggle — hidden on mobile (mobile is always full screen) */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="hidden sm:flex text-indigo-100 hover:text-white transition-colors"
                title={isFullscreen ? "Minimise" : "Full screen"}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button
                onClick={handleClose}
                className="text-indigo-100 hover:text-white transition-colors"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 my-auto">
                <ChefHat size={48} className="mx-auto text-indigo-200 mb-4" />
                <p className="text-lg font-medium">Hello{userProfile.name ? `, ${userProfile.name}` : ''}!</p>
                <p>I'm your AI Culinary Assistant.</p>
                <p className="text-sm mt-2">Ask me about your nutrition, meal history, or for recipe ideas!</p>
              </div>
            )}


            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] rounded-2xl p-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white self-end rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-800 self-start rounded-bl-none shadow-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm prose-indigo max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="bg-white border border-gray-200 text-gray-800 self-start rounded-2xl rounded-bl-none shadow-sm p-4">
                <Loader2 className="animate-spin text-indigo-600" size={20} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your meals..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center w-10 h-10"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
