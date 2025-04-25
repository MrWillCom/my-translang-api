import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import userAgents from './user-agents.json' with { type: 'json' };
import languages from './languages.json' with { type: 'json' };

const DEFAULT_SL = 'auto';
const DEFAULT_TL = 'en';

const app = new Hono();

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Parse the Google Translate API response
function parseTranslateResponse(data) {
  try {
    // console.log({ data });
    // The response structure is complex and nested
    // First array contains translation segments
    const translationSegments = data[0] || [];

    // Extract translated text by joining all segments
    let translatedText = '';
    for (const segment of translationSegments) {
      if (segment[0]) {
        translatedText += segment[0];
      }
    }

    // Extract detected language from the second-to-last array
    const detectedLanguage = data[2] || null;

    // Extract pronunciation if available (usually in data[0][1])
    let pronunciation = null;
    if (data[0] && data[0][1]) {
      pronunciation = data[0][1][3];
    }

    return {
      detected_language: detectedLanguage,
      translated_text: translatedText,
      pronunciation,
    };
  } catch (error) {
    console.error('Error parsing translation response:', error);
    return {
      error: 'Failed to parse translation response',
    };
  }
}

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.get('/', (c) => {
  const routes = app.routes.reduce((acc, route) => {
    if (route.path.startsWith('/api')) {
      acc.push(`${route.method} ${route.path}`);
    }
    return acc;
  }, []);
  return c.json({ routes });
});

app.get('/favicon.ico', (c) => {
  c.status(204);
  return c.body(null);
});

app.get('/api/v1/translate', async (c) => {
  const url = new URL(c.req.url);
  const sourceLanguage = url.searchParams.get('sl') || DEFAULT_SL;
  const targetLanguage = url.searchParams.get('tl') || DEFAULT_TL;
  const text = url.searchParams.get('text') || '';

  if (!text) {
    return c.json({ error: 'Text parameter is required' }, 400);
  }

  return await translateText(c, sourceLanguage, targetLanguage, text);
});

app.get('/api/v1/languages', (c) => c.json(languages));

app.post('/api/v1/translate', async (c) => {
  let sourceLanguage = DEFAULT_SL;
  let targetLanguage = DEFAULT_TL;
  let text = '';

  try {
    // Try to parse as JSON first
    const body = await c.req.json();
    sourceLanguage = body.sl || sourceLanguage;
    targetLanguage = body.tl || targetLanguage;
    text = body.text || '';
  } catch (error) {
    console.error('Error parsing JSON:', error);
    // If JSON parsing fails, try to get form data
    const formData = await c.req.formData();
    sourceLanguage = formData.get('sl') || sourceLanguage;
    targetLanguage = formData.get('tl') || targetLanguage;
    text = formData.get('text') || '';
  }

  if (!text) {
    return c.json({ error: 'Text parameter is required' }, 400);
  }

  return await translateText(c, sourceLanguage, targetLanguage, text);
});

async function translateText(c, sourceLanguage, targetLanguage, text) {
  // Validate source language
  if (sourceLanguage !== 'auto' && !languages.sl[sourceLanguage]) {
    return c.json({ error: `Invalid source language: ${sourceLanguage}` }, 400);
  }

  // Validate target language
  if (!languages.tl[targetLanguage]) {
    return c.json({ error: `Invalid target language: ${targetLanguage}` }, 400);
  }

  // Construct the Google Translate API URL
  const apiUrl = new URL('https://translate.googleapis.com/translate_a/single');
  apiUrl.searchParams.append('client', 'gtx');
  apiUrl.searchParams.append('sl', sourceLanguage);
  apiUrl.searchParams.append('tl', targetLanguage);
  apiUrl.searchParams.append('dt', 't'); // Translation
  apiUrl.searchParams.append('dt', 'rm'); // Romanization
  apiUrl.searchParams.append('dt', 'ld'); // Language detection
  apiUrl.searchParams.append('q', text);

  // Make the request to Google Translate API with UA rotation
  let response;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    response = await fetch(apiUrl.toString(), {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json',
      },
    });

    if (response.ok || response.status !== 429) {
      break;
    }

    // If response is not ok, wait for a moment before retrying
    console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
    retryCount++;
    await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
  }

  if (!response.ok) {
    console.error(
      `Google Translate API error: ${response.status} ${response.statusText}`,
    );
    return c.json(
      { error: `Translation API error: ${response.status}` },
      response.status,
    );
  }

  const data = await response.json();
  const result = parseTranslateResponse(data);

  if (!result.translated_text) {
    return c.json(
      { error: result?.error || 'Translation failed' },
      500,
    );
  } else if (result.translated_text?.trim() === text.trim()) {
    return c.json(
      {
        ...result,
        error: 'Translation is the same as input text',
      }
    );
  }

  // Cache for a week
  c.header('Cache-Control', 'public, max-age=604800');

  return c.json(result);
}

app.notFound((c) => c.json({ error: 'Not found' }, 404));

Deno.serve(app.fetch);
