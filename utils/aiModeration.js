const fetch = require('node-fetch');

// JSON ayrıştırma yardımcısı (Aynen korundu)
function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text && text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

async function moderateTextAI(input) {
  // API Key kontrolü
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GENERATIVE_LANGUAGE_API_KEY;
  if (!apiKey || !input || !input.trim()) {
    return { block: false, categories: [], severity: 0, reason: 'no_api_or_empty' };
  }

  // DÜZELTME 1: Model ismi 'gemini-1.5-flash' olarak güncellendi.
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'You are a strict content moderation classifier for a Turkish Discord server. ' +
              'Classify the following message for profanity/toxicity/harassment/hate/sexual/violence. ' +
              'Output JSON only with keys: block(boolean), severity(number 0-1), categories(array of strings), reasoning(string). ' +
              'Block if the message contains standalone profanity (e.g., "amk", "oç", "sik", "aq"). ' +
              'Do NOT block benign words that merely contain profanity substrings inside longer words (e.g., "selam" contains "am" but is SAFE, "tamam" is SAFE, "sikke" is SAFE). ' +
              'Message: ' + JSON.stringify(input)
          }
        ]
      }
    ],
    // DÜZELTME 2: Güvenlik Ayarları (Safety Settings)
    // Modelin küfürlü girdiyi reddetmemesi ve analiz etmesi için filtreleri kapatıyoruz.
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json'
    }
  };

  try {
    // Timeout için AbortController kullanımı (Daha güvenilir)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // İşlem biterse zamanlayıcıyı temizle

    if (!res.ok) {
      // Hata durumunda log basmak sorunu anlamana yardımcı olur
      console.error(`Gemini API Error: ${res.status} - ${res.statusText}`);
      return { block: false, categories: [], severity: 0, reason: 'http_' + res.status };
    }

    const data = await res.json();
    
    // Yanıt kontrolü: Bazen filtreler yüzünden 'parts' boş gelebilir
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
        // Eğer text yoksa, muhtemelen API'nin kendi güvenlik duvarına takılmıştır (çok ağır içerik)
        // Bu durumda varsayılan olarak bloklamak mantıklıdır.
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
             return { block: true, severity: 1, categories: ['SAFETY_FILTER'], reasoning: 'Google API blocked inputs processing.' };
        }
        return { block: false, categories: [], severity: 0, reason: 'empty_response' };
    }

    const parsed = tryParseJson(text) || {};
    const block = !!parsed.block;
    const severity = typeof parsed.severity === 'number' ? parsed.severity : (block ? 0.7 : 0);
    const categories = Array.isArray(parsed.categories) ? parsed.categories : [];

    return { block, severity, categories, reasoning: parsed.reasoning || '' };

  } catch (e) {
    // Timeout veya ağ hatası
    const isTimeout = e.name === 'AbortError';
    return { block: false, categories: [], severity: 0, reason: isTimeout ? 'timeout' : ('error_' + (e?.message || 'unknown')) };
  }
}

module.exports = { moderateTextAI };
