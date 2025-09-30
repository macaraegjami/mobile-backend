// src/services/ChatService.js - SIMPLIFIED VERSION
import DeepSeekService from './DeepSeekService';

class ChatService {
  constructor() {
    this.conversationHistory = [];
  }

  async generateResponse(userInput) {
    try {
      console.log("🤖 ChatService processing:", userInput);

      // Add user message to history
      this.addToHistory('user', userInput);

      // Get response from DeepSeekService (which now handles model rotation)
      const response = await DeepSeekService.generateResponse(userInput);
      
      console.log("✅ Response received, length:", response.length);

      // Add bot response to history
      this.addToHistory('assistant', response);
      
      return response;

    } catch (error) {
      console.error("❌ ChatService error:", error);
      const fallback = this.getEmergencyResponse(userInput);
      this.addToHistory('assistant', fallback);
      return fallback;
    }
  }

  getEmergencyResponse(userInput) {
    return `⚓ I'm experiencing some technical waves right now. 

For immediate assistance with AIMS-CLAMS:

📞 **Call:** (02) 8831-9925
📧 **Email:** info@aims.edu.ph
🏢 **Visit:** AIMS Campus, Pasay City

**Library Hours:** Monday-Friday 7AM-7PM, Saturday 8AM-5PM

I can still help with questions about:
• Maritime programs and admissions
• Library services and membership
• Museum exhibits and tours
• Student benefits and resources

What would you like to know? 🌊`;
  }

  addToHistory(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 messages to prevent memory issues
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-5);
    }
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

export default new ChatService();