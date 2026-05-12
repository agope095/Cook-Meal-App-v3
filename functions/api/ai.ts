import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  LONGCAT_API_KEY: string;
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type AIAction = 'meal-plan' | 'chat' | 'batch-translate' | 'single-translate' | 'generate-grocery' | 'batch-nutrition';

const jsonResponse = (statusCode: number, body: unknown) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
});

const extractJsonArray = (rawText: string): any[] => {
  const startIndex = rawText.indexOf('[');
  const endIndex = rawText.lastIndexOf(']');
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return [];
  try {
    return JSON.parse(rawText.substring(startIndex, endIndex + 1));
  } catch {
    return [];
  }
};

const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch (err: any) {
    console.error('[ERROR] JWT Decode failed:', err.message);
    return null;
  }
};

const callLongcat = async (messages: ChatMessage[], env: Env, temperature = 0.5) => {
  const longcatKey = (env.LONGCAT_API_KEY || '').trim();
  if (!longcatKey) throw new Error('LONGCAT_API_KEY is missing on the server.');

  console.log('[DEBUG] Calling Longcat API (Longcat-Flash-Lite)...');
  const response = await fetch('https://api.longcat.chat/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${longcatKey}`,
    },
    body: JSON.stringify({
      model: 'Longcat-Flash-Lite',
      messages,
      temperature,
      max_tokens: 8192,
    })
  });

  console.log('[DEBUG] Longcat Response Status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ERROR] Longcat API Error Body:', errorText);
    throw new Error(`Longcat API failed with status ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGemini = async (promptOrMessages: string | ChatMessage[], env: Env) => {
  const geminiKey = (env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) throw new Error('GEMINI_API_KEY is missing on the server.');

  let prompt = '';
  if (typeof promptOrMessages === 'string') {
    prompt = promptOrMessages;
  } else {
    prompt = promptOrMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  }

  console.log('[DEBUG] Calling Gemini API via fetch...');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      })
    }
  );

  console.log('[DEBUG] Gemini Response Status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ERROR] Gemini API Error Body:', errorText);
    throw new Error(`Gemini API failed with status ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const onRequestOptions: any = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;
  console.log('[DEBUG] AI Function triggered at:', new Date().toISOString());

  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = decodeJwt(token);
    const projectId = (env.FIREBASE_PROJECT_ID || '').trim();

    if (!decoded || !projectId) {
      return jsonResponse(401, { error: 'Unauthorized: Invalid token format' });
    }

    if (decoded.aud !== projectId || decoded.iss !== `https://securetoken.google.com/${projectId}` || decoded.exp < Math.floor(Date.now() / 1000)) {
      return jsonResponse(401, { error: 'Unauthorized: Token validation failed' });
    }

    const payload: any = await request.json();
    const action = payload.action as AIAction;
    if (!action) return jsonResponse(400, { error: 'Missing action' });

    const userProfile = payload.userProfile || {};
    const cookLanguage = userProfile.cookLanguage || 'Bengali';
    const baseUserInfo = userProfile.name ? `User Name: ${userProfile.name}. City: ${userProfile.city || 'Unknown'}. Society: ${userProfile.society || 'Unknown'}.` : '';
    const cookLanguageInfo = `Cook's Language: ${cookLanguage}.`;
    
    const userMemory = payload.culinaryMemory || 'No personal preferences recorded yet.';

    let currentMemory = userMemory;
    let memoryWasSummarized = false;
    if (userMemory.length > 2000) {
      console.log('[DEBUG] Memory too long, requesting summarization...');
      const summaryPrompt = `Summarize the following user culinary preferences into a concise paragraph (max 500 chars), preserving ALL allergies and strong dislikes:\n${userMemory}`;
      try {
        currentMemory = await callLongcat([{ role: 'user', content: summaryPrompt }], env, 0.3);
        memoryWasSummarized = true;
      } catch {
        currentMemory = await callGemini(summaryPrompt, env);
        memoryWasSummarized = true;
      }
    }

    if (action === 'meal-plan') {
      const { prompt, startDate, existingDraft, pastMeals, favorites, plannedMeals = ['lunch', 'dinner'] } = payload;

      const mealSchemaObj = plannedMeals.map((meal: string) => `
  "${meal}": [{
    "name": "string", 
    "nameBn": "${cookLanguage} script translation",
    "quantity": "string", 
    "quantityBn": "${cookLanguage} script translation",
    "instruction": "string",
    "instructionBn": "${cookLanguage} script translation",
    "nutrition": { "kcal": number, "protein": number, "carbs": number, "fat": number }
  }]`).join(',');

      let systemInstruction = `You are an expert AI meal planner. ${baseUserInfo} ${cookLanguageInfo}\nStart date: ${startDate}.\n`;
      systemInstruction += `USER MEMORY/PREFERENCES: ${currentMemory}\n`;
      systemInstruction += `STRICT FOCUS: Only modify the specific meals (${plannedMeals.join('/')}) or date mentioned in the User Request. 
PRESERVATION RULE: If an "existingDraft" (Current Draft) is provided, you MUST preserve all existing meal items (name, quantity, instructions, nutrition) for any meal or date that the user is NOT explicitly asking to change. Do NOT return an empty array [] for a meal if it already has content in the draft unless specifically asked to clear it.
INSTRUCTION RULE: Leave "instruction" and "instructionBn" as empty strings ("") unless the user explicitly asks for instructions, recipes, or if there is a critical dietary note. Do not add general descriptions of the dishes.
SCHEMA: Return ONLY a JSON array of objects with this EXACT structure:
[{
  "date": "YYYY-MM-DD",${mealSchemaObj}
}]
If no items for a meal and no existing content, return an empty array []. Keep suggestions healthy and balanced. Use high-quality ${cookLanguage} script. QUANTITY RULE: If a quantity is mentioned, calculate nutrition for that amount. Otherwise, estimate based on typical portion sizes. SERVING INTELLIGENCE: For each item, also return inside "nutrition": "per100g" (nutrition per 100g of the cooked dish as {kcal, protein, carbs, fat}), "servingGrams" (estimated total weight in grams for the quantity specified), and "servings" (integer number of persons the quantity is intended for — infer from context like "for 2 people", "4 portions"; default to 1 if unclear).`;

      if (pastMeals) systemInstruction += `\nPast meals:\n${pastMeals}`;
      if (favorites?.length) systemInstruction += `\nFavorites:\n${favorites.join(', ')}`;
      const contents = existingDraft?.length ? `Current Draft:\n${JSON.stringify(existingDraft)}\nTweak Request: ${prompt}` : prompt;
      
      let rawText = '';
      try {
        rawText = await callLongcat([{ role: 'user', content: `${systemInstruction}\nRequest: ${contents}` }], env, 0.5);
      } catch (err) {
        console.warn('[WARN] Longcat failed for meal-plan, falling back to Gemini:', err);
        rawText = await callGemini(`${systemInstruction}\nRequest: ${contents}`, env);
      }
      return jsonResponse(200, { data: extractJsonArray(rawText) });
    }

    if (action === 'chat') {
      const { messages, pastMeals, favorites, currentDate } = payload;
      let systemInstruction = `You are "SousChefAI", a friendly, slightly chatty, and knowledgeable culinary assistant. ${baseUserInfo}\n`;
      systemInstruction += `STRICT RULE: Respond in English (the user's language) regardless of the cook's language setting. Your goal is to assist the household owner.\n`;
      systemInstruction += `CURRENT DATE: ${currentDate || new Date().toISOString()}\n`;
      systemInstruction += `USER MEMORY: ${currentMemory}\n`;
      systemInstruction += `GREETING: Start with a warm, natural greeting that mentions the user's name if known and their city (${userProfile.city}). Example: "Good evening, ${userProfile.name}! Hope you're having a lovely night in ${userProfile.city}." DO NOT state the full date or time in your greeting as it sounds robotic. Use the CURRENT DATE provided for context only (e.g., to know it's late evening) but don't repeat it back to the user unless they ask.\n`;
      systemInstruction += `STRICT RULE: Only use the "User's Past meals" provided below. If today's meal isn't listed, DO NOT guess what the user ate. Say "I don't see what you had for lunch today yet—want to tell me?" instead of assuming.\n`;
      systemInstruction += `CONVERSATION STYLE: Be charming, helpful, and sophisticated. Imagine you are a private concierge. Keep responses to 2-4 concise sentences. Always end with a helpful culinary-related question or suggestion.\n`;
      systemInstruction += `TOPIC STEERING: You are a dedicated culinary specialist. If the user diverts to non-culinary topics (e.g., politics, unrelated news, general tech), politely and charmingly steer the conversation back to food, nutrition, or their kitchen management.\n`;
      systemInstruction += `MEMORY UPDATE: If the user mentions a preference, allergy, or habit, return your response inside a JSON object like this: {"reply": "...", "updateMemory": "user likes spicy food"}.
MEAL ADDITION RULE: If the user explicitly asks to add a brainstormed recipe to their meal plan, YOU MUST FIRST confirm the number of people and the exact meal (e.g., 'lunch' or 'dinner' on a specific day). Once confirmed, return a JSON object with this exact structure:
{"reply": "...", "addToPlan": {"date": "YYYY-MM-DD", "meal": "lunch", "items": [{"name": "string", "nameBn": "${cookLanguage} translation", "quantity": "string", "quantityBn": "${cookLanguage} translation", "instruction": "string", "instructionBn": "${cookLanguage} translation", "nutrition": { "kcal": number, "protein": number, "carbs": number, "fat": number }}]}}
Otherwise, just return the text reply or the JSON with "reply" and "updateMemory".`;
      
      if (pastMeals) systemInstruction += `\nUser's Past meals:\n${pastMeals}`;
      if (favorites?.length) systemInstruction += `\nUser's Favorites:\n${favorites.join(', ')}`;
      
      let content = '';
      try {
        content = await callLongcat([{ role: 'system', content: systemInstruction }, ...(messages || [])], env, 0.7);
      } catch (err) {
        console.warn('[WARN] Longcat failed for chat, falling back to Gemini:', err);
        content = await callGemini([{ role: 'system', content: systemInstruction }, ...(messages || [])], env);
      }
      
      try {
        const parsed = JSON.parse(content);
        if (parsed.reply) {
          return jsonResponse(200, { 
            data: parsed.reply, 
            memoryUpdate: parsed.updateMemory, 
            addToPlan: parsed.addToPlan,
            summarizedMemory: memoryWasSummarized ? currentMemory : undefined 
          });
        }
      } catch {
        // Fallback to plain text
      }
      
      return jsonResponse(200, { data: content, summarizedMemory: memoryWasSummarized ? currentMemory : undefined });
    }

    if (action === 'batch-translate') {
      const { items } = payload;
      const prompt = `Translate the following dish objects into ${cookLanguage} script. Translate "name", "quantity", and "instruction" fields. Return ONLY a JSON array of objects with keys: name, nameBn, quantity, quantityBn, instruction, instructionBn.\nItems: ${JSON.stringify(items)}`;
      let rawText = '';
      try {
        rawText = await callLongcat([{ role: 'user', content: prompt }], env, 0.1);
      } catch {
        rawText = await callGemini(prompt, env);
      }
      return jsonResponse(200, { data: extractJsonArray(rawText) });
    }

    if (action === 'single-translate') {
      const { englishName } = payload;
      const prompt = `Translate "${englishName}" to ${cookLanguage} script. Return ONLY the translated text in ${cookLanguage} script, no other words.`;
      let text = '';
      try {
        text = await callLongcat([{ role: 'user', content: prompt }], env, 0.1);
      } catch {
        text = await callGemini(prompt, env);
      }
      return jsonResponse(200, { data: text.trim() });
    }

    if (action === 'generate-grocery') {
      const { meals } = payload;
      const prompt = `Based on the following meal plan, generate a comprehensive grocery list. Categorize items (e.g., Produce, Dairy, Pantry).
Meals: ${JSON.stringify(meals)}
Return ONLY a JSON array of strings, where each string is an item and its approximate quantity (e.g., "Chicken - 500g", "Tomatoes - 4 large").`;
      
      let rawText = '';
      try {
        rawText = await callLongcat([{ role: 'user', content: prompt }], env, 0.3);
      } catch {
        rawText = await callGemini(prompt, env);
      }
      return jsonResponse(200, { data: extractJsonArray(rawText) });
    }

    if (action === 'batch-nutrition') {
      const { items } = payload;
      const prompt = `Estimate nutritional values for the following dishes. 
STRICT RULE: You MUST return the EXACT "id" provided for each dish.
QUANTITY RULE: If a quantity is mentioned (e.g., "6 roti" or "for 2 people"), calculate for the ENTIRE amount. If no quantity is mentioned, assume a standard single serving.
SERVING INTELLIGENCE: Also return "per100g" (nutrition per 100g of the cooked dish), "servingGrams" (estimated total weight in grams for the quantity specified), and "servings" (integer number of persons the quantity is intended for — default 1 if unclear).
Items: ${JSON.stringify(items)}
Structure: [{"id": "...", "name": "...", "kcal": number, "protein": number, "carbs": number, "fat": number, "per100g": {"kcal": number, "protein": number, "carbs": number, "fat": number}, "servingGrams": number, "servings": number}]`;
      
      let rawText = '';
      try {
        rawText = await callLongcat([{ role: 'user', content: prompt }], env, 0.2);
      } catch {
        rawText = await callGemini(prompt, env);
      }
      return jsonResponse(200, { data: extractJsonArray(rawText) });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[CRITICAL] Function Error:', error.message);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};
