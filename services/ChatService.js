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
    // Only keep basic operational responses - all content queries go to AI
    return {
      "system_error": "⚓ I'm experiencing technical difficulties. Please try again or contact CLAMS staff at (02) 8831-9925.",
      "ai_unavailable": "🔧 My AI systems are temporarily down. Please contact CLAMS directly for immediate assistance!"
    };
  }

  // Enhanced AIMS-maritime related keyword detection
  isLibraryRelated(userInput) {
    const input = userInput.toLowerCase();
    
    const aimsMaritimeKeywords = [
      'aims', 'asian institute maritime', 'clams', 'library', 'archives', 'museum',
      'maritime', 'marine', 'ship', 'boat', 'vessel', 'navigation', 'seafarer',
      'captain', 'engineer', 'officer', 'sailor', 'naval', 'nautical', 'ocean',
      'sea', 'port', 'harbor', 'cargo', 'shipping', 'freight', 'imo', 'stcw',
      'engineering', 'transportation', 'customs', 'business management',
      'simulation', 'simulator', 'bridge', 'engine room',
      'books', 'book', 'borrow', 'borrowing', 'lending', 'loan', 'checkout',
      'study', 'research', 'reading', 'catalog', 'collection', 'database',
      'digital', 'ebook', 'journal', 'article', 'reference', 'bibliography',
      'member', 'membership', 'join', 'register', 'card', 'account',
      'fee', 'cost', 'price', 'payment', 'discount', 'student', 'alumni',
      'room', 'space', 'computer', 'wifi', 'internet', 'printer',
      'carrel', 'desk', 'seat', 'chair', 'table', 'lab', 'laboratory',
      'hours', 'schedule', 'open', 'close', 'holiday', 'weekend',
      'overdue', 'fine', 'penalty', 'renewal', 'extend', 'due date',
      'reservation', 'reserve', 'hold', 'request',
      'librarian', 'staff', 'help', 'assistance', 'support', 'guide',
      'tutorial', 'training', 'workshop', 'consultation', 'appointment',
      'ship models', 'maritime artifacts', 'nautical', 'admiralty',
      'maritime law', 'shipping law', 'maritime history', 'naval history',
      'filipiniana', 'historical', 'archive', 'manuscript', 'document',
      'online', 'website', 'portal', 'system', 'opac', 'search',
      'download', 'access', 'login', 'password', 'remote', 'thesis'
    ];
    
    const serviceKeywords = [
      'how', 'what', 'where', 'when', 'why', 'can i', 'do you',
      'information', 'details', 'policy', 'procedure', 'process',
      'available', 'offer', 'provide', 'service', 'facility'
    ];
    
    const educationalKeywords = ['student', 'study', 'homework', 'assignment', 'project', 'class', 'school', 'university', 'college', 'education', 'course', 'program', 'degree'];
    
    const hasAimsMaritimeKeywords = aimsMaritimeKeywords.some(keyword => input.includes(keyword));
    const hasServiceKeywords = serviceKeywords.some(keyword => input.includes(keyword));
    const hasEducationalContext = educationalKeywords.some(keyword => input.includes(keyword));
    
    return hasAimsMaritimeKeywords || (hasServiceKeywords && hasEducationalContext);
  }

  // NEW: Check for basic greetings only
  isBasicGreeting(userInput) {
    const input = userInput.toLowerCase().trim();
    const basicGreetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    
    return basicGreetings.some(greeting => 
      input === greeting || 
      (input.length <= 15 && input.includes(greeting) && input.split(' ').length <= 3)
    );
  }

  // NEW: Get basic greeting response
  getBasicGreeting(userInput) {
    const greetings = [
      "⚓ Ahoy! I'm De Malacca, your AIMS-CLAMS maritime assistant! How can I help you navigate maritime education today?",
      "🚢 Fair winds! I'm De Malacca. Ready to chart your course through AIMS programs and CLAMS library services?", 
      "⚓ Hola! I'm De Malacca, named after the great navigator. What maritime knowledge can I help you discover today?"
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // NEW: AI-first response generation (predefined responses only for basic greetings)
  async generateResponse(userInput) {
    try {
      this.addToHistory('user', userInput);
      this.updateConversationContext(userInput);
      this.cleanCacheIfNeeded();
      
      if (!userInput || userInput.trim().length === 0) {
        return "Please enter a question or message for me to help you with!";
      }

      // Check cache for exact matches
      const cacheKey = this.generateCacheKey(userInput);
      if (this.responseCache.has(cacheKey)) {
        const cachedResponse = this.responseCache.get(cacheKey);
        this.addToHistory('assistant', cachedResponse);
        return cachedResponse;
      }

      // Only use predefined responses for basic greetings
      if (this.isBasicGreeting(userInput)) {
        const greetingResponse = this.getBasicGreeting(userInput);
        this.addToHistory('assistant', greetingResponse);
        this.responseCache.set(cacheKey, greetingResponse);
        await this.saveToStorage();
        return greetingResponse;
      }

      // Always use AI for ALL other queries
      const aimsClamsContext = `You are De Mallaca, an advanced AI-powered chatbot for the Asian Institute of Maritime Studies (AIMS) and its CLAMS facility (Center of Library, Archives, and Museum Services). AIMS is a leading maritime education institution in the Philippines, and CLAMS is its library, archives, and museum, responsible for book lending, record keeping, museum artifacts, and room reservations. If users ask about AIMS, clarify it is the institution; if they ask about CLAMS, clarify it is the library, archives, and museum facility at AIMS. You are friendly, polite, and always provide helpful, user-friendly, and complete answers to any question, whether about AIMS, CLAMS, maritime topics, or general knowledge. If a question is not related to AIMS/CLAMS, answer it as best as you can, but gently remind the user of your expertise in maritime education and CLAMS services. Always be professional, positive, and helpful, and handle FAQs with clear, concise, and accurate information. If you don't know the answer, say so politely and offer to help with something else.`;

      const prompt = `${aimsClamsContext}\n\nUser: ${userInput}`;

      // Send to DeepSeekService
      const response = await DeepSeekService.generateResponse(prompt);
      if (!response || response.trim().length === 0) {
        return this.generateEmergencyFallback(userInput, null);
      }
      
      this.addToHistory('assistant', response);
      this.responseCache.set(cacheKey, response);
      await this.saveToStorage();
      
      return response;
    } catch (error) {
      // Fallbacks only if AI is unavailable
      if (error.message && (error.message.includes("API key missing") || error.message.includes("not configured"))) {
        return await DeepSeekService.generateAdvancedFallback(userInput);
      }
      return this.generateAIUnavailableFallback(userInput);
    }
  }

  generateCacheKey(userInput) {
    return userInput.toLowerCase()
      .replace(/[?!.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  buildOptimizedPrompt(userInput, intent) {
    let contextualInfo = "";
    
    if (this.conversationHistory.length > 2) {
      const recentHistory = this.conversationHistory.slice(-2);
      const historyText = recentHistory.map(h => `${h.role}: ${h.content.substring(0, 50)}`).join('\n');
      contextualInfo += `\nRecent: ${historyText}\n`;
    }
    
    const intentContext = this.getIntentContext(intent);
    
    return `${contextualInfo}\n${intentContext}\n\nUser: ${userInput}`;
  }

  getIntentContext(intent) {
    const contexts = {
      'aims_programs': "Help with AIMS maritime program information and admissions.",
      'ship_simulation': "Provide info about AIMS ship simulation facilities and training.",
      'find_book': "Help with maritime book search and library catalog.",
      'research_help': "Provide maritime research assistance and database help.",
      'membership': "Explain AIMS-CLAMS membership process and benefits.",
      'study_space': "Info about AIMS study rooms and maritime library facilities.",
      'hours_location': "Give AIMS-CLAMS operating hours and location info.",
      'digital_access': "Help with digital maritime resources and databases.",
      'maritime_law': "Assist with maritime law resources and IMO publications.",
      'careers': "Provide maritime career guidance and industry information."
    };
    
    return contexts[intent] || "General AIMS-CLAMS maritime assistance.";
  }

  cleanCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastCacheClean > 300000) {
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

  detectUserIntent(userInput) {
    const input = userInput.toLowerCase();
    
    const intents = {
      'aims_programs': ['aims program', 'maritime program', 'marine engineering', 'marine transportation', 'customs administration', 'maritime business', 'admission', 'apply'],
      'ship_simulation': ['simulator', 'simulation', 'bridge simulator', 'engine room simulator', 'training vessel', 'aims explorer'],
      'find_book': ['find', 'search', 'looking for', 'need', 'book about', 'maritime book'],
      'borrow_info': ['borrow', 'checkout', 'loan', 'take out', 'lending'],
      'membership': ['join', 'member', 'registration', 'sign up', 'membership'],
      'hours_location': ['hours', 'open', 'close', 'time', 'location', 'address', 'where is aims'],
      'study_space': ['study', 'room', 'space', 'reserve', 'quiet', 'library area'],
      'research_help': ['research', 'thesis', 'help', 'assistance', 'citation', 'maritime research'],
      'digital_access': ['digital', 'online', 'ebook', 'database', 'remote', 'imo', 'stcw'],
      'fees_fines': ['fee', 'cost', 'fine', 'overdue', 'penalty', 'price', 'tuition'],
      'archives': ['archives', 'historical', 'manuscript', 'documents', 'maritime history', 'ship documentation'],
      'museum': ['museum', 'exhibition', 'exhibit', 'tour', 'display', 'ship models', 'artifacts'],
      'maritime_law': ['maritime law', 'shipping law', 'imo publications', 'maritime regulations'],
      'careers': ['career', 'job', 'employment', 'seafarer', 'officer', 'captain', 'engineer jobs']
    };
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general_inquiry';
  }

  handleNonLibraryQuery(userInput) {
    const restrictionMessage = "Ahoy! I'm De Malacca, your dedicated AIMS-CLAMS maritime assistant! ⚓📚 I specialize in helping with AIMS maritime programs, CLAMS library services, ship simulation facilities, maritime research assistance, archives access, and all things related to our maritime Library, Archives, and Museum. What maritime knowledge can I help you navigate today? Ready to set sail on your learning adventure? 🌊";
    this.addToHistory('assistant', restrictionMessage);
    return restrictionMessage;
  }

  generateAIUnavailableFallback(userInput) {
    return `⚓ Ahoy! I'm experiencing some technical difficulties connecting to my AI knowledge base right now. 🔧 

However, I can still help you with basic AIMS-CLAMS information:

📞 **Contact CLAMS directly:** (02) 8831-9925 | info@aims.edu.ph
⏰ **Library Hours:** Mon-Fri 7AM-7PM, Sat 8AM-5PM  
📍 **Location:** AIMS Campus, Pasay City, Metro Manila
🎓 **Programs:** Marine Engineering, Marine Transportation, Maritime Business
📚 **Services:** Library, Archives, Museum, Ship Simulation

Please try your question again in a moment, or contact our staff directly for immediate assistance! Fair winds! 🌊`;
  }

  generateEmergencyFallback(userInput, intent) {
    const input = userInput.toLowerCase();
    
    const emergencyResponses = {
      'aims_programs': "⚓ I can help with AIMS maritime programs! We offer BS Marine Engineering, BS Marine Transportation, BS Customs Administration, and BS Maritime Business Management. Which program interests you most?",
      'ship_simulation': "🚢 AIMS has excellent ship simulation facilities including bridge simulators and engine room simulators for hands-on maritime training! Would you like to know more about our training programs?",
      'find_book': "📚 I can help you find maritime books in our CLAMS library! We have 25,000+ specialized maritime volumes. What specific maritime topic are you researching?",
      'research_help': "🔍 I'm here to assist with your maritime research! CLAMS offers thesis support, maritime databases, and IMO publications. What research topic can I help you with?",
      'membership': "👥 I can help you join CLAMS! Students get free access with AIMS ID, external researchers pay ₱500/day or ₱2,000/month. What type of membership do you need?",
      'hours_location': "⏰ CLAMS Library hours: Mon-Fri 7AM-7PM, Sat 8AM-5PM. Located at AIMS Campus, Pasay City. Contact: (02) 8831-9925. What specific information do you need?",
      'study_space': "📖 CLAMS has maritime study areas, computer labs, and group study rooms available! Would you like to know about reserving study spaces?",
      'digital_access': "💻 We offer digital maritime resources including IMO publications, STCW standards, and maritime databases! What digital resources are you looking for?",
      'maritime_law': "⚖️ CLAMS has extensive maritime law resources including IMO conventions and shipping regulations! What specific maritime law topic interests you?",
      'archives': "📜 Our archives contain Philippine maritime history and ship documentation! What historical maritime information are you seeking?",
      'museum': "🏛️ Our maritime museum features ship models and naval artifacts! Would you like to know about tours or current exhibitions?"
    };
    
    const fallbackResponse = emergencyResponses[intent];
    if (fallbackResponse) {
      return fallbackResponse;
    }
    
    if (input.includes('hour') || input.includes('open') || input.includes('time')) {
      return "⏰ AIMS-CLAMS Library is open Mon-Fri 7AM-7PM, Sat 8AM-5PM. Contact us at (02) 8831-9925 for more information!";
    }
    
    if (input.includes('cost') || input.includes('fee') || input.includes('price')) {
      return "💰 AIMS students get free library access! External researchers: ₱500/day or ₱2,000/month. Alumni: ₱1,000/year. What membership type do you need?";
    }
    
    if (input.includes('borrow') || input.includes('book')) {
      return "📖 You can borrow maritime books with AIMS student ID or CLAMS membership. Students: 5 books for 2 weeks. Need help finding specific books?";
    }
    
    return `⚓ I'm here to help with AIMS maritime education and CLAMS library services! While I'm having some technical difficulties with my detailed responses, I can still assist you with:

🎓 **AIMS Programs** - Marine Engineering, Marine Transportation, Maritime Business
📚 **Library Services** - Maritime books, databases, study spaces  
🔍 **Research Help** - Maritime thesis support, IMO publications
👥 **Membership** - Student, alumni, and researcher access
📞 **Contact** - (02) 8831-9925 | info@aims.edu.ph

What specific maritime topic can I help you with today? 🌊`;
  }

  updateConversationContext(userInput) {
    const keywords = userInput.toLowerCase().split(/\s+/);
    
    if (keywords.includes('book') || keywords.includes('search')) {
      this.currentTopic = 'book_search';
    } else if (keywords.includes('membership') || keywords.includes('join')) {
      this.currentTopic = 'membership';
    } else if (keywords.includes('hours') || keywords.includes('open')) {
      this.currentTopic = 'hours_info';
    } else if (keywords.includes('study') || keywords.includes('room')) {
      this.currentTopic = 'study_space';
    } else if (keywords.includes('research') || keywords.includes('thesis')) {
      this.currentTopic = 'research_help';
    } else {
      this.currentTopic = null;
    }
  }

  async addToHistory(role, content) {
    this.conversationHistory.push({ 
      role, 
      content, 
      timestamp: new Date().toISOString()
    });
    
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