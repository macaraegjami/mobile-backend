// src/config/api.js
export const API_KEYS = {
  OPENROUTER: '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'
};

// Log API key status (first few characters only for security)
console.log("🔑 OpenRouter API Key Status:", 
  API_KEYS.OPENROUTER ? 
  `✅ Loaded (${API_KEYS.OPENROUTER.substring(0, 10)}...)` : 
  '❌ Missing'
);