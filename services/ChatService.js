// src/services/ChatService.js - UPDATED
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeepSeekService from './DeepSeekService';

class ChatService {
  constructor() {
    this.conversationHistory = [];
    this.responseCache = new Map();
    this.isAIAvailable = true; // Assume AI is available initially
  }

  async generateResponse(userInput) {
    try {
      console.log("🤖 ChatService processing:", userInput);

      // Add user message to history
      this.addToHistory('user', userInput);

      // Check for quick responses first
      const quickResponse = this.getQuickResponse(userInput);
      if (quickResponse) {
        this.addToHistory('assistant', quickResponse);
        return quickResponse;
      }

      // If AI is available, try to get AI response
      if (this.isAIAvailable) {
        try {
          console.log("🚀 Attempting AI response...");
          const aiResponse = await DeepSeekService.generateResponse(userInput);
          
          if (aiResponse && aiResponse.length > 10) {
            console.log("✅ AI response successful");
            this.addToHistory('assistant', aiResponse);
            return aiResponse;
          } else {
            throw new Error("AI response too short");
          }
        } catch (aiError) {
          console.warn("❌ AI service failed, falling back:", aiError);
          this.isAIAvailable = false;
          // Continue to fallback response
        }
      }

      // Fallback to contextual response
      const fallbackResponse = this.generateContextualFallback(userInput);
      this.addToHistory('assistant', fallbackResponse);
      return fallbackResponse;

    } catch (error) {
      console.error("💥 ChatService error:", error);
      return this.getEmergencyResponse(userInput);
    }
  }

  getQuickResponse(userInput) {
    const input = userInput.toLowerCase().trim();
    
    // Quick greetings
    if (/(hello|hi|hey|hola)/i.test(input) && input.length < 10) {
      return "Ahoy! I'm De Malacca, your AIMS-CLAMS maritime assistant! ⚓ How can I help you explore maritime education and library services today?";
    }

    // Very specific common questions with direct answers
    if (input.includes('library hours')) {
      return "📚 CLAMS Library Hours:\n• Monday-Friday: 7:00 AM - 7:00 PM\n• Saturday: 8:00 AM - 5:00 PM\n• Sunday: Closed\n\nNeed access to specific maritime resources?";
    }

    if (input.includes('membership fee') || input.includes('membership cost')) {
      return "💰 CLAMS Membership Fees:\n• AIMS Students: FREE with ID\n• External Researchers: ₱500/day or ₱2,000/month\n• Alumni: ₱1,000/year\n• Maritime Professionals: Special rates\n\nWhich membership type are you interested in?";
    }

    if (input.includes('contact') || input.includes('phone') || input.includes('number')) {
      return "📞 Contact AIMS-CLAMS:\n• Phone: (02) 8831-9925\n• Email: info@aims.edu.ph\n• Location: Pasay City, Metro Manila\n• Website: www.aims.edu.ph\n\nWhat specific information do you need?";
    }

    if (input.includes('program') && input.length < 20) {
      return "🎓 AIMS Maritime Programs:\n• BS Marine Engineering\n• BS Marine Transportation\n• BS Customs Administration\n• BS Maritime Business Management\n\nAll programs include hands-on simulator training. Which program would you like to know more about?";
    }

    return null; // No quick response available
  }

  generateContextualFallback(userInput) {
    const input = userInput.toLowerCase();
    
    // Enhanced contextual responses
    if (input.includes('how much') || input.includes('cost') || input.includes('price')) {
      if (input.includes('tuition') || input.includes('program')) {
        return "AIMS program tuition varies by course. For current Marine Engineering, Marine Transportation, Customs Administration, or Maritime Business Management fees, please contact admissions at (02) 8831-9925. Scholarships are available for qualified students!";
      }
      if (input.includes('museum') || input.includes('artifact')) {
        return "Museum access is included with CLAMS membership! For non-members, group tours are ₱50 per person (minimum 10 people). We have historic ship models, maritime artifacts, and Philippine naval history exhibits.";
      }
      return "💰 Cost Information:\n• Library Membership: ₱500/day (external)\n• AIMS Tuition: Varies by program\n• Museum Tours: ₱50/person (groups)\n\nContact (02) 8831-9925 for specific pricing!";
    }

    if (input.includes('marine engineering')) {
      return "⚙️ Marine Engineering at AIMS focuses on ship engines, marine machinery, and power systems. The 4-year program includes engine room simulator training and prepares students for international vessel operations. Want details about admission requirements?";
    }

    if (input.includes('marine transportation')) {
      return "🧭 Marine Transportation covers navigation, cargo operations, and vessel management. Our 4-year program includes bridge simulator training and prepares students for ship officer careers. Interested in the curriculum details?";
    }

    if (input.includes('borrow') || input.includes('book') || input.includes('loan')) {
      return "📖 Borrowing Policies:\n• AIMS Students: 5 books for 2 weeks\n• Faculty: 10 books for 1 month\n• Renewal: Once if no holds\n• Overdue: ₱10/day per book\n\nWe have 25,000+ maritime specialized books!";
    }

    if (input.includes('archive') || input.includes('historical')) {
      return "📜 Our Archives preserve Philippine maritime history, ship documentation, and historical records. Access is by appointment for researchers. What specific maritime history period interests you?";
    }

    if (input.includes('museum') || input.includes('exhibit')) {
      return "🏛️ Maritime Museum Features:\n• Historic ship models\n• Nautical instruments\n• Philippine naval history\n• Interactive displays\n• Educational tours\n\nOpen by appointment during library hours!";
    }

    if (input.includes('simulator') || input.includes('lab')) {
      return "🎮 AIMS Training Facilities:\n• Ship Bridge Simulators\n• Engine Room Simulators\n• Maritime Computer Labs\n• Training Vessel M/V AIMS Explorer\n\nThese support hands-on maritime education!";
    }

    // Default comprehensive response
    return `⚓ I'm De Malacca, your AIMS-CLAMS maritime assistant! I can help you with:

🎓 AIMS Academic Programs
📚 Maritime Library Resources  
📜 Historical Archives
🏛️ Museum Exhibitions
💰 Membership & Fees
📞 Contact Information

Try asking about:
• "Marine Engineering program details"
• "Library membership costs" 
• "Museum tour schedules"
• "Archive research access"
• "AIMS admission requirements"

Or contact us directly: (02) 8831-9925

What specific maritime information can I help you navigate today?`;
  }

  getEmergencyResponse(userInput) {
    return `⚓ Ahoy! I'm experiencing some technical waves right now. 

For immediate assistance with AIMS-CLAMS:

📞 Call: (02) 8831-9925
📧 Email: info@aims.edu.ph
🏢 Visit: AIMS Campus, Pasay City

Library Hours: Mon-Fri 7AM-7PM, Sat 8AM-5PM

I can still help with basic questions about:
• Maritime programs
• Library services  
• Membership fees
• Museum exhibits

What would you like to know?`;
  }

  addToHistory(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 messages to prevent memory issues
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  // Reset AI availability (call this if you want to retry AI)
  resetAIAvailability() {
    this.isAIAvailable = true;
  }
}

export default new ChatService();