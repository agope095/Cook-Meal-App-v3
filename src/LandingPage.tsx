import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Calendar, Users, ArrowRight, ChefHat, 
  ShieldCheck, MessageCircle, CheckCircle, ChevronDown, HeartHandshake,
  Star, Play, Utensils
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const steps = [
    { icon: ChefHat, title: 'Create Your Profile', desc: 'Add your family size, dietary preferences, and favorite cuisines in under 2 minutes.' },
    { icon: HeartHandshake, title: 'Invite Your Cook', desc: 'Send a simple invite. Your cook joins in their preferred language with zero friction.' },
    { icon: Calendar, title: 'Start Planning', desc: 'Get AI-generated meal plans, shopping lists, and share recipes with video instructions.' }
  ];

  const testimonials = [
    { name: 'Priya Sharma', role: 'Working Mother', text: '"Finally, my cook and I are on the same page. The video instructions feature is an absolute game changer for our mornings."', rating: 5 },
    { name: 'Rajesh Kumar', role: 'Home Chef', text: '"I used to spend 20 minutes every evening figuring out what to cook. Now the AI handles it beautifully. Highly recommend!"', rating: 5 },
    { name: 'Anita Desai', role: 'Food Enthusiast', text: '"My cook was hesitant at first, but the native language support made it so easy. We love getting the meal plans each week."', rating: 5 }
  ];

  return (
    <div className="min-h-screen bg-[var(--cream)] font-sans paper-grain relative selection:bg-[var(--terracotta)] selection:text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollY > 50 ? 'bg-[var(--cream)]/90 backdrop-blur-md border-b border-[var(--cream-dark)] py-3 shadow-sm' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--terracotta)] text-[var(--paper)] p-2 rounded-xl shadow-sm animate-float-slow">
              <Utensils size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-[var(--font-display)] font-bold text-[var(--charcoal)] tracking-tight">SousChefAI</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/owner')}
              className="bg-[var(--charcoal)] text-[var(--paper)] px-6 py-2.5 rounded-full font-bold text-sm hover:bg-[var(--charcoal-soft)] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Owner Portal
            </button>
            <button
              onClick={() => navigate('/cook')}
              className="hidden md:block bg-white text-[var(--charcoal)] border border-[var(--cream-dark)] px-6 py-2.5 rounded-full font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
            >
              Cook Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] lg:min-h-screen flex items-center pt-12 lg:pt-24 pb-8 lg:pb-12 overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Background shapes */}
          <div className="absolute top-0 right-0 w-[70vw] lg:w-[50vw] h-[100vh] bg-[var(--sage-muted)] rounded-bl-[120px] transform translate-x-[15vw] lg:translate-x-[10vw] -translate-y-[10vh] opacity-60"></div>
          <div className="absolute bottom-0 left-0 w-[60vw] lg:w-[40vw] h-[60vw] lg:h-[40vw] bg-[var(--cream-dark)] rounded-tr-[120px] opacity-40"></div>
          
          {/* Editorial Watermark */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 text-[30rem] font-[var(--font-display)] font-black text-[var(--charcoal)] opacity-[0.03] select-none pointer-events-none hidden lg:block">
            S
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full pt-4 lg:pt-0">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-16 items-center">
            
            {/* Hero Content */}
            <div className="stagger text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--terracotta)]/10 rounded-full text-[var(--terracotta-deep)] font-black text-[10px] uppercase tracking-widest mb-6 lg:mb-8 shadow-sm border border-[var(--terracotta)]/10">
                <Sparkles size={14} />
                <span>Elevate your daily dining</span>
              </div>
              <h1 className="text-4xl sm:text-6xl lg:text-[6rem] font-[var(--font-display)] font-semibold text-[var(--charcoal)] mb-6 lg:mb-10 leading-[1] tracking-tight">
                Cooking <span className="italic font-light text-[var(--terracotta)]">together</span>,<br/> every single day.
              </h1>
              <p className="text-lg lg:text-2xl text-[var(--charcoal-soft)] max-w-2xl mx-auto lg:mx-0 mb-10 lg:mb-14 leading-relaxed font-medium opacity-80">
                Connect with your cook, plan meals effortlessly, and bring harmony to your household kitchen. Experience the warmth of shared culinary creation.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => navigate('/owner')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-5 bg-[var(--terracotta)] text-white rounded-full font-bold text-lg hover:bg-[var(--terracotta-deep)] transition-all shadow-[0_20px_50px_rgba(184,80,59,0.3)] hover:shadow-[0_25px_60px_rgba(184,80,59,0.4)] hover:-translate-y-1 group"
                >
                  Get Started Free
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
                <button
                  onClick={() => navigate('/cook')}
                  className="w-full sm:w-auto px-10 py-5 bg-white/50 backdrop-blur-md text-[var(--charcoal)] border-2 border-[var(--cream-dark)] rounded-full font-bold text-lg hover:bg-white transition-all"
                >
                  Cook Login
                </button>
              </div>

              <div className="mt-12 flex items-center justify-center lg:justify-start gap-8">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm">
                      <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="flex gap-1 mb-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={12} className="text-[var(--terracotta)] fill-current" />)}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Trusted by 2,000+ homes</p>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
                animate={{ opacity: 1, scale: 1, rotate: 2 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.1)] aspect-[4/5] lg:aspect-square border-[12px] border-white/60 glass-card group"
              >
                <img 
                  src="/hero_cooking.png" 
                  alt="Hands cooking in a warm kitchen" 
                  className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--charcoal)]/40 via-transparent to-transparent"></div>
                
                {/* Floating Tags */}
                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                   <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 animate-float">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--terracotta)] mb-1">Live Update</p>
                      <p className="text-sm font-black text-gray-900 tracking-tight">Lunch Plan Shared</p>
                   </div>
                </div>
              </motion.div>
              
              {/* Floating UI Elements */}
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -right-4 lg:-right-8 top-1/4 glass-card rounded-[24px] p-5 shadow-2xl animate-float-slow z-20 border border-white/40 max-w-[180px] lg:max-w-[200px]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-[var(--sage)] p-2.5 rounded-xl text-white shadow-sm">
                    <CheckCircle size={20} strokeWidth={3} />
                  </div>
                  <p className="font-black text-xs text-[var(--charcoal)] tracking-tight leading-tight">Groceries<br/>Ordered</p>
                </div>
                <div className="w-full h-1.5 bg-[var(--cream-dark)] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.5, delay: 1.2 }} className="h-full bg-[var(--sage)]" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute -left-6 lg:-left-12 bottom-1/4 glass-card rounded-[24px] p-5 shadow-2xl animate-float z-20 border border-white/40"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-[var(--terracotta)] p-3 rounded-2xl text-white shadow-lg">
                    <Play size={20} fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--warm-gray)]">Step-by-step</p>
                    <p className="font-black text-[var(--charcoal)] tracking-tight">Recipe Video Sent</p>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* Testimonial Strip */}
      <section className="py-16 bg-[var(--charcoal)] text-[var(--cream)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <p className="text-center text-[var(--sage-light)] font-black tracking-[0.3em] text-[10px] uppercase mb-10 opacity-60">As featured in the worlds leading culinary journals</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 items-center">
            {['VOGUE KITCHEN', 'HEARTH', 'MODERN DINING', 'GASTRONOMY'].map((name, i) => (
              <span key={i} className="text-xl md:text-2xl font-[var(--font-display)] font-black text-white/40 tracking-widest hover:text-white/100 transition-all cursor-default">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section className="py-32 bg-[var(--paper)] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <h2 className="text-5xl sm:text-6xl font-[var(--font-display)] text-[var(--charcoal)] mb-8 leading-[1.1] tracking-tight">
              A kitchen that <span className="italic text-[var(--terracotta)]">thinks of everything.</span>
            </h2>
            <p className="text-xl text-[var(--charcoal-soft)] font-medium opacity-70 leading-relaxed">
              Thoughtful, beautiful features designed for real families and the people who cook for them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Feature 1: Large Image Focus */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="md:col-span-8 group relative rounded-[3rem] overflow-hidden shadow-2xl bg-[var(--cream)] border border-[var(--cream-dark)] min-h-[500px]"
            >
              <img src="/feature_meal.png" alt="Indian Meal" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110 opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--charcoal)]/90 via-[var(--charcoal)]/30 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-12 w-full text-white">
                <div className="bg-white/10 backdrop-blur-xl w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h3 className="text-4xl font-[var(--font-display)] font-bold mb-4 tracking-tight leading-none">AI-Powered Meal Discovery</h3>
                <p className="text-xl font-medium text-white/70 max-w-lg leading-relaxed">
                  Generate weekly menus that consider your family's preferences, dietary needs, and past favorites with a single, intelligent tap.
                </p>
              </div>
            </motion.div>

            {/* Feature 2: Stacked Small */}
            <div className="md:col-span-4 flex flex-col gap-8">
              <motion.div 
                whileHover={{ y: -10 }}
                className="flex-1 bg-[var(--sage)] rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl border border-[var(--sage-light)]/20"
              >
                <div className="relative z-10">
                  <div className="bg-white/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className="text-3xl font-[var(--font-display)] font-bold mb-4 tracking-tight leading-none">Private by Design</h3>
                  <p className="font-medium text-white/70 text-lg leading-relaxed">Your family rituals and data are kept safe with bank-grade encryption.</p>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -10 }}
                className="flex-1 bg-white border-2 border-[var(--cream-dark)] rounded-[3rem] p-10 relative group shadow-xl"
              >
                <div className="bg-[var(--terracotta)]/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border border-[var(--terracotta)]/10">
                  <Users size={28} className="text-[var(--terracotta)]" />
                </div>
                <h3 className="text-3xl font-[var(--font-display)] text-[var(--charcoal)] font-bold mb-4 tracking-tight leading-none">Multilingual Flow</h3>
                <p className="font-medium text-[var(--charcoal-soft)] text-lg opacity-70 leading-relaxed">Share recipes and plans in your cook's native language for total clarity.</p>
              </motion.div>
            </div>

            {/* Feature 3: Full Width Banner */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="md:col-span-12 group relative rounded-[3rem] overflow-hidden shadow-2xl bg-[var(--charcoal)] min-h-[400px] flex items-center border border-white/5"
            >
              <img src="/spices_overhead.png" alt="Spices" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-[5s]" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-12 md:p-20 w-full gap-12">
                <div className="text-white max-w-xl">
                  <div className="bg-white/10 backdrop-blur-xl w-14 h-14 rounded-2xl flex items-center justify-center mb-10 border border-white/10">
                    <Calendar size={28} />
                  </div>
                  <h3 className="text-4xl font-[var(--font-display)] font-bold mb-6 tracking-tight leading-none">Smart Groceries</h3>
                  <p className="text-xl font-medium text-white/60 leading-relaxed">
                    Auto-generated shopping lists organized by category. Add notes and mark items as bought in real-time, syncing instantly across devices.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 md:max-w-md justify-center md:justify-end">
                  {['Vegetables', 'Rare Spices', 'Organic Dairy', 'Ancient Grains', 'Pantry Essentials'].map((item, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                      className="bg-white/10 backdrop-blur-xl px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-[var(--cream)] border border-white/20 shadow-xl cursor-default"
                    >
                      {item}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 bg-[var(--cream)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-5xl sm:text-6xl font-[var(--font-display)] text-[var(--charcoal)] mb-8 tracking-tight">
              The journey to a <span className="italic text-[var(--terracotta)]">harmonious home.</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-16 relative">
            <div className="hidden md:block absolute top-20 left-[15%] w-[70%] h-0.5 bg-gradient-to-r from-transparent via-[var(--terracotta)]/20 to-transparent z-0"></div>
            
            {steps.map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
                <div className="w-32 h-32 bg-white rounded-[40px] flex items-center justify-center border-4 border-white shadow-[0_20px_60px_rgba(0,0,0,0.05)] mb-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 group-hover:shadow-[0_30px_80px_rgba(184,80,59,0.15)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[var(--terracotta)]/5 to-transparent"></div>
                  <step.icon size={48} className="text-[var(--terracotta)] relative z-10" strokeWidth={1.5} />
                  <div className="absolute top-2 right-4 text-4xl font-[var(--font-display)] font-black text-gray-100 opacity-50">{idx + 1}</div>
                </div>
                <h3 className="text-3xl font-[var(--font-display)] text-[var(--charcoal)] font-bold mb-6 tracking-tight">{step.title}</h3>
                <p className="text-[var(--charcoal-soft)] font-medium text-lg leading-relaxed opacity-70 px-4">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Reviews */}
      <section className="py-32 bg-[var(--paper)] border-t border-[var(--cream-dark)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-24">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--terracotta)] mb-4">Voice of the community</p>
            <h2 className="text-5xl font-[var(--font-display)] text-[var(--charcoal)] tracking-tight">Loved by homes everywhere</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {testimonials.map((testimonial, idx) => (
              <motion.div 
                key={idx} 
                whileHover={{ y: -10 }}
                className="bg-white rounded-[3rem] p-12 shadow-[0_15px_45px_rgba(0,0,0,0.03)] border border-[var(--cream-dark)] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-1 mb-8 text-[var(--terracotta)]">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} size={20} fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                  <p className="text-[var(--charcoal-soft)] italic mb-12 font-medium text-xl leading-relaxed opacity-80">"{testimonial.text}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--cream)] flex items-center justify-center font-black text-[var(--terracotta)]">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <p className="font-black text-[var(--charcoal)] font-[var(--font-display)] tracking-tight">{testimonial.name}</p>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-[var(--charcoal)] text-[var(--cream)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--terracotta)]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[var(--sage)]/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/4"></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-5xl sm:text-7xl font-[var(--font-display)] mb-10 tracking-tight leading-none font-bold"
          >
            Ready to transform your culinary routine?
          </motion.h2>
          <p className="text-2xl text-[var(--warm-gray-light)] font-medium mb-16 max-w-2xl mx-auto opacity-70 leading-relaxed">
            Join thousands of households already experiencing the joy of a well-organized, harmonious kitchen.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={() => navigate('/owner')}
              className="px-12 py-6 bg-[var(--terracotta)] text-white rounded-full font-bold text-xl hover:bg-[var(--terracotta-deep)] transition-all shadow-[0_20px_50px_rgba(184,80,59,0.3)] hover:-translate-y-1"
            >
              Start Your Free Trial
            </button>
            <button
              onClick={() => navigate('/cook')}
              className="px-12 py-6 bg-white/10 backdrop-blur-md text-white border-2 border-white/20 rounded-full font-bold text-xl hover:bg-white/20 transition-all"
            >
              Cook Portal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--charcoal)] border-t border-white/5 text-[var(--warm-gray-light)] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl border border-white/10">
                <Utensils size={24} className="text-[var(--sage-light)]" />
              </div>
              <span className="text-2xl font-[var(--font-display)] font-black text-white tracking-tight">SousChefAI</span>
            </div>
            <div className="flex gap-10">
              {['Features', 'Testimonials', 'Pricing', 'Contact'].map(link => (
                <a key={link} href="#" className="text-sm font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">{link}</a>
              ))}
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/20">
              © 2026 SousChefAI. Handcrafted for modern homes.
            </div>
            <div className="flex gap-6">
               <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-white/20">All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}