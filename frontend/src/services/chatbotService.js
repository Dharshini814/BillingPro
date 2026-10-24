import api from './api.js';

export const chatbotService = {
  /**
   * Send a message to the chatbot
   * @param {string} message - User message
   * @param {string|null} conversationId - Optional conversation ID for continuing a chat
   * @returns {Promise<{answer: string, sources: string[], conversation_id: string}>}
   */
  sendMessage: async (message, conversationId = null) => {
    const response = await api.post('/chat/message', {
      message,
      conversation_id: conversationId,
    });
    return response.data;
  },

  /**
   * Get chat history for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<{conversation_id: string, messages: Array<{role: string, content: string, timestamp: string}>>}
   */
  getHistory: async (conversationId) => {
    const response = await api.get(`/chat/history/${conversationId}`);
    return response.data;
  },

  /**
   * List all conversations for the current user
   * @returns {Promise<string[]>}
   */
  listConversations: async () => {
    const response = await api.get('/chat/history');
    return response.data;
  },

  /**
   * Clear chat history for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<{message: string}>}
   */
  clearHistory: async (conversationId) => {
    const response = await api.delete(`/chat/history/${conversationId}`);
    return response.data;
  },
};

export default chatbotService;