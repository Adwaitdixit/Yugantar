import type { GeminiCulturalAnalysis } from '../src/data/types.ts';

const SYSTEM_INSTRUCTION = `You are an AI assistant in Dharohar Setu, India's digital platform for preserving living cultural heritage.
Analyze the user's input text according to this exact flow:
1. Language Detection: Identify the primary language and regional dialect.
2. Cultural Category Detection: Classify into appropriate cultural domains (e.g., Oral Story, Folk Song, Traditional Craft, Sacred Ritual, Culinary Heritage, Heritage Site).
3. Cultural Information Extraction: Extract title, state, district, community.
4. Entity Extraction: Identify people, practitioners, gurus, deities, and distinct cultural practices.
5. Claim Extraction: Break the narrative into discrete, verifiable atomic claims.
6. Evidence Requirements: For each claim, determine if external documentary evidence is needed.
7. Summary: Provide an objective, culturally sensitive summary.
8. Structured Cultural Record: Output MUST be a single, valid JSON object without extra conversational text.

CRITICAL RULE ON FACTUALITY & EVIDENCE:
You must NOT treat your own internal training data or AI knowledge as authoritative proof.
You must NOT independently declare a historical, archaeological, or empirical claim as verified unless it cites established institutional documentation (such as ASI, IGNCA, UNESCO, Census, or Gazetteers).
Allowed claim statuses:
- "Source-supported": backed by recognized historical records, gazetteers, or institutional surveys mentioned in text.
- "Community-verified": living practice preserved through community consensus.
- "Oral-tradition": traditional belief, lore, or myth without formal documentation.
- "Unverified": empirical/historical assertion needing external documentary evidence.
- "Conflicting": contested or conflicting claims.

JSON schema to return strictly:
{
  "language": "string",
  "title": "string",
  "category": "string",
  "state": "string",
  "district": "string",
  "community": "string",
  "people": ["string"],
  "culturalPractices": ["string"],
  "summary": "string",
  "keywords": ["string"],
  "claims": [
    {
      "claim": "string",
      "claimType": "historical | geographical | ritual | artistic | metallurgical | demographic",
      "evidenceNeeded": true,
      "status": "Source-supported | Community-verified | Oral-tradition | Unverified | Conflicting",
      "reasoning": "string explaining what evidence is needed or why this status was assigned"
    }
  ]
}`;

export async function handleGeminiAnalysis(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Read request body
  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      const inputText = data.text?.trim();

      if (!inputText) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Input text is required for AI analysis.' }));
        return;
      }

      // Read key from server environment or .env
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'GEMINI_API_KEY is not configured on the server.',
          code: 'API_KEY_MISSING',
          message: 'Please add GEMINI_API_KEY in your server .env file.'
        }));
        return;
      }

      // Prioritize high-speed models with fast response
      const modelsToTry = [
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest'
      ];
      let geminiResponse: any = null;
      let lastError = '';

      for (const model of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${SYSTEM_INSTRUCTION}\n\nCultural Knowledge Input to Analyze:\n"""${inputText}"""` }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                responseMimeType: 'application/json'
              }
            })
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            geminiResponse = response;
            break;
          } else {
            const errBody = await response.text();
            lastError = `Model ${model} returned ${response.status}: ${errBody}`;
          }
        } catch (e: any) {
          lastError = e.message || 'Fetch failed';
        }
      }

      if (!geminiResponse) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Failed to communicate with Google Gemini API.',
          code: 'GEMINI_API_ERROR',
          details: lastError
        }));
        return;
      }

      const rawJson: any = await geminiResponse.json();
      const contentText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contentText) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Empty response received from Gemini AI.',
          code: 'EMPTY_RESPONSE'
        }));
        return;
      }

      // Clean markdown code blocks if present
      let cleanJsonText = contentText.trim();
      if (cleanJsonText.startsWith('```json')) {
        cleanJsonText = cleanJsonText.slice(7);
      } else if (cleanJsonText.startsWith('```')) {
        cleanJsonText = cleanJsonText.slice(3);
      }
      if (cleanJsonText.endsWith('```')) {
        cleanJsonText = cleanJsonText.slice(0, -3);
      }
      cleanJsonText = cleanJsonText.trim();

      const parsedResult: GeminiCulturalAnalysis = JSON.parse(cleanJsonText);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        data: parsedResult
      }));

    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'An internal server error occurred while processing with Gemini.',
        details: err.message
      }));
    }
  });
}
