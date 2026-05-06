import { loadEnv } from 'vite';

async function run() {
  const env = loadEnv('development', process.cwd(), '');
  const key = env.GEMINI_API_KEY;
  if (!key) {
    console.error("No API key found via Vite loadEnv");
    return;
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (data.models) {
      const gemmaModels = data.models.filter((m: any) => m.name.toLowerCase().includes('gemma'));
      console.log("Gemma models found:");
      console.log(JSON.stringify(gemmaModels.map((m: any) => m.name), null, 2));
    } else {
      console.log("No models array in response:", data);
    }
  } catch (e) {
    console.error(e);
  }
}
run();
