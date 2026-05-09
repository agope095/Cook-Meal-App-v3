<div align="center">
<img width="1200" height="475" alt="SousChefAI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🍳 SousChefAI
### Cooking *together*, every single day.

[![Platform: Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare_Pages-F38020?style=flat&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Framework: Vite](https://img.shields.io/badge/Framework-Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Backend: Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28?style=flat&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![AI: Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

</div>

---

## 🌟 Overview

**SousChefAI** is a premium kitchen management platform designed to bridge the gap between household owners and their cooks. It transforms the daily "what should we eat?" stress into a harmonious, AI-powered culinary experience.

Whether you're managing a busy household or cooking for one, SousChefAI brings editorial-grade design and cutting-edge AI to your kitchen rituals.

## 👥 Key Experiences

### 🏡 For Householders (Owner Portal)
- **AI-Powered Planning:** Generate weekly menus tailored to family size, dietary restrictions, and favorite cuisines using Google Gemini.
- **Family Management:** Track individual preferences, allergies, and nutrition goals.
- **Seamless Delegation:** Send recipe instructions and video links directly to your cook's dashboard.
- **Smart Groceries:** Auto-generated shopping lists synced across the household.

### 🧑‍🍳 For Chefs (Cook Portal)
- **Multi-Kitchen Management:** Manage multiple households (Societies/Towers/Flats) from a single interface.
- **Multilingual Support:** View recipes and instructions in your preferred language to ensure total clarity.
- **Visual Guides:** Instant access to YouTube video instructions for any dish.
- **Real-time Sync:** See menu changes and feedback from owners instantly.

## 🚀 Core Features

- **🧠 AI Nutrition Integration:** Get automated energy and macro estimates for every meal using NVIDIA NIM and Gemini.
- **🎥 YouTube Integration:** Automatically fetch high-quality recipe videos for suggested dishes.
- **💬 AI Chat Assistant:** A specialized kitchen bot to help brainstorm recipes or modify plans on the fly.
- **🛡️ Secure & Private:** Bank-grade verification gates for both owners and cooks.
- **📱 Mobile-First Design:** A "Clean Luxury" aesthetic that feels at home on any device.

## 🛠️ Technology Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Vanilla CSS (Custom Design System) + Framer Motion
- **Icons:** Lucide React
- **Backend:** Firebase (Authentication & Firestore)
- **Serverless:** Cloudflare Pages Functions
- **AI Models:** Google Gemini 1.5 & NVIDIA NIM

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- A Firebase Project
- API Keys for Gemini, NVIDIA, and YouTube

### Setup Steps

1. **Clone & Install:**
   ```bash
   git clone https://github.com/your-username/Cook-Meal-App-v3.git
   cd Cook-Meal-App-v3
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` (Frontend) and `.dev.vars` (Backend/Cloudflare) file.

   **`.dev.vars` (Backend Secrets):**
   ```ini
   GEMINI_API_KEY=your_key
   NVIDIA_API_KEY=your_key
   FIREBASE_PROJECT_ID=your_id
   ```

   **`.env` (Frontend Public Keys):**
   ```ini
   VITE_YOUTUBE_API_KEY=your_key
   ```

3. **Run Dev Server:**
   ```bash
   npm run dev
   ```

## 🌐 Deployment

The app is optimized for **Cloudflare Pages**.
- All AI calls are proxied through `/api/ai` (Cloudflare Functions) to keep API secrets secure.
- Deployment is automatic upon pushing to the `main` branch.

---
<div align="center">
Built with ❤️ for better home cooking.
</div>
