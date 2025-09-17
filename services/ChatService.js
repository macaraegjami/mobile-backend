// src/services/ChatService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeepSeekService from './DeepSeekService';

class ChatService {
  constructor() {
    this.conversationHistory = [];
    this.responseCache = new Map();
    this.lastCacheClean = Date.now();
    this.userProfile = null;
    this.currentTopic = null;
    this.predefinedResponses = this.loadPredefinedResponses();
    
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      const savedHistory = await AsyncStorage.getItem('clams_conversation_history');
      if (savedHistory) {
        this.conversationHistory = JSON.parse(savedHistory);
      }

      const savedProfile = await AsyncStorage.getItem('clams_user_profile');
      if (savedProfile) {
        this.userProfile = JSON.parse(savedProfile);
      }

      const savedCache = await AsyncStorage.getItem('clams_response_cache');
      if (savedCache) {
        const cacheData = JSON.parse(savedCache);
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        Object.entries(cacheData).forEach(([key, value]) => {
          if (value.timestamp > oneDayAgo) {
            this.responseCache.set(key, value.response);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load saved data:', error);
    }
  }

  async saveToStorage() {
    try {
      const limitedHistory = this.conversationHistory.slice(-50);
      await AsyncStorage.setItem('clams_conversation_history', JSON.stringify(limitedHistory));

      if (this.userProfile) {
        await AsyncStorage.setItem('clams_user_profile', JSON.stringify(this.userProfile));
      }

      const cacheToSave = {};
      let count = 0;
      for (const [key, value] of this.responseCache.entries()) {
        if (count < 25) {
          cacheToSave[key] = {
            response: value,
            timestamp: Date.now()
          };
          count++;
        }
      }
      await AsyncStorage.setItem('clams_response_cache', JSON.stringify(cacheToSave));
    } catch (error) {
      console.warn('Failed to save data:', error);
    }
  }

  loadPredefinedResponses() {
    return {
      // Quick answers for common questions
      "hello": "Ahoy! I'm De Malacca, your AIMS-CLAMS maritime assistant! How can I help you navigate maritime education today?",
      "hi": "Fair winds! I'm De Malacca. Ready to chart your course through AIMS programs and CLAMS library services?",
      "good morning": "Good morning! I'm De Malacca, named after the great navigator. What maritime knowledge can I help you discover today?",
      
      // Hours and contact
      "hours": "CLAMS Library is open Monday-Friday 7AM-7PM, Saturday 8AM-5PM. Contact: (02) 8831-9925. What specific service do you need?",
      "contact": "AIMS-CLAMS Contact: (02) 8831-9925 | info@aims.edu.ph | Located in Pasay City, Metro Manila. How can we assist you?",
      "location": "AIMS is located in Pasay City, Metro Manila, Philippines. Near the airport and maritime industry hub. Need directions?",
      
      // Quick program info
      "programs": "AIMS offers BS Marine Engineering, BS Marine Transportation, BS Customs Administration, and BS Maritime Business Management. Which program interests you?",
      "marine engineering": "Our Marine Engineering program focuses on ship engine operations, marine machinery, and power systems with hands-on simulator training. Want admission details?",
      "marine transportation": "Marine Transportation covers navigation, cargo operations, and vessel management with bridge simulator training. Interested in the curriculum?",
      
      // Membership quick answers
      "membership": "AIMS students: FREE | External researchers: ₱500/day or ₱2,000/month | Alumni: ₱1,000/year. What type of membership do you need?",
      "fees": "CLAMS membership: Students free, external researchers ₱500/day, alumni ₱1,000/year. AIMS tuition varies by program. Need specific cost details?",
      
      // System responses
      "system_error": "I'm experiencing technical difficulties. Please try again or contact CLAMS staff at (02) 8831-9925.",
      "ai_unavailable": "My AI systems are temporarily down. Please contact CLAMS directly for immediate assistance!"
    };
  }

  // Enhanced response generation with better flow
  async generateResponse(userInput) {
    try {
      this.addToHistory('user', userInput);
      this.updateConversationContext(userInput);
      this.cleanCacheIfNeeded();
      
      if (!userInput || userInput.trim().length === 0) {
        return "Please enter a question or message for me to help you with!";
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(userInput);
      if (this.responseCache.has(cacheKey)) {
        const cachedResponse = this.responseCache.get(cacheKey);
        this.addToHistory('assistant', cachedResponse);
        return cachedResponse;
      }

      // Check for quick predefined responses
      const quickResponse = this.getQuickResponse(userInput);
      if (quickResponse) {
        this.addToHistory('assistant', quickResponse);
        this.responseCache.set(cacheKey, quickResponse);
        await this.saveToStorage();
        return quickResponse;
      }

      // Build better context for AI
      const enhancedPrompt = this.buildEnhancedPrompt(userInput);

      // Send to AI service with better error handling
      const response = await DeepSeekService.generateResponse(enhancedPrompt);
      if (!response || response.trim().length === 0) {
        return this.generateContextualFallback(userInput);
      }
      
      // Clean up AI response if it's too generic
      const cleanedResponse = this.cleanAIResponse(response, userInput);
      
      this.addToHistory('assistant', cleanedResponse);
      this.responseCache.set(cacheKey, cleanedResponse);
      await this.saveToStorage();
      
      return cleanedResponse;
    } catch (error) {
      console.error("ChatService error:", error);
      return this.generateContextualFallback(userInput);
    }
  }

  // NEW: Quick response checker for common queries
  getQuickResponse(userInput) {
    const input = userInput.toLowerCase().trim();
    
    // Check exact matches first
    if (this.predefinedResponses[input]) {
      return this.predefinedResponses[input];
    }

    // Check partial matches for basic greetings only
    const basicGreetings = ['hello', 'hi', 'good morning', 'good afternoon', 'good evening'];
    for (const greeting of basicGreetings) {
      if (input === greeting || (input.startsWith(greeting) && input.length < 20)) {
        return this.predefinedResponses[greeting] || this.predefinedResponses['hello'];
      }
    }

    // For all other queries, return null to use AI
    return null;
  }

  // NEW: Build enhanced prompt for AI
  buildEnhancedPrompt(userInput) {
    // Get recent conversation context (last 2 exchanges)
    const recentContext = this.getRecentContext();
    
    // Detect query type for better AI prompting
    const queryType = this.detectQueryType(userInput);
    
    const basePrompt = `You are De Malacca, AIMS-CLAMS maritime assistant. Answer the user's specific question directly and helpfully.

IMPORTANT INSTRUCTIONS:
- Give a DIRECT, SPECIFIC answer to the user's exact question
- Do NOT start with generic introductions like "I'm De Malacca" unless it's a greeting
- Be concise but helpful (under 150 words)
- Use maritime terminology when appropriate
- If you don't know specific details, say so and offer to connect them with staff

CONTEXT: ${recentContext}

QUERY TYPE: ${queryType}

AIMS-CLAMS INFO:
- Location: Pasay City, Metro Manila
- Contact: (02) 8831-9925 | info@aims.edu.ph  
- Library Hours: Mon-Fri 7AM-7PM, Sat 8AM-5PM
- Programs: Marine Engineering, Marine Transportation, Customs Admin, Maritime Business
- Facilities: Ship simulators, 25K+ maritime books, IMO publications
- Membership: Students free, researchers ₱500/day, alumni ₱1,000/year

USER QUESTION: ${userInput}`;

    return basePrompt;
  }

  // NEW: Detect what type of query this is
  detectQueryType(userInput) {
    const input = userInput.toLowerCase();
    
    if (input.includes('how much') || input.includes('cost') || input.includes('fee') || input.includes('price')) {
      return "PRICING_QUESTION - Give specific costs and fees";
    }
    if (input.includes('hour') || input.includes('open') || input.includes('close') || input.includes('schedule')) {
      return "HOURS_QUESTION - Give operating hours";
    }
    if (input.includes('borrow') || input.includes('checkout') || input.includes('loan')) {
      return "BORROWING_QUESTION - Give borrowing policies";
    }
    if (input.includes('program') || input.includes('course') || input.includes('admission')) {
      return "ACADEMIC_QUESTION - Give program information";
    }
    if (input.includes('membership') || input.includes('join') || input.includes('register')) {
      return "MEMBERSHIP_QUESTION - Give membership details";
    }
    if (input.includes('museum') || input.includes('artifact') || input.includes('exhibition')) {
      return "MUSEUM_QUESTION - Give museum information";
    }
    if (input.includes('archive') || input.includes('historical') || input.includes('document')) {
      return "ARCHIVES_QUESTION - Give archives information";
    }
    
    return "GENERAL_QUESTION - Answer helpfully and specifically";
  }

  // NEW: Get recent conversation context
  getRecentContext() {
    if (this.conversationHistory.length <= 2) {
      return "This is a new conversation.";
    }
    
    const recent = this.conversationHistory.slice(-4); // Last 2 exchanges
    return recent.map(h => `${h.role}: ${h.content.substring(0, 100)}`).join('\n');
  }

  // NEW: Clean AI response to avoid generic repetitive answers
  cleanAIResponse(response, userInput) {
    let cleaned = response.trim();
    
    // If response is too generic or repetitive, make it more specific
    if (cleaned.toLowerCase().includes("i'm de malacca") && !this.isGreeting(userInput)) {
      // Remove generic introductions from non-greeting responses
      cleaned = cleaned.replace(/^.*?I'm De Malacca[^.]*\.?\s*/i, '');
      cleaned = cleaned.replace(/^.*?Ahoy[^.]*\.?\s*/i, '');
    }
    
    // If response is still too short or generic, add context
    if (cleaned.length < 50 && !this.isSimpleQuery(userInput)) {
      cleaned += " Would you like more specific details about this topic?";
    }
    
    return cleaned || "I'd be happy to help you with that. Could you provide a bit more detail about what specific information you're looking for?";
  }

  // NEW: Check if user input is a greeting
  isGreeting(userInput) {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hola'];
    const input = userInput.toLowerCase().trim();
    return greetings.some(greeting => input === greeting || input.startsWith(greeting + ' '));
  }

  // NEW: Check if query is simple (yes/no or short answer)
  isSimpleQuery(userInput) {
    const simpleWords = ['yes', 'no', 'okay', 'thanks', 'thank you'];
    return simpleWords.includes(userInput.toLowerCase().trim());
  }

  // IMPROVED: Better contextual fallback
  generateContextualFallback(userInput) {
    const input = userInput.toLowerCase();
    
    // Specific fallbacks based on query content
    if (input.includes('cost') || input.includes('fee') || input.includes('price') || input.includes('how much')) {
      return "Here are our current fees: AIMS students get free library access. External researchers pay ₱500/day or ₱2,000/month. Alumni membership is ₱1,000/year. For AIMS program tuition, please contact admissions at (02) 8831-9925. What specific costs did you want to know about?";
    }
    
    if (input.includes('artifact') || input.includes('museum') || input.includes('display')) {
      return "Our Maritime Museum features historic ship models, maritime artifacts, and Philippine naval history exhibits. Admission is included with library membership. We offer educational tours for groups by appointment. Would you like to schedule a museum visit?";
    }
    
    if (input.includes('hour') || input.includes('open') || input.includes('schedule')) {
      return "CLAMS Library hours: Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM. Archives and Museum access by appointment. Contact us at (02) 8831-9925 to schedule visits. What specific service do you need?";
    }
    
    if (input.includes('program') || input.includes('course') || input.includes('marine')) {
      return "AIMS offers these maritime programs: BS Marine Engineering (ship engines & machinery), BS Marine Transportation (navigation & operations), BS Customs Administration, and BS Maritime Business Management. All programs include hands-on training with ship simulators. Which program interests you most?";
    }
    
    // Default fallback
    return "I can help you with AIMS maritime programs, CLAMS library services, membership information, borrowing policies, archives access, and museum tours. Contact us directly at (02) 8831-9925 or info@aims.edu.ph for immediate assistance. What specific information do you need?";
  }

  generateCacheKey(userInput) {
    return userInput.toLowerCase()
      .replace(/[?!.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastCacheClean > 300000) { // 5 minutes
      if (this.responseCache.size > 25) {
        const entries = Array.from(this.responseCache.entries());
        this.responseCache.clear();
        entries.slice(-15).forEach(([key, value]) => {
          this.responseCache.set(key, value);
        });
      }
      this.lastCacheClean = now;
    }
  }

  updateConversationContext(userInput) {
    const keywords = userInput.toLowerCase().split(/\s+/);
    
    if (keywords.some(k => ['book', 'search', 'find', 'library'].includes(k))) {
      this.currentTopic = 'library_search';
    } else if (keywords.some(k => ['membership', 'join', 'register'].includes(k))) {
      this.currentTopic = 'membership';
    } else if (keywords.some(k => ['hours', 'open', 'schedule'].includes(k))) {
      this.currentTopic = 'hours_info';
    } else if (keywords.some(k => ['program', 'course', 'admission'].includes(k))) {
      this.currentTopic = 'academic_programs';
    } else if (keywords.some(k => ['museum', 'artifact', 'exhibition'].includes(k))) {
      this.currentTopic = 'museum';
    } else {
      this.currentTopic = 'general';
    }
  }

  async addToHistory(role, content) {
    this.conversationHistory.push({ 
      role, 
      content, 
      timestamp: new Date().toISOString()
    });
    
    // Keep last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-40);
    }
  }

  async clearAllData() {
    try {
      await AsyncStorage.multiRemove([
        'clams_conversation_history',
        'clams_user_profile',
        'clams_response_cache'
      ]);
      
      this.conversationHistory = [];
      this.responseCache.clear();
      this.userProfile = null;
      this.currentTopic = null;
      
    } catch (error) {
      console.warn('Failed to clear data:', error);
    }
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  async setUserProfile(profile) {
    this.userProfile = profile;
    await this.saveToStorage();
  }

  getCacheStats() {
    return {
      cacheSize: this.responseCache.size,
      historyLength: this.conversationHistory.length,
      currentTopic: this.currentTopic,
      lastCacheClean: new Date(this.lastCacheClean).toLocaleString()
    };
  }
}

export default new ChatService();