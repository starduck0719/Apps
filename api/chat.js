export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, apiKey, model } = await req.json();

    // Use provided key from frontend, or fallback to the one configured in code
    const API_KEY = apiKey || "sk-c422zhoyiteawbh22t08jfon8s08dg923r2h9kiw030uetce";
    const API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
    
    // Prefer model from client to allow easy updates, fallback to mimo-v2-flash
    const targetModel = model || "mimo-v2-flash";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
        response_format: { type: "json_object" } 
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Provider Error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}