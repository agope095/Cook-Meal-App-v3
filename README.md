<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>
<!-- PR for merging fallback change -->

# Cook's Companion

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set environment variables in `.env.local`:
   - `GEMINI_API_KEY`
   - `NVIDIA_API_KEY`
   - `VITE_YOUTUBE_API_KEY`
3. Start the app:
   `npm run dev`

> AI calls are now routed through `/.netlify/functions/ai` so API secrets stay server-side.

## Netlify deployment

This app uses a Netlify Function at `netlify/functions/ai.ts` for all AI requests.

Set these environment variables in Netlify Site Settings → Environment Variables:

- `GEMINI_API_KEY`
- `NVIDIA_API_KEY`
- `VITE_YOUTUBE_API_KEY`

After setting variables, trigger a new deploy.

Lets Go
