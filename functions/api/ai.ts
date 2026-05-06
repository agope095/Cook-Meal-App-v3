interface Env {
  NVIDIA_API_KEY: string;
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type AIAction = 'meal-plan' | 'chat' | 'batch-translate' | 'single-translate';

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

const callNvidia = async (messages: ChatMessage[], env: Env, temperature = 0.5) => {
  const nvidiaKey = (env.NVIDIA_API_KEY || '').trim();
  if (!nvidiaKey) throw new Error('NVIDIA_API_KEY is missing on the server.');

  console.log('[DEBUG] Calling NVIDIA API via fetch (Qwen 3.5 122B)...');
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${nvidiaKey}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.5-122b-a10b',
      messages,
      temperature,
      max_tokens: 2048,
      chat_template_kwargs: { enable_thinking: false },
    })
  });

  console.log('[DEBUG] NVIDIA Response Status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ERROR] NVIDIA API Error Body:', errorText);
    throw new Error(`NVIDIA API failed with status ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGemini = async (prompt: string, env: Env) => {
  const geminiKey = (env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) throw new Error('GEMINI_API_KEY is missing on the server.');

  console.log('[DEBUG] Calling Gemini API via fetch...');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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

export const onRequestOptions: PagesFunction = async () => {
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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
    const userInfo = userProfile.name ? `User Name: ${userProfile.name}. City: ${userProfile.city || 'Unknown'}. Society: ${userProfile.society || 'Unknown'}. Cook's Language: ${cookLanguage}.` : `Cook's Language: ${cookLanguage}.`;
    const userMemory = payload.culinaryMemory || 'No personal preferences recorded yet.';

    // Memory Summarization check (Keep context lean)
    let currentMemory = userMemory;
    let memoryWasSummarized = false;
    if (userMemory.length > 2000) {
      console.log('[DEBUG] Memory too long, requesting summarization...');
      const summaryPrompt = `Summarize the following user culinary preferences into a concise paragraph (max 500 chars), preserving ALL allergies and strong dislikes:\n${userMemory}`;
      try {
        currentMemory = await callNvidia([{ role: 'user', content: summaryPrompt }], env, 0.3);
        memoryWasSummarized = true;
      } catch {
        currentMemory = await callGemini(summaryPrompt, env);
        memoryWasSummarized = true;
      }
    }

    if (action === 'meal-plan') {
      const { prompt, startDate, existingDraft, pastMeals, favorites } = payload;
      let systemInstruction = `You are an expert AI meal planner. ${userInfo}\nStart date: ${startDate}.\n`;
      systemInstruction += `USER MEMORY/PREFERENCES: ${currentMemory}\n`;
      systemInstruction += `STRICT FOCUS: Only modify the specific meal (lunch/dinner) or date mentioned in the User Request. Do NOT suggest new items for other meals if they already have content or if you can leave them empty.
INSTRUCTION RULE: Leave "instruction" and "instructionBn" as empty strings ("") unless the user explicitly asks for instructions, recipes, or if there is a critical dietary note. Do not add general descriptions of the dishes.
SCHEMA: Return ONLY a JSON array of objects with this EXACT structure:
[{
  "date": "YYYY-MM-DD",
  "lunch": [{
    "name": "string", 
    "nameBn": "${cookLanguage} script translation",
    "quantity": "string", 
    "quantityBn": "${cookLanguage} script translation",
    "instruction": "string",
    "instructionBn": "${cookLanguage} script translation"
  }],
  "dinner": [{
    "name": "string", 
    "nameBn": "${cookLanguage} script translation",
    "quantity": "string", 
    "quantityBn": "${cookLanguage} script translation",
    "instruction": "string",
    "instructionBn": "${cookLanguage} script translation"
  }]
}]
If no items for lunch/dinner, return an empty array []. Keep suggestions healthy and balanced. Use high-quality ${cookLanguage} script.`;

      if (pastMeals) systemInstruction += `\nPast meals:\n${pastMeals}`;
      if (favorites?.length) systemInstruction += `\nFavorites:\n${favorites.join(', ')}`;
      const contents = existingDraft?.length ? `Current Draft:\n${JSON.stringify(existingDraft)}\nTweak Request: ${prompt}` : prompt;
      const rawText = await callNvidia([{ role: 'user', content: `${systemInstruction}\nRequest: ${contents}` }], env, 0.5);
      return jsonResponse(200, { data: extractJsonArray(rawText) });
    }

    if (action === 'chat') {
      const { messages, pastMeals, favorites, currentDate } = payload;
      let systemInstruction = `You are "SousChefAI", a friendly, slightly chatty, and knowledgeable culinary assistant. ${userInfo}\n`;

      systemInstruction += `CURRENT DATE: ${currentDate || new Date().toISOString()}\n`;
      systemInstruction += `USER MEMORY: ${currentMemory}\n`;
      systemInstruction += `GREETING: Use the User's City (${userProfile.city}) for location-based greetings (e.g., "Good evening in ${userProfile.city}!"). DO NOT mention the Society Name (${userProfile.society}) in the greeting unless the user specifically asks about it or if it's relevant to a specific local event/ingredient. Keep the greeting focused on the City.\n`;
      systemInstruction += `STRICT RULE: Only use the "User's Past meals" provided below. If today's meal isn't listed, DO NOT guess what the user ate. Say "I don't see what you had for lunch today yet—want to tell me?" instead of assuming.\n`;
      systemInstruction += `CONVERSATION STYLE: Be warm and helpful. Keep responses to 2-4 sentences. Feel free to ask a follow-up question to keep the conversation going.\n`;
      systemInstruction += `MEMORY UPDATE: If the user mentions a preference, allergy, or habit, return your response inside a JSON object like this: {"reply": "...", "updateMemory": "user likes spicy food"}. Otherwise, just return the text reply.`;
      
      if (pastMeals) systemInstruction += `\nUser's Past meals:\n${pastMeals}`;
      if (favorites?.length) systemInstruction += `\nUser's Favorites:\n${favorites.join(', ')}`;
      
      const content = await callNvidia([{ role: 'system', content: systemInstruction }, ...(messages || [])], env, 0.7);
      
      try {
        const parsed = JSON.parse(content);
        if (parsed.reply) {
          return jsonResponse(200, { 
            data: parsed.reply, 
            memoryUpdate: parsed.updateMemory,
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
        rawText = await callNvidia([{ role: 'user', content: prompt }], env, 0.1);
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
        text = await callNvidia([{ role: 'user', content: prompt }], env, 0.1);
      } catch {
        text = await callGemini(prompt, env);
      }
      return jsonResponse(200, { data: text.trim() });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[CRITICAL] Function Error:', error.message);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};
