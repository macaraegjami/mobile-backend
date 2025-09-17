// src/services/DeepSeekService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

class DeepSeekService {
  constructor() {
    this.apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "HTTP-Referer": "react-native-app",
      "X-Title": "CLAMS - De Malacca Chatbot"
    };
    
    // Enhanced API key validation
    if (!this.apiKey) {
      console.error("❌ OpenRouter API Key is missing!");
      console.log("💡 Please set REACT_APP_OPENROUTER_API_KEY in your environment variables");
    } else if (this.apiKey.length < 20) {
      console.warn("⚠️ OpenRouter API Key seems too short, please verify");
    } else {
      console.log("✅ OpenRouter API Key loaded successfully");
    }
    
    // Check if we're in development mode
    if (__DEV__) {
      console.log("🔧 Development mode: Enhanced logging enabled");
    }
  }

  // NEW: Optimized AIMS-CLAMS knowledge base (shorter for faster processing)
  getOptimizedCLAMSKnowledge() {
    return `
AIMS-CLAMS (Pasay City): Asian Institute of Maritime Studies - Library, Archives, Museum Services
Location: Pasay City, Metro Manila, Philippines

Key Personnel & Committee:
- Ms. Janet Abuid Dandan: Vice President for Student Services
- Mr. Juan Martin R. Quasch: CLAMS Dean
- Ms. Jazzle O. Garcia: Secretary
- Ms. Maria Raquel P. Mantala: Head Librarian, Acquisitions Librarian
- Ms. Helen V. Vidal: Technical Head / Cataloguer
- Ms. Maria Angeles G. Cachuela: SGS Librarian
- Ms. Angelyn G. Canceran: SGS Library Associate
- Jeneath C. Bohol: SEA Library Associate
- Ms. Jaylen R. Manguab: SMM Library Associate
- Mr. Daryl Lorence P. Abarca: Head Archives and Museum, Museum Curator and Researcher
- Archive Associate
- Ms. Nina Ricci D. Racela: Museum Educator and Fundraiser
- Ms. Sarah Jane H. Cheng: Head CLAMS Operation Systems
- Digital Associate
- Operation Systems Associate

AIMS Programs: BS Marine Engineering, BS Marine Transportation, BS Customs Admin, BS Maritime Business Management
Founded: 1993 | Contact: (02) 8831-9925 | info@aims.edu.ph

Facilities: Ship simulators, engine room simulators, training vessel M/V AIMS Explorer
Library: 25K+ maritime books, IMO publications, maritime law database (Mon-Fri 7AM-7PM, Sat 8AM-5PM)
Membership: AIMS Students free, External researchers ₱500/day or ₱2,000/month, Alumni ₱1,000/yr
Borrowing: Students 5books/2wks, Faculty 10books/1month, ₱10/day overdue
Research: Maritime databases, IMO standards, STCW references, thesis support
Archives: Philippine maritime history, ship documentation, AIMS institutional records
Museum: Ship models, maritime artifacts, Philippine naval history, educational tours
`;
  }

  async generateResponse(userInput, context = "") {
    if (!this.apiKey) {
      return this.generateAdvancedFallback(userInput);
    }

    // Validate input
    if (!userInput || userInput.trim().length === 0) {
      return "Ahoy! ⚓ I notice you sent an empty message. What maritime question can I help you with today?";
    }

    // Determine query complexity for model selection
    const isSimpleQuery = this.isSimpleQuery(userInput);
    const isVerySimple = this.isVerySimpleQuery(userInput);

    // Retry mechanism for API failures
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 AI API attempt ${attempt}/3 for query:`, userInput.substring(0, 50) + "...");
        
        const response = await fetch(this.baseUrl, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            // Use faster models for simpler queries
            model: isVerySimple ? "openai/gpt-3.5-turbo" : 
                   isSimpleQuery ? "anthropic/claude-3-haiku" : 
                   "deepseek/deepseek-r1-0528:free",
            messages: [
              {
                role: "system",
                content: isVerySimple ? this.getVerySimplePrompt() :
                         isSimpleQuery ? this.getSimplePrompt() : 
                         this.getComplexPrompt()
              },
              {
                role: "user",
                content: userInput
              }
            ],
            temperature: isSimpleQuery ? 0.3 : 0.7, // Lower temp for faster simple responses
            max_tokens: isVerySimple ? 80 : isSimpleQuery ? 150 : 300, // Increased token limits
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`OpenRouter API Error ${response.status} (attempt ${attempt}):`, errorData);
          throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
          const aiResponse = data.choices[0].message.content;
          
          // Validate response content
          if (!aiResponse || aiResponse.trim().length === 0) {
            console.warn(`⚠️ AI returned empty content (attempt ${attempt})`);
            throw new Error("AI returned empty response");
          }
          
          if (aiResponse.trim().length < 10) {
            console.warn(`⚠️ AI returned very short response (attempt ${attempt}):`, aiResponse);
            // Still return it, but log the warning
          }
          
          console.log(`✅ OpenRouter API success on attempt ${attempt}:`, aiResponse.substring(0, 100) + "...");
          return aiResponse.trim();
        } else {
          console.error(`❌ Invalid response structure (attempt ${attempt}):`, data);
          throw new Error("Invalid response format from OpenRouter");
        }
      } catch (error) {
        lastError = error;
        console.error(`API attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          console.log(`⏳ Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // All attempts failed
    console.error("🚫 All API attempts failed:", lastError.message);
    
    // Show alert in React Native
    Alert.alert(
      "Connection Issue",
      "Unable to connect to AI service. Using offline responses.",
      [{ text: "OK" }]
    );
    
    return this.generateAdvancedFallback(userInput);
  }

  // NEW: Very simple query detection (for fastest responses)
  isVerySimpleQuery(userInput) {
    const verySimplePatterns = [
      'hours', 'open', 'close', 'contact', 'phone', 'address', 'location',
      'hello', 'hi', 'thanks', 'thank you', 'where is aims', 'aims location'
    ];
    
    return verySimplePatterns.some(pattern => 
      userInput.toLowerCase().includes(pattern)
    );
  }

  isSimpleQuery(userInput) {
    const simplePatterns = [
      'fee', 'cost', 'price', 'membership', 'how much', 'borrowing limit',
      'study room', 'wifi', 'computer', 'renewal', 'programs', 'courses',
      'marine engineering', 'marine transportation', 'admission'
    ];
    
    return simplePatterns.some(pattern => 
      userInput.toLowerCase().includes(pattern)
    );
  }

  // NEW: Optimized prompts for different query types
  getVerySimplePrompt() {
    return `You are De Malacca, AIMS-CLAMS maritime librarian assistant. 

INSTRUCTIONS:
- Give direct, factual answers in under 40 words
- Use maritime terminology when appropriate
- Always provide a helpful response
- Be enthusiastic about maritime education

KNOWLEDGE BASE:
${this.getOptimizedCLAMSKnowledge()}

Respond helpfully and concisely to the user's question.`;
  }

  getSimplePrompt() {
    return `You are De Malacca, AIMS-CLAMS maritime librarian assistant.

INSTRUCTIONS:
- Give helpful, direct answers in under 100 words
- Use maritime language and be enthusiastic about maritime education
- Always provide actionable information
- End with a helpful follow-up question when appropriate

KNOWLEDGE BASE:
${this.getOptimizedCLAMSKnowledge()}

Respond helpfully and enthusiastically to the user's question.`;
  }

  getComplexPrompt() {
    return `You are De Malacca, AIMS-CLAMS expert maritime librarian and academic assistant. Named after the famous navigator Alfonso de Albuquerque who conquered Malacca, you embody maritime knowledge and enthusiasm.

RESPONSE REQUIREMENTS:
- Always provide a substantive, helpful response
- Start with maritime greeting if appropriate (⚓ Ahoy! etc.)
- Structure: Direct answer → specific maritime details → helpful next steps → maritime-themed follow-up question
- Use nautical terminology naturally
- Be enthusiastic about maritime education and AIMS programs
- Keep under 200 words but thorough
- Never return empty or very short responses

KNOWLEDGE BASE:
${this.getOptimizedCLAMSKnowledge()}

IMPORTANT: Always end with a helpful maritime-themed question to continue the conversation. Provide complete, informative responses.`;
  }

  // NEW: Advanced fallback system when no API key is available
  generateAdvancedFallback(userInput) {
    const input = userInput.toLowerCase();
    
    // Pattern-based responses for common queries
    const patterns = [
      {
        keywords: ['hours', 'open', 'close', 'time', 'schedule'],
        response: "⏰ **AIMS-CLAMS Operating Hours** ⚓\n\n📚 **Maritime Library:** Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM\n🏛️ **Archives & Museum:** Monday-Friday by appointment\n🎓 **AIMS Campus:** Monday-Friday 7:00 AM - 8:00 PM\n📞 **Contact:** (02) 8831-9925\n\nSpecial holiday hours may vary. Is there a specific service you need to access? ⚓"
      },
      {
        keywords: ['marine engineering', 'engine', 'machinery'],
        response: "⚙️ **BS Marine Engineering at AIMS** ⚓\n\nOur 4-year Marine Engineering program focuses on:\n• Ship engine operations & maintenance\n• Marine machinery systems\n• Engine room simulator training\n• Power plant operations\n• Marine electrical systems\n\n🚢 **Facilities:** State-of-the-art engine room simulators\n📞 **Admissions:** (02) 8831-9925\n\nWould you like to know about admission requirements or career prospects? 🌊"
      },
      {
        keywords: ['marine transportation', 'navigation', 'ship management'],
        response: "🧭 **BS Marine Transportation at AIMS** ⚓\n\nOur comprehensive program covers:\n• Ship navigation & bridge operations\n• Cargo handling & operations\n• Vessel management systems\n• Maritime law & regulations\n• Bridge simulator training\n\n🚢 **Facilities:** Advanced bridge simulators\n📊 **Career Path:** Ship officers, port managers, maritime consultants\n\nInterested in learning about our simulation labs? Ready to chart your maritime career? ⚓"
      },
      {
        keywords: ['borrow', 'checkout', 'loan', 'books'],
        response: "📖 **Maritime Library Borrowing** ⚓\n\n**Requirements:**\n✅ AIMS student ID or CLAMS membership\n✅ Account in good standing\n\n**Borrowing Limits:**\n• **AIMS Students:** 5 books for 2 weeks\n• **Faculty:** 10 books for 1 month\n• **External researchers:** Day pass required\n• **Renewals:** Once if no holds\n• **Overdue:** ₱10/day per book\n\n📚 **Collection:** 25,000+ maritime volumes, IMO publications\n\nLooking for specific maritime subjects? What area of maritime studies interests you? 🚢"
      },
      {
        keywords: ['membership', 'join', 'register', 'access'],
        response: "👥 **AIMS-CLAMS Membership** ⚓\n\n**Membership Types:**\n🎓 **AIMS Students:** FREE with valid student ID\n👨‍🏫 **Faculty/Staff:** Full privileges with ID\n🔬 **External Researchers:** ₱500/day or ₱2,000/month\n🎓 **Alumni:** ₱1,000/year\n🚢 **Maritime Professionals:** Special industry rates\n\n**Benefits:**\n• Maritime library access\n• Digital database access\n• Study room reservations\n• Research assistance\n• Archives access\n\nWhich membership type would work best for you? Ready to join our maritime community? ⚓"
      },
      {
        keywords: ['research', 'thesis', 'help', 'assistance'],
        response: "🔍 **Maritime Research Assistance** ⚓\n\n**Research Services:**\n📊 Maritime databases & IMO publications\n📚 Thesis support & guidance\n📋 Citation assistance\n🗄️ Archives access for historical research\n👨‍🏫 Librarian consultations\n💻 Digital resource training\n\n**Specialized Areas:**\n• Maritime law & regulations\n• Ship operations & management\n• Philippine maritime history\n• Marine engineering technologies\n• Port & cargo operations\n\nWhat's your research focus? How can we help navigate your academic journey? 🌊"
      },
      {
        keywords: ['imo', 'stcw', 'maritime law', 'regulations'],
        response: "⚖️ **Maritime Law & Standards Resources** ⚓\n\n**Available Resources:**\n📋 IMO (International Maritime Organization) publications\n📜 STCW (Standards of Training, Certification and Watchkeeping)\n⚖️ Maritime law databases\n🌏 International shipping regulations\n🇵🇭 Philippine maritime law\n📊 Admiralty law references\n\n**Research Support:**\n• Legal research assistance\n• Case law databases\n• Maritime court decisions\n• International maritime treaties\n\nNeed help with specific maritime legal research? What area of maritime law interests you most? ⚓"
      },
      {
        keywords: ['simulator', 'simulation', 'training'],
        response: "🎮 **AIMS Ship Simulation Facilities** ⚓\n\n**Simulation Labs:**\n🚢 **Bridge Simulator:** Navigation, radar, ECDIS training\n⚙️ **Engine Room Simulator:** Diesel engines, power systems\n🚢 **Full Mission Bridge:** Complete ship handling scenarios\n⚓ **Dynamic Positioning:** Advanced vessel positioning\n\n**Training Programs:**\n• STCW certification courses\n• Maritime officer training\n• Ship handling exercises\n• Emergency response drills\n\n**Training Vessel:** M/V AIMS Explorer for practical experience\n\nInterested in hands-on maritime training? Which simulation program appeals to you? 🌊"
      }
    ];
    
    // Find matching pattern
    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => input.includes(keyword))) {
        return pattern.response;
      }
    }
    
    // Default comprehensive response
    return this.getDefaultEnhancedResponse();
  }

  // NEW: Default enhanced response for when patterns don't match
  getDefaultEnhancedResponse() {
    return "¡Ahoy! I'm De Malacca, your expert AIMS-CLAMS maritime guide! ⚓📚 I can help you with:\n\n🎓 **AIMS Programs:** Marine Engineering, Marine Transportation, Maritime Business\n📚 **Maritime Library:** 25,000+ specialized books, IMO publications, databases\n📜 **Archives:** Philippine maritime history, ship documentation\n🏛️ **Museum:** Ship models, maritime artifacts, educational tours\n🔍 **Research:** Thesis support, maritime databases, consultation\n👥 **Membership:** Student, alumni, and researcher access\n\nWhat maritime adventure can I help you embark on today? Ready to set sail on your learning journey? 🌊";
  }

  // React Native specific methods
  async saveToStorage(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  async getFromStorage(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  async clearStorage() {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export default new DeepSeekService();