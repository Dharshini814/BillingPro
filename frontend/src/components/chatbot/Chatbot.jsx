import { useState, useEffect, useRef, useCallback } from 'react';
import { chatbotService } from '../../services/chatbotService';
import {
  SendIcon, CloseIcon, XIcon, RotateCcwIcon,
  BotIcon, UserIcon, LoaderIcon, AlertCircleIcon, TrashIcon, SparklesIcon, HeartIcon, ZapIcon,
  WalkingBotIcon
} from '../../components/common/Icons.jsx';
import styles from './Chatbot.module.css';

// Cute mascot name and personality
const BOT_NAME = 'Billie';
const BOT_EMOJI = '🤖';

// Suggested questions for each role
const CUSTOMER_SUGGESTIONS = [
  "What subscriptions do I have?",
  "Show my latest invoice",
  "Which invoices are unpaid?",
  "What payments have I made?",
  "When is my next billing date?",
  "How can I update my subscription?",
];

const ADMIN_SUGGESTIONS = [
  "How many active subscriptions do we have?",
  "What is the total revenue this month?",
  "How many invoices are overdue?",
  "Which payments failed recently?",
  "Show subscriptions expiring soon",
  "Summarize billing performance",
];

// Random friendly greetings
const GREETINGS = [
  "Hey there! 👋",
  "Hello! 😊",
  "Hi! Ready to help! 💫",
  "Greetings! 🌟",
  "What's up? 🤖",
];

const THINKING_MESSAGES = [
  "Let me check that for you...",
  "Crunching the numbers...",
  "Fetching your data...",
  "One moment please...",
  "Looking that up...",
];

function Chatbot({ role = 'customer', userName = 'User' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [thinkingMessage, setThinkingMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const suggestions = role === 'admin' ? ADMIN_SUGGESTIONS : CUSTOMER_SUGGESTIONS;
  const welcomeMessage = role === 'admin'
    ? `Welcome back, ${userName}! I'm ${BOT_NAME}, your BillingPro admin assistant. I can help you with revenue metrics, subscription analytics, failed payments, and customer lookups.`
    : `Hi ${userName}! I'm ${BOT_NAME}, your BillingPro assistant. I can help you check your subscriptions, invoices, payments, and billing history.`;

  // Rotate greetings
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(prev => GREETINGS[(GREETINGS.indexOf(prev) + 1) % GREETINGS.length]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Rotate thinking message while loading
  useEffect(() => {
    if (isLoading) {
      setThinkingMessage(THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]);
    }
  }, [isLoading]);

  // Handle sending a message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const message = inputValue.trim();
    if (!message || isLoading) return;

    // Add user message immediately
    const userMessage = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatbotService.sendMessage(message, conversationId);
      const assistantMessage = { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() };

      setMessages(prev => [...prev, assistantMessage]);
      setConversationId(response.conversation_id);
    } catch (err) {
      console.error('Chatbot error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to get response. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    handleSend();
  };

  // Handle retry after error
  const handleRetry = () => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastUserMessage = messages[messages.length - 1].content;
      setMessages(prev => prev.slice(0, -1)); // Remove the last user message
      setInputValue(lastUserMessage);
      handleSend();
    }
    setError(null);
  };

  // Clear chat history
  const handleClearHistory = async () => {
    if (conversationId) {
      try {
        await chatbotService.clearHistory(conversationId);
        setMessages([]);
        setConversationId(null);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Clear history error:', err);
        setError('Failed to clear history');
      }
    } else {
      setMessages([]);
      setConversationId(null);
      setShowSuggestions(true);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Toggle chat panel
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setShowSuggestions(messages.length === 0);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        toggleChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className={styles.chatbot} ref={panelRef}>
      {/* Floating Chat Button */}
      <button
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? `Close ${BOT_NAME}` : `Chat with ${BOT_NAME}`}
        aria-expanded={isOpen}
      >
        <div className={styles.fabInner}>
          {isOpen ? <XIcon size={24} /> : <BotIcon size={24} />}
          <span className={styles.fabPulse} />
        </div>
        <span className={styles.fabTooltip}>{isOpen ? 'Close' : `Chat with ${BOT_NAME}`}</span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label={`${BOT_NAME} - BillingPro Assistant`}>
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.botAvatar}>
                <WalkingBotIcon size={28} className={styles.headerWalkingBot} />
                <div className={styles.statusDot} />
              </div>
              <div>
                <h3 className={styles.title}>
                  <span className={styles.botName}>{BOT_NAME}</span>
                  <SparklesIcon size={14} className={styles.sparkle} />
                </h3>
                <span className={styles.subtitle}>
                  {role === 'admin' ? 'Admin Dashboard' : 'Customer Support'}
                </span>
              </div>
            </div>
            <div className={styles.headerActions}>
              {conversationId && (
                <button
                  className={styles.iconButton}
                  onClick={handleClearHistory}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                >
                  <TrashIcon size={16} />
                </button>
              )}
              <button
                className={styles.iconButton}
                onClick={toggleChat}
                title="Close"
                aria-label={`Close ${BOT_NAME}`}
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className={styles.messages} role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <div className={styles.welcomeAvatar}>
                  <div className={styles.walkingBotContainer}>
                    <WalkingBotIcon size={60} className={styles.walkingBot} />
                  </div>
                  <div className={styles.welcomeGlow} />
                </div>
                <p className={styles.welcomeText}>{welcomeMessage}</p>
                <div className={styles.greetingTag}>{greeting}</div>
                {showSuggestions && (
                  <div className={styles.suggestions}>
                    <p className={styles.suggestionsLabel}>Try asking:</p>
                    <div className={styles.suggestionsList}>
                      {suggestions.slice(0, 4).map((suggestion, i) => (
                        <button
                          key={i}
                          className={styles.suggestionChip}
                          onClick={() => handleSuggestionClick(suggestion)}
                          type="button"
                        >
                          <ZapIcon size={12} className={styles.chipIcon} />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`${styles.message} ${styles[msg.role]}`}>
                <div className={styles.messageAvatar}>
                  {msg.role === 'assistant' ? (
                    <div className={styles.avatarBot}>
                      <BotIcon size={16} />
                      <div className={styles.avatarEyes}>
                        <span />
                        <span />
                      </div>
                    </div>
                  ) : (
                    <div className={styles.avatarUser}>
                      <UserIcon size={16} />
                    </div>
                  )}
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.messageText}>{msg.content}</div>
                  <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className={`${styles.message} ${styles.loading}`}>
                <div className={styles.messageAvatar}>
                  <div className={styles.loadingBot}>
                    <BotIcon size={16} />
                    <div className={styles.loadingEyes}>
                      <span />
                      <span />
                    </div>
                    <div className={styles.loadingMouth} />
                  </div>
                </div>
                <div className={styles.loadingContent}>
                  <div className={styles.loadingDots}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <p className={styles.thinkingText}>{thinkingMessage}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className={`${styles.message} ${styles.error}`}>
                <div className={styles.messageAvatar}>
                  <div className={styles.errorAvatar}>
                    <AlertCircleIcon size={16} />
                  </div>
                </div>
                <div className={styles.errorContent}>
                  <p className={styles.errorText}>{error}</p>
                  <button className={styles.retryButton} onClick={handleRetry}>
                    <RotateCcwIcon size={14} /> Try again
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <footer className={styles.footer}>
            <form onSubmit={handleSend} className={styles.form}>
              <div className={styles.inputWrapper}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Ask ${BOT_NAME} about your billing...`}
                  className={styles.input}
                  disabled={isLoading}
                  aria-label="Type your message"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  className={`${styles.sendButton} ${!inputValue.trim() || isLoading ? styles.sendDisabled : ''}`}
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Send message"
                >
                  {isLoading ? <LoaderIcon size={18} className={styles.spinner} /> : <SendIcon size={18} />}
                </button>
              </div>
            </form>
            <p className={styles.hint}>
              Press <kbd>Enter</kbd> to send · <kbd>Esc</kbd> to close · Powered by OpenAI GPT-4o-mini
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

export default Chatbot;