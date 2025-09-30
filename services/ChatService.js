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

// ENHANCED: Better quick response checker for FAQ questions
getQuickResponse(userInput) {
  const input = userInput.toLowerCase().trim();
  
  // Check exact matches first
  if (this.predefinedResponses[input]) {
    return this.predefinedResponses[input];
  }

  // Enhanced FAQ question detection
  const faqResponses = {
    // AIMS Programs
    "what maritime programs does aims offer?": "AIMS offers BS Marine Engineering (ship engines/machinery), BS Marine Transportation (navigation/operations), BS Customs Administration, and BS Maritime Business Management. All programs include hands-on simulator training. Which program interests you? ⚓",
    
    "how do i apply to aims?": "AIMS application process: 1) Submit high school transcript 2) Take entrance exam 3) Medical examination 4) Interview. Contact admissions at (02) 8831-9925 for details. Ready to start your maritime journey? 📝",
    
    "what are the admission requirements for marine engineering?": "Marine Engineering requirements: High school diploma, passing entrance exam, medical fitness certificate, good math/science grades. The 4-year program includes engine room simulator training. Need curriculum details? 🔧",
    
    "does aims have ship simulation facilities?": "Yes! AIMS has advanced ship simulators: Bridge simulators for navigation training and Engine Room simulators for machinery operations. These provide realistic maritime training. Want to tour our facilities? 🎮",
    
    "how much is the tuition for aims programs?": "AIMS tuition varies by program. Contact admissions at (02) 8831-9925 for current rates. Scholarships available for qualified students in Marine Engineering and Marine Transportation. Which program's costs interest you? 💰",

    // Library Services
    "what are clams library hours?": "CLAMS Library Hours: Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM. Archives & Museum by appointment. Extended hours during exam periods! 📚",
    
    "how do i borrow maritime books?": "Borrowing: AIMS students 5 books/2 weeks, Faculty 10 books/1 month. Present valid ID at circulation desk. External researchers need day/month membership. Looking for specific maritime topics? 📖",
    
    "do you have imo publications?": "Yes! CLAMS has complete IMO (International Maritime Organization) publications including SOLAS, MARPOL, STCW conventions. Available in reference section. Need specific IMO standards? 🌐",
    
    "what maritime databases can i access?": "Access maritime databases: IMO documents, maritime law databases, shipping industry reports, STCW references, and academic maritime journals. Available to members during library hours. Researching specific topics? 💻",
    
    "how much are the membership fees?": "Membership: AIMS students FREE, External researchers ₱500/day or ₱2,000/month, Alumni ₱1,000/year, Maritime professionals special rates. Which membership type fits your needs? 👥",

    // Research & Study
    "how do i access maritime databases?": "Access databases: 1) Visit CLAMS during hours 2) Use library computers or WiFi 3) Librarian assistance available 4) Remote access for members. Need help with specific research? 🔍",
    
    "can you help with maritime thesis research?": "Absolutely! Our librarians specialize in maritime research assistance, citation help, database navigation, and literature reviews for thesis projects. What's your research topic? 🎓",
    
    "what research services are available?": "Research services: Literature searches, database training, citation assistance, inter-library loans, thesis support, and maritime industry data. Schedule research consultation! 📊",
    
    "do you have stcw references?": "Yes! Complete STCW (Standards of Training, Certification, Watchkeeping) references available, including latest amendments and implementation guides. Need specific STCW standards? 📋",
    
    "how do i book study spaces?": "Study spaces: Individual carrels and group study rooms available first-come basis. Quiet zones and collaborative areas. Open during library hours. Need specific study arrangements? 🪑",

    // Digital Resources
    "how do i access digital maritime collections?": "Digital access: 1) On-site library computers 2) Member WiFi 3) Remote login for members 4) Librarian-assisted database searches. What digital resources do you need? 🌐",
    
    "can i access resources remotely?": "Remote access available for CLAMS members! Login credentials provided with membership. Access maritime databases, e-books, and digital journals from anywhere. Need remote access setup? 🏠",
    
    "what online maritime databases do you have?": "Online databases: IMO docs, maritime law databases, shipping industry reports, academic journals, STCW resources, and vessel documentation. Available to members. Specific database needed? 💾",
    
    "do you have e-books on maritime topics?": "Yes! Growing e-book collection on maritime engineering, navigation, shipping management, maritime law, and marine safety. Access through our digital portal. Looking for specific e-books? 📱",
    
    "how do i get digital library access?": "Digital access: 1) Get CLAMS membership 2) Receive login credentials 3) Access via library website 4) Mobile app available. Our librarians can help with setup! 🔐",

    // Archives & Museum
    "how much do museum artifacts cost to see?": "Museum access: FREE with library membership! Group tours ₱50/person (min. 10). See historic ship models, maritime artifacts, Philippine naval history. Schedule your visit! 🏛️",
    
    "what ship models do you display?": "Ship models: Historic Philippine vessels, merchant ships, naval warships, traditional bancas, modern container ships. Each model tells a maritime story! Favorite ship era? 🚢",
    
    "do you have philippine maritime history records?": "Yes! Archives contain Philippine maritime history: ship documents, naval records, merchant marine history, port development, and maritime trade records. Researching specific periods? 📜",
    
    "how do i book a maritime museum tour?": "Museum tours: Call (02) 8831-9925 to schedule. Educational tours for schools, group tours, individual visits. Experience Philippine maritime heritage! Group size? 🎫",
    
    "what maritime exhibitions are running?": "Current exhibitions: Philippine Naval History, Modern Shipping Technology, Traditional Seafaring, Marine Conservation. Rotating exhibits every 3 months. Interested in specific themes? 🖼️",

    // Contact & Location
    "what are aims-clams operating hours?": "AIMS-CLAMS Hours: Library Mon-Fri 7AM-7PM, Sat 8AM-5PM. Archives/Museum by appointment. Campus Mon-Fri 7AM-8PM. Need specific service hours? ⏰",
    
    "how do i contact aims-clams directly?": "Contact: Phone (02) 8831-9925 | Email info@aims.edu.ph | Visit Pasay City campus. Staff available during library hours. What assistance do you need? 📞",
    
    "where is aims located in metro manila?": "AIMS Location: Pasay City, Metro Manila - near NAIA airport, accessible via LRT/MRT, in the maritime industry hub. Need directions or transportation info? 🗺️",
    
    "how do i reach specific departments?": "Department contacts: Library x101, Archives x102, Museum x103, Admissions x201, Accounting x301. Call (02) 8831-9925 and ask for extension. Which department? 🏢",
    
    "do you have weekend services?": "Weekend services: Library open Saturday 8AM-5PM. Archives/Museum by appointment only. Sunday: Closed. Need Saturday appointment? 🗓️"
  };

  // Check for exact FAQ matches
  for (const [question, response] of Object.entries(faqResponses)) {
    if (input === question.toLowerCase()) {
      return response;
    }
  }

  // Check partial matches for FAQ questions
  for (const [question, response] of Object.entries(faqResponses)) {
    const questionWords = question.toLowerCase().split(' ');
    const inputWords = input.split(' ');
    const matchCount = questionWords.filter(word => 
      inputWords.some(inputWord => inputWord.includes(word) || word.includes(inputWord))
    ).length;
    
    if (matchCount >= 3) { // At least 3 matching words
      return response;
    }
  }

  // Original quick response checks (keep existing logic)
  if (input.includes('how much') || input.includes('cost') || input.includes('price')) {
    if (input.includes('membership') || input.includes('library')) {
      return "CLAMS membership fees: AIMS students FREE, External researchers ₱500/day or ₱2,000/month, Alumni ₱1,000/year. Maritime industry professionals get special rates. Need specific membership details?";
    }
    if (input.includes('program') || input.includes('tuition') || input.includes('aims')) {
      return "AIMS program tuition varies by course. Marine Engineering and Marine Transportation have different fees. Contact admissions at (02) 8831-9925 for current tuition rates and scholarships. Which program interests you?";
    }
    if (input.includes('artifact') || input.includes('museum')) {
      return "Our Maritime Museum displays ship models and maritime artifacts. Museum tours are included with library membership or can be arranged separately. Educational group tours available by appointment. Want to schedule a visit?";
    }
  }

  if (input.includes('borrow') || input.includes('checkout')) {
    return "Borrowing privileges: AIMS students can borrow 5 books for 2 weeks, Faculty 10 books for 1 month. External members need day pass or monthly membership. Renewals allowed once if no holds. What specific maritime materials are you looking for?";
  }

  return null; // No quick response found
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