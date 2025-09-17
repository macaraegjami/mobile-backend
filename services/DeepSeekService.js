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
      console.error("⛔ OpenRouter API Key is missing!");
      console.log("💡 Please set REACT_APP_OPENROUTER_API_KEY in your environment variables");
    } else if (this.apiKey.length < 20) {
      console.warn("⚠️ OpenRouter API Key seems too short, please verify");
    } else {
      console.log("✅ OpenRouter API Key loaded successfully");
    }
  }

  // Comprehensive AIMS-CLAMS knowledge base
  getCLAMSKnowledge() {
    return `
AIMS-CLAMS COMPLETE INFORMATION:

INSTITUTION:
- Asian Institute of Maritime Studies (AIMS) - Founded 1993
- Location: Pasay City, Metro Manila, Philippines
- CLAMS: Center of Library, Archives, and Museum Services
- Contact: (02) 8831-9925 | info@aims.edu.ph
- Website: www.aims.edu.ph

STAFF:
- Ms. Janet Abuid Dandan: VP Student Services
- Mr. Juan Martin R. Quasch: CLAMS Dean  
- Ms. Maria Raquel P. Mantala: Head Librarian
- Ms. Helen V. Vidal: Technical Head/Cataloguer
- Mr. Daryl Lorence P. Abarca: Head Archives & Museum
- Ms. Nina Ricci D. Racela: Museum Educator
- Ms. Sarah Jane H. Cheng: Head CLAMS Operations

PROGRAMS & COSTS:
- BS Marine Engineering (4 years) - Ship engines, machinery
- BS Marine Transportation (4 years) - Navigation, operations  
- BS Customs Administration (4 years)
- BS Maritime Business Management (4 years)
- Tuition: Contact (02) 8831-9925 for current rates
- Scholarships available for qualified students

FACILITIES:
- Ship Bridge Simulators (navigation training)
- Engine Room Simulators (machinery training)
- Training Vessel: M/V AIMS Explorer
- Maritime Engineering Workshops
- Computer Labs with maritime software

LIBRARY SERVICES:
- Hours: Monday-Friday 7:00 AM - 7:00 PM, Saturday 8:00 AM - 5:00 PM
- Collection: 25,000+ maritime specialized books
- IMO Publications (International Maritime Organization)
- Maritime law databases and legal resources
- STCW Standards (Standards of Training, Certification, Watchkeeping)
- Digital maritime journals and databases
- Study areas: Individual carrels, group study rooms
- Computer access and WiFi for research

MEMBERSHIP & FEES:
- AIMS Students: FREE with valid student ID
- Faculty/Staff: Full privileges with employment ID
- External Researchers: ₱500 per day OR ₱2,000 per month
- Alumni: ₱1,000 per year
- Maritime Industry Professionals: Special rates available
- Senior Citizens/PWD: Discounted rates

BORROWING POLICIES:
- AIMS Students: 5 books maximum, 2 weeks loan period
- Faculty: 10 books maximum, 1 month loan period
- External members: Reference use only unless special arrangement
- Renewals: Once only if no holds/reservations
- Overdue fines: ₱10 per day per book
- Lost book replacement: Full cost + processing fee

ARCHIVES SERVICES:
- Philippine maritime history documents
- Ship documentation and vessel records
- AIMS institutional archives since 1993
- Historical maritime photographs and maps
- Access by appointment only
- Research assistance for maritime history projects
- Digitization services available

MUSEUM SERVICES:
- Ship models from different eras
- Maritime artifacts and nautical instruments
- Philippine naval and merchant marine history
- Interactive maritime displays
- Educational tours for schools and groups
- Rotating exhibitions on maritime themes
- Museum shop with maritime books and souvenirs
- Group tours: ₱50 per person (minimum 10 people)

DIGITAL SERVICES:
- Online catalog (OPAC) for book searches
- Digital maritime resources portal
- Remote access to databases for members
- E-book collection on maritime topics
- Virtual museum tours available
- Online research consultations

RESEARCH SERVICES:
- Maritime thesis and research support
- Citation assistance and bibliography help
- Database training and orientation
- Literature searches on maritime topics
- Inter-library loan services
- Research consultation by appointment

SPECIAL COLLECTIONS:
- Rare maritime books and manuscripts
- IMO conventions and amendments
- Philippine maritime law collection
- Historical shipping company records
- Maritime accident investigation reports
- Admiralty court decisions
`;
  }

  async generateResponse(userInput, context = "") {
    if (!this.apiKey) {
      return this.generateAdvancedFallback(userInput);
    }

    if (!userInput || userInput.trim().length === 0) {
      return "I notice you sent an empty message. What specific question about AIMS or CLAMS can I help you with?";
    }

    // Quick response for very specific questions
    const quickAnswer = this.getSpecificAnswer(userInput);
    if (quickAnswer) {
      return quickAnswer;
    }

    // Try AI response with retries
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🔥 AI API attempt ${attempt}/2`);
        
        const response = await fetch(this.baseUrl, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            model: "deepseek/deepseek-r1:free",
            messages: [
              {
                role: "system", 
                content: this.getSystemPrompt()
              },
              {
                role: "user",
                content: userInput
              }
            ],
            temperature: 0.4,
            max_tokens: 250,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`API Error ${response.status}`);
        }

        const data = await response.json();
        
        if (data.choices?.[0]?.message?.content) {
          const aiResponse = data.choices[0].message.content.trim();
          
          if (aiResponse.length < 20) {
            throw new Error("Response too short");
          }
          
          console.log(`✅ AI success on attempt ${attempt}`);
          return this.cleanResponse(aiResponse, userInput);
        }
        
        throw new Error("Invalid response format");
        
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.error("🚫 AI failed, using fallback");
    return this.generateAdvancedFallback(userInput);
  }

  // NEW: Get specific answers for common questions
  getSpecificAnswer(userInput) {
    const input = userInput.toLowerCase();
    
    // Cost/Fee questions
    if (input.includes('how much') || input.includes('cost') || input.includes('price') || input.includes('fee')) {
      if (input.includes('membership') || input.includes('library')) {
        return `**CLAMS Membership Fees:**

• **AIMS Students:** FREE with student ID
• **External Researchers:** ₱500/day OR ₱2,000/month  
• **Alumni:** ₱1,000/year
• **Faculty/Staff:** FREE with employment ID
• **Maritime Professionals:** Special industry rates

**Additional Services:**
• Museum Group Tours: ₱50/person (minimum 10)
• Digitization Services: Rates vary by project
• Research Consultation: Included with membership

Need help with membership application or specific service costs?`;
      }
      
      if (input.includes('tuition') || input.includes('program') || input.includes('aims')) {
        return `**AIMS Program Costs:**

AIMS tuition fees vary by program and year level. For current rates:

📞 **Contact Admissions:** (02) 8831-9925
📧 **Email:** info@aims.edu.ph
🏢 **Visit:** AIMS Campus, Pasay City

**Financial Aid Available:**
• Merit-based scholarships
• Need-based assistance  
• Industry sponsorship programs
• Installment payment plans

**Programs Available:**
• BS Marine Engineering (4 years)
• BS Marine Transportation (4 years)  
• BS Customs Administration (4 years)
• BS Maritime Business Management (4 years)

Which program's costs are you interested in learning about?`;
      }
      
      if (input.includes('artifact') || input.includes('museum') || input.includes('exhibition')) {
        return `**Maritime Museum Access:**

**Museum Admission:**
• **Free** with CLAMS library membership
• **Group Tours:** ₱50 per person (minimum 10 people)
• **Individual visits** included in daily library pass (₱500)

**What You'll See:**
• Historic ship models from different eras
• Maritime artifacts and nautical instruments
• Philippine naval and merchant marine exhibits
• Interactive maritime displays
• Rotating special exhibitions

**Tour Options:**
• Self-guided tours during library hours
• Guided group tours by appointment
• Educational programs for schools
• Virtual tours available online

**Museum Hours:** Monday-Friday by appointment, included in library hours
**Book Tours:** Contact (02) 8831-9925

Would you like to schedule a museum visit or learn about current exhibitions?`;
      }
    }
    
    // Hours questions
    if (input.includes('hour') || input.includes('open') || input.includes('close') || input.includes('schedule')) {
      return `**AIMS-CLAMS Operating Hours:**

📚 **Maritime Library:**
• **Monday-Friday:** 7:00 AM - 7:00 PM
• **Saturday:** 8:00 AM - 5:00 PM
• **Sunday & Holidays:** Closed

🏛️ **Archives & Museum:**
• **By Appointment Only**
• **Monday-Friday:** During library hours
• **Contact:** (02) 8831-9925 to schedule

🎓 **AIMS Campus:**
• **Monday-Friday:** 7:00 AM - 8:00 PM
• **Saturday:** 8:00 AM - 5:00 PM

**Special Notes:**
• Hours may vary during holidays
• Extended hours during exam periods
• 24/7 online access to digital resources for members

**Contact for appointments:** (02) 8831-9925

What specific service do you need to access?`;
    }

    // Borrowing questions
    if (input.includes('borrow') || input.includes('checkout') || input.includes('loan')) {
      return `**Maritime Library Borrowing Policy:**

📖 **Borrowing Limits:**
• **AIMS Students:** 5 books for 2 weeks
• **Faculty/Staff:** 10 books for 1 month
• **External Members:** Reference use (special arrangements possible)

🔄 **Renewals & Returns:**
• **Renewal:** Once only if no holds
• **Overdue Fine:** ₱10 per day per book
• **Lost Books:** Full replacement cost + processing fee

📋 **Requirements:**
• Valid AIMS ID or CLAMS membership
• Account in good standing (no outstanding fines)
• Sign borrowing agreement

**Special Collections:**
• IMO publications: Library use only
• Rare maritime books: Restricted access
• Thesis collection: Reference only

**Online Services:**
• Check account status online
• Renew books through OPAC
• Reserve books in advance

Need help finding specific maritime resources or setting up your borrowing account?`;
    }

    return null; // No specific answer found
  }

  getSystemPrompt() {
    return `You are De Malacca, the expert maritime assistant for AIMS-CLAMS. 

CRITICAL INSTRUCTIONS:
1. Give SPECIFIC, DIRECT answers to user questions
2. Don't start with "I'm De Malacca" unless it's a greeting
3. Use the knowledge base below to provide accurate information
4. If you don't know something, say so and refer to staff
5. Keep responses under 200 words but be helpful
6. Use maritime terminology appropriately
7. Always end with a relevant follow-up question

KNOWLEDGE BASE:
${this.getCLAMSKnowledge()}

Answer the user's question directly and specifically using this information.`;
  }

  cleanResponse(response, userInput) {
    let cleaned = response.trim();
    
    // Remove generic introductions from non-greeting responses
    if (!this.isGreeting(userInput)) {
      cleaned = cleaned.replace(/^.*?I'm De Malacca[^.]*\.?\s*/i, '');
      cleaned = cleaned.replace(/^.*?Ahoy[^.]*\.?\s*/i, '');
      cleaned = cleaned.replace(/^.*?Welcome[^.]*\.?\s*/i, '');
    }
    
    // Ensure we have substantial content
    if (cleaned.length < 50) {
      return this.generateAdvancedFallback(userInput);
    }
    
    return cleaned;
  }

  isGreeting(userInput) {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const input = userInput.toLowerCase().trim();
    return greetings.some(greeting => input === greeting || input.startsWith(greeting + ' '));
  }

  generateAdvancedFallback(userInput) {
    const input = userInput.toLowerCase();
    
    // Specific fallback responses
    if (input.includes('cost') || input.includes('fee') || input.includes('price') || input.includes('how much')) {
      if (input.includes('membership')) {
        return "**CLAMS Membership Fees:** AIMS students FREE, External researchers ₱500/day or ₱2,000/month, Alumni ₱1,000/year. Maritime professionals get special rates. Contact (02) 8831-9925 for details. Which membership type interests you?";
      }
      if (input.includes('museum') || input.includes('artifact')) {
        return "**Museum Access:** Free with library membership, Group tours ₱50/person (min. 10). See historic ship models, maritime artifacts, and Philippine naval exhibits. Want to schedule a visit?";
      }
      if (input.includes('program') || input.includes('tuition')) {
        return "**AIMS Program Costs:** Tuition varies by program. Contact admissions (02) 8831-9925 for current rates. Scholarships available for Marine Engineering, Marine Transportation, Customs Admin, and Maritime Business. Which program interests you?";
      }
      return "**General Costs:** CLAMS membership ₱500/day (external), AIMS tuition varies by program, Museum tours ₱50/person. Contact (02) 8831-9925 for specific pricing. What costs did you want to know about?";
    }
    
    if (input.includes('hour') || input.includes('open')) {
      return "**Operating Hours:** Library Mon-Fri 7AM-7PM, Sat 8AM-5PM. Archives & Museum by appointment. AIMS campus Mon-Fri 7AM-8PM. Contact (02) 8831-9925. Which service do you need?";
    }
    
    if (input.includes('borrow') || input.includes('checkout')) {
      return "**Borrowing:** AIMS students 5 books/2 weeks, Faculty 10 books/1 month. External members reference use. Overdue ₱10/day per book. Need help finding specific maritime resources?";
    }
    
    if (input.includes('program') || input.includes('marine') || input.includes('aims')) {
      return "**AIMS Programs:** BS Marine Engineering (ship engines), BS Marine Transportation (navigation), BS Customs Administration, BS Maritime Business Management. All include simulator training. Which program appeals to you?";
    }
    
    if (input.includes('museum') || input.includes('artifact') || input.includes('exhibit')) {
      return "**Maritime Museum:** Ship models, nautical instruments, Philippine naval history. Free with membership, group tours ₱50/person. Educational programs available. Want to schedule a visit?";
    }
    
    // Default comprehensive response
    return "I can help with AIMS maritime programs, CLAMS library services, membership fees, borrowing policies, museum tours, and archives access. **Contact:** (02) 8831-9925 | **Hours:** Mon-Fri 7AM-7PM | **Location:** Pasay City. What specific information do you need?";
  }

  // Storage methods for React Native
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