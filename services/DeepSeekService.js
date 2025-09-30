// src/services/DeepSeekService.js - WORKING VERSION
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
      "HTTP-Referer": "https://aims.edu.ph",
      "X-Title": "AIMS-CLAMS De Malacca"
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
      
      // Try different models - OpenRouter has specific available models
      const modelsToTry = [
        "google/gemini-pro",  // Free model
        "anthropic/claude-3-haiku", // Free model
        "meta-llama/llama-3-8b-instruct", // Free model
        "deepseek/deepseek-chat" // Might require credits
      ];

      let lastError = null;
      
      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Trying model: ${model}`);
          
          const requestBody = {
            model: model,
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
            max_tokens: 800,
            stream: false
          };

          const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(requestBody)
          });

          console.log(`📡 Response status for ${model}:`, response.status);

          if (response.status === 401) {
            console.error("❌ 401 Unauthorized - Invalid API Key");
            this.isAuthenticated = false;
            throw new Error("API authentication failed");
          }

          if (response.status === 402) {
            console.log(`💰 ${model} requires payment, trying next model...`);
            continue;
          }

          if (response.status === 404) {
            console.log(`❓ ${model} not found, trying next model...`);
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`⚠️ ${model} failed: ${response.status}, trying next...`);
            continue;
          }

          const data = await response.json();
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content.trim();
            console.log(`✅ Success with model: ${model}`);
            console.log("🤖 AI Response length:", aiResponse.length);
            return this.cleanAIResponse(aiResponse);
          }
          
        } catch (error) {
          lastError = error;
          console.log(`⚠️ Model ${model} failed:`, error.message);
          continue;
        }
      }

      // If all models failed
      throw new Error(`All models failed. Last error: ${lastError?.message}`);

    } catch (error) {
      console.error("💥 All AI models failed:", error.message);
      this.isAuthenticated = false;
      return this.generateEnhancedFallback(userInput);
    }
  }

  getEnhancedSystemPrompt() {
    return `You are De Malacca, the expert maritime librarian assistant for AIMS-CLAMS (Asian Institute of Maritime Studies - Center of Library, Archives, and Museum Services).

IMPORTANT GUIDELINES:
1. Answer questions specifically about AIMS academics, CLAMS services, and maritime topics
2. If asked about unrelated topics, politely redirect to AIMS/CLAMS services
3. Provide accurate, helpful information
4. Keep responses conversational but professional
5. Use maritime terminology appropriately
6. Be concise but thorough

AIMS-CLAMS KNOWLEDGE BASE:

INSTITUTIONAL INFO:
- Name: Asian Institute of Maritime Studies (AIMS)
- CLAMS: Center of Library, Archives, and Museum Services  
- Location: Pasay City, Metro Manila, Philippines
- Founded: 1993
- Contact: (02) 8831-9925 | info@aims.edu.ph | www.aims.edu.ph
- Library Hours: Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM

ACADEMIC PROGRAMS:
• BS Marine Engineering (4 years)
• BS Marine Transportation (4 years)  
• BS Customs Administration (4 years)
• BS Maritime Business Management (4 years)

FACILITIES:
• Ship bridge simulators & engine room simulators
• Training vessel M/V AIMS Explorer
• Maritime library with 25,000+ specialized volumes
• Archives with Philippine maritime history
• Maritime museum with ship models and artifacts

LIBRARY SERVICES:
- Membership: AIMS students FREE, External researchers ₱500/day, Alumni ₱1,000/year
- Borrowing: Students 5 books/2 weeks, Faculty 10 books/1 month
- Resources: Maritime databases, STCW references, IMO publications

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
      // Student discounts question specifically
      'student discount': `🎓 Student Benefits at AIMS-CLAMS:

**AIMS Students Enjoy:**
• **FREE** library access with valid student ID
• **FREE** museum and archives access
• **5 books** borrowing limit for 2 weeks
• **No membership fees** - completely free!
• Access to all maritime databases and resources
• Study areas and research assistance
• Computer and WiFi access

**Additional Student Support:**
• Thesis and research assistance
• Maritime database training
• Career resources for maritime industry
• Internship opportunities through AIMS

As an AIMS student, you get full access to all CLAMS services at no cost! Need help with specific research or resources?`,

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

All programs include hands-on simulator training and prepare students for international maritime careers. Which program interests you most?`
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
    if (input.includes('student') && (input.includes('discount') || input.includes('benefit') || input.includes('free'))) {
      return `🎓 **AIMS Student Benefits:**

**Completely FREE Access:**
• Library membership & resources
• Museum visits & exhibitions  
• Archives research access
• Maritime database usage
• Study areas and facilities

**Borrowing Privileges:**
• 5 books for 2 weeks
• Renewal option if no holds
• Access to rare maritime collections
• IMO publications and STCW references

**Research Support:**
• Thesis assistance from maritime librarians
• Database training sessions
• Citation and research help
• Career resource guidance

**Just show your valid AIMS student ID at the CLAMS desk to get started!**

What specific resources would you like to explore as a student?`;
    }

    if (input.includes('cost') || input.includes('fee') || input.includes('price') || input.includes('how much')) {
      return `💰 **AIMS-CLAMS Cost Overview:**

**Membership Fees:**
• AIMS Students: **FREE** (with ID)
• External Researchers: ₱500/day or ₱2,000/month  
• Alumni: ₱1,000/year
• Faculty/Staff: **FREE** (with employment ID)

**Program Tuition:** Varies by program - contact (02) 8831-9925

**Additional Services:**
• Museum Group Tours: ₱50/person (min. 10 people)
• Research Consultation: Included with membership
• Digitization: Rates vary by project

**Scholarships & Discounts:**
• Merit-based scholarships available
• Industry professional discounts
• Senior citizen/PWD discounts

What specific cost information do you need?`;
    }

    if (input.includes('admission') || input.includes('apply') || input.includes('enroll')) {
      return `📋 **AIMS Admission Process:**

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
**Location:** Pasay City, Metro Manila

Would you like details about a specific program's admission requirements?`;
    }

    if (input.includes('archive') || input.includes('historical') || input.includes('document')) {
      return `📜 **CLAMS Archives Services:**

**Collections:**
• Philippine maritime history documents
• Ship documentation and vessel records  
• Historical maritime photographs and maps
• AIMS institutional archives since 1993

**Access:**
• By appointment only during library hours
• Research assistance available
• Digitization services for fragile documents

**Research Areas:**
• Philippine naval history
• Merchant marine development
• Maritime trade routes
• Shipbuilding traditions

**Contact:** (02) 8831-9925 to schedule archive research

What specific maritime history are you interested in exploring?`;
    }

    // Default comprehensive response
    return `⚓ **Ahoy! I'm De Malacca, your AIMS-CLAMS maritime assistant!** 

I can help you navigate:

🎓 **AIMS Academic Programs**
• Marine Engineering, Marine Transportation, Customs Administration, Maritime Business

📚 **CLAMS Library Services** 
• Membership, borrowing, research assistance, database access

🏛️ **Maritime Museum**
• Exhibitions, ship models, artifacts, educational tours

📜 **Archives & Historical Research**
• Philippine maritime history, ship documentation, records

💰 **Fees & Membership**
• Student benefits, costs, payment options

📞 **Contact & Location**
• (02) 8831-9925 | info@aims.edu.ph | Pasay City

**Library Hours:** Monday-Friday 7AM-7PM, Saturday 8AM-5PM

What would you like to explore today? ⚓`;
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
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          model: "google/gemini-pro",
          messages: [{ role: "user", content: "Say 'API test successful'" }],
          max_tokens: 10
        })
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
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