import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, Users, Heart, ArrowRight, ChefHat, ShieldCheck, Clock } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 text-white p-2 rounded-xl">
              <ChefHat size={24} />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">SousChefAI</span>
          </div>
          <button 
            onClick={() => navigate('/owner')}
            className="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-md hover:shadow-orange-200"
          >
            Owner Portal
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full text-orange-600 font-bold text-sm mb-8 animate-bounce">
            <Sparkles size={16} />
            <span>AI-Powered Meal Management</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
            The Smart Way to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Manage Your Kitchen.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 font-medium">
            SousChefAI connects homeowners with their cooks through an intelligent meal planning interface. Say goodbye to daily "what to cook" WhatsApp chats.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/owner')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-xl group"
            >
              Get Started as Owner
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/cook')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-black text-lg hover:bg-gray-50 transition-all"
            >
              Cook Login
            </button>
          </div>
          
          <div className="mt-16 relative">
             <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 h-32 bottom-0"></div>
             <div className="bg-gray-100 rounded-[40px] p-4 sm:p-8 shadow-inner">
               <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-200">
                 <img 
                   src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2000" 
                   alt="Modern Kitchen" 
                   className="w-full h-[400px] object-cover opacity-90"
                 />
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Everything you need to run a smooth kitchen.</h2>
            <p className="text-gray-500 font-medium">Simple, powerful features for the modern household.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="bg-orange-100 w-14 h-14 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform">
                <Sparkles size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Meal Planner</h3>
              <p className="text-gray-500 font-medium leading-relaxed">
                Generate weekly meal plans based on your preferences, past history, and family favorites.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="bg-blue-100 w-14 h-14 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Cook Collaboration</h3>
              <p className="text-gray-500 font-medium leading-relaxed">
                Seamlessly share recipes, instructions, and video links with your cook in their preferred language.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="bg-green-100 w-14 h-14 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Persistent Access</h3>
              <p className="text-gray-500 font-medium leading-relaxed">
                Safe and secure authentication ensures your data and your cook's access are always protected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Trust */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-8 leading-tight">
                Designed for the <br />
                <span className="text-orange-500">busy homeowner.</span>
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 p-2 rounded-lg mt-1">
                    <Clock size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Save 30 mins Daily</h4>
                    <p className="text-sm text-gray-500">Stop micro-managing ingredients and dishes over the phone.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 p-2 rounded-lg mt-1">
                    <Heart size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Zero Confusion</h4>
                    <p className="text-sm text-gray-500">Video links and translations ensure your cook gets it right every time.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="bg-orange-500 rounded-[40px] p-8 text-white relative z-10">
                <div className="text-6xl font-black mb-2 tracking-tighter">AI</div>
                <div className="text-xl font-bold opacity-90 mb-6">Culinary Assistant</div>
                <div className="space-y-3">
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                    "I want something light for dinner today..."
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 ml-8">
                    "How about a Lemon Coriander Soup and Grilled Paneer?"
                  </div>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-100 rounded-full blur-3xl opacity-50"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-200 rounded-full blur-3xl opacity-50"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="bg-orange-500 text-white p-2 rounded-xl">
              <ChefHat size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">SousChefAI</span>
          </div>
          <p className="text-gray-400 text-sm">© 2026 SousChefAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
