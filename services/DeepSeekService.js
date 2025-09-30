// src/services/DeepSeekService.js - FIXED VERSION
import { API_KEYS } from '../config/api.js';

class DeepSeekService {
  constructor() {
    this.apiKey = API_KEYS.OPENROUTER;
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    this.isAuthenticated = false;
    
    this.initializeService();
  }

  initializeService() {
    // Validate API key
    if (!this.apiKey || this.apiKey.includes('your-openrouter-api-key') || this.apiKey.length < 20) {
      console.warn("⚠️ OpenRouter API Key is missing or invalid");
      this.isAuthenticated = false;
    } else {
      console.log("✅ OpenRouter API Key loaded successfully");
      this.isAuthenticated = true;
    }

    // Correct OpenRouter headers
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "HTTP-Referer": "https://aims.edu.ph", // Your actual domain
      "X-Title": "AIMS-CLAMS Chatbot"
    };
  }

  async generateResponse(userInput) {
    console.log("🤖 DeepSeekService processing:", userInput.substring(0, 50));

    // Always try immediate answers first (fastest response)
    const immediateAnswer = this.getImmediateAnswer(userInput);
    if (immediateAnswer) {
      return immediateAnswer;
    }

    // If not authenticated, use enhanced fallback immediately
    if (!this.isAuthenticated) {
      console.log("🔑 No API access, using enhanced fallback");
      return this.generateEnhancedFallback(userInput);
    }

    // Try AI API call with proper error handling
    try {
      console.log("🌐 Attempting OpenRouter API call...");
      
      const requestBody = {
        model: "deepseek/deepseek-chat", // Correct model name
        messages: [
          {
            role: "system",
            content: this.getEnhancedSystemPrompt()
          },
          {
            role: "user",
            content: userInput
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      };

      console.log("📤 Sending request to OpenRouter...");
      
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(requestBody)
      });

      console.log("📡 Response status:", response.status);

      // Handle specific HTTP errors
      if (response.status === 401) {
        console.error("❌ 401 Unauthorized - Invalid API Key");
        this.isAuthenticated = false;
        throw new Error("API authentication failed - check your API key");
      }

      if (response.status === 402) {
        console.error("❌ 402 Payment Required - Out of credits");
        this.isAuthenticated = false;
        throw new Error("OpenRouter credits exhausted");
      }

      if (response.status === 429) {
        console.error("❌ 429 Rate Limited");
        throw new Error("Rate limited, please try again later");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error:", response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ API Response received");
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const aiResponse = data.choices[0].message.content.trim();
        console.log("🤖 AI Response length:", aiResponse.length);
        return this.cleanAIResponse(aiResponse);
      } else {
        console.error("❌ Unexpected response format:", data);
        throw new Error("Invalid response format from AI service");
      }

    } catch (error) {
      console.error("💥 DeepSeekService Error:", error.message);
      this.isAuthenticated = false;
      return this.generateEnhancedFallback(userInput);
    }
  }

  getEnhancedSystemPrompt() {
    return `You are De Malacca, the expert maritime librarian assistant for AIMS-CLAMS (Asian Institute of Maritime Studies - Center of Library, Archives, and Museum Services).

IMPORTANT: You MUST answer questions specifically about AIMS academics, CLAMS services, and maritime topics. If asked about unrelated topics, politely redirect to AIMS/CLAMS services.

AIMS-CLAMS KNOWLEDGE BASE:

INSTITUTIONAL INFO:
- Name: Asian Institute of Maritime Studies (AIMS)
- CLAMS: Center of Library, Archives, and Museum Services  
- Location: Pasay City, Metro Manila, Philippines
- Founded: 1993
- Contact: (02) 8831-9925 | info@aims.edu.ph | www.aims.edu.ph
- Library Hours: Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM

ACADEMIC PROGRAMS:
• BS Marine Engineering (4 years) - ship engines, machinery, power systems
• BS Marine Transportation (4 years) - navigation, cargo operations, vessel management  
• BS Customs Administration (4 years)
• BS Maritime Business Management (4 years)

FACILITIES:
• Ship bridge simulators & engine room simulators
• Training vessel M/V AIMS Explorer
• Maritime library with 25,000+ specialized volumes
• IMO publications and maritime law databases
• Archives with Philippine maritime history
• Maritime museum with ship models and artifacts

LIBRARY SERVICES:
- Membership: AIMS students FREE, External researchers ₱500/day, Alumni ₱1,000/year
- Borrowing: Students 5 books/2 weeks, Faculty 10 books/1 month
- Resources: Maritime databases, STCW references, thesis collection
- Study areas, computer access, research assistance

MUSEUM & ARCHIVES:
- Maritime heritage exhibitions
- Historical ship documentation
- Educational tours available
- Research access by appointment

Always provide specific, accurate information and end with a helpful follow-up question.`;
  }

  getImmediateAnswer(userInput) {
    const input = userInput.toLowerCase().trim();
    
    const immediateAnswers = {
      // Library hours
      'library hours': `📚 CLAMS Library Operating Hours:
• Monday-Friday: 7:00 AM - 7:00 PM  
• Saturday: 8:00 AM - 5:00 PM
• Sunday: Closed
• Archives & Museum: By appointment

Need access to specific maritime resources? What would you like to explore?`,

      'membership fee': `💰 CLAMS Membership Fees:
• AIMS Students: FREE with valid ID
• External Researchers: ₱500/day or ₱2,000/month
• Alumni: ₱1,000/year  
• Faculty/Staff: FREE with employment ID
• Maritime Professionals: Special industry rates

What type of membership are you interested in?`,

      'contact': `📞 AIMS-CLAMS Contact Information:
• Phone: (02) 8831-9925
• Email: info@aims.edu.ph  
• Website: www.aims.edu.ph
• Location: Pasay City, Metro Manila
• Library Hours: Mon-Fri 7AM-7PM, Sat 8AM-5PM

How can we assist you today?`,

      'marine engineering': `⚙️ BS Marine Engineering at AIMS:
• Duration: 4 years
• Focus: Ship engines, marine machinery, power systems
• Facilities: Engine room simulators, workshops
• Career: Ship engineer, port engineer, maritime surveyor
• Training: Hands-on with M/V AIMS Explorer

Interested in admission requirements or the curriculum?`,

      'marine transportation': `🧭 BS Marine Transportation at AIMS:
• Duration: 4 years  
• Focus: Navigation, cargo operations, vessel management
• Facilities: Bridge simulators, navigation labs
• Career: Ship officer, port captain, maritime operations
• Training: Practical navigation experience

Would you like more details about the curriculum or career opportunities?`,

      'programs': `🎓 AIMS Maritime Programs:
• BS Marine Engineering (ship engines & machinery)
• BS Marine Transportation (navigation & operations)  
• BS Customs Administration
• BS Maritime Business Management

All programs include hands-on simulator training and prepare students for international maritime careers. Which program interests you most?`,

      'borrow': `📖 Borrowing Policies:
• AIMS Students: 5 books for 2 weeks
• Faculty: 10 books for 1 month
• External Members: Reference use (special arrangements possible)
• Renewal: Once if no holds
• Overdue Fine: ₱10/day per book

We have 25,000+ maritime specialized books! What topics are you researching?`,

      'museum': `🏛️ Maritime Museum Features:
• Historic ship models from different eras
• Nautical instruments and maritime artifacts
• Philippine naval and merchant marine history
• Interactive maritime displays
• Educational tours for schools and groups

Museum access is included with library membership. Would you like to schedule a visit?`
    };

    // Check for exact matches or contains
    for (const [keyword, answer] of Object.entries(immediateAnswers)) {
      if (input.includes(keyword)) {
        console.log(`🎯 Using immediate answer for: ${keyword}`);
        return answer;
      }
    }

    return null;
  }

  generateEnhancedFallback(userInput) {
    const input = userInput.toLowerCase();
    
    // Enhanced contextual fallbacks
    if (input.includes('cost') || input.includes('fee') || input.includes('price') || input.includes('how much')) {
      return `💰 Cost Information:

**CLAMS Membership:**
• AIMS Students: FREE
• External Researchers: ₱500/day or ₱2,000/month  
• Alumni: ₱1,000/year

**AIMS Programs:** Tuition varies by program. Contact (02) 8831-9925 for current rates.

**Museum Tours:** Group tours ₱50/person (minimum 10 people)

Scholarships and payment plans available! What specific costs would you like to know about?`;
    }

    if (input.includes('admission') || input.includes('apply') || input.includes('enroll')) {
      return `📋 AIMS Admission Process:

**Requirements:**
• High school diploma or equivalent
• Entrance examination
• Medical fitness certificate (for maritime programs)
• Personal interview

**Programs Available:**
• Marine Engineering
• Marine Transportation  
• Customs Administration
• Maritime Business Management

**Contact Admissions:** (02) 8831-9925
**Email:** info@aims.edu.ph

Would you like details about a specific program's admission requirements?`;
    }

    if (input.includes('archive') || input.includes('historical') || input.includes('document')) {
      return `📜 CLAMS Archives Services:

**Collections:**
• Philippine maritime history documents
• Ship documentation and vessel records  
• Historical maritime photographs and maps
• AIMS institutional archives since 1993

**Access:**
• By appointment only
• Research assistance available
• Digitization services

**Contact:** (02) 8831-9925 to schedule archive research

What specific maritime history are you interested in exploring?`;
    }

    // Default comprehensive response
    return `⚓ Ahoy! I'm De Malacca, your AIMS-CLAMS maritime assistant! 

I can help you with:

🎓 **AIMS Academic Programs** - Marine Engineering, Marine Transportation, etc.
📚 **CLAMS Library Services** - Membership, borrowing, research help
🏛️ **Maritime Museum** - Exhibitions, tours, artifacts
📜 **Archives** - Historical documents, research access
💰 **Fees & Membership** - Costs, payment options
📞 **Contact Information** - Phone, email, location

**Quick Facts:**
• Location: Pasay City, Metro Manila
• Contact: (02) 8831-9925
• Hours: Mon-Fri 7AM-7PM, Sat 8AM-5PM

What specific information can I help you navigate today?`;
  }

  cleanAIResponse(response) {
    if (!response) return this.generateEnhancedFallback("general inquiry");
    
    let cleaned = response.trim();
    
    // Remove overly generic introductions if response is substantial
    if (cleaned.length > 100) {
      cleaned = cleaned.replace(/^(Hello|Hi|Hey|Ahoy)[^!]*!?\s*/i, '');
    }
    
    // Ensure response ends properly
    if (!cleaned.endsWith('?') && !cleaned.endsWith('!') && !cleaned.endsWith('.')) {
      cleaned += '.';
    }
    
    return cleaned || this.generateEnhancedFallback("general inquiry");
  }

  // Test API connectivity
  async testConnection() {
    if (!this.isAuthenticated) {
      return { success: false, message: "API key not configured" };
    }

    try {
      const testResponse = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          messages: [{ role: "user", content: "Say 'API test successful'" }],
          max_tokens: 10
        })
      });

      return {
        success: testResponse.ok,
        status: testResponse.status,
        statusText: testResponse.statusText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new DeepSeekService();