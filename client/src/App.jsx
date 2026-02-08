import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Menu, ChevronRight, Copy, Edit2, Check, FileText, Sparkles, Activity, Cpu, Zap, Sun, Moon, Wand2, X, ArrowRight, AlertTriangle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

function App() {
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [depth, setDepth] = useState('Short');
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [smartPromptData, setSmartPromptData] = useState(null);
  const [isSmartPromptLoading, setIsSmartPromptLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load initial chats
  useEffect(() => {
    fetchChats();
    const storedChatId = localStorage.getItem('sanyai_chat_id');
    if (storedChatId) {
        setCurrentChatId(storedChatId);
        loadMessages(storedChatId);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Estimate tokens on input change
  useEffect(() => {
    const count = Math.ceil(input.length / 4);
    setEstimatedTokens(count);
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const fetchChats = async () => {
    try {
        const res = await axios.get(`${API_URL}/chats`);
        if (res.data.chats) {
            setChats(res.data.chats);
        }
    } catch (error) {
        console.error("Failed to fetch chats", error);
    }
  };

  const loadMessages = async (id) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/chat/${id}`);
      setMessages(res.data.messages || []);
      setCurrentChatId(id);
      localStorage.setItem('sanyai_chat_id', id);
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
        setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    localStorage.removeItem('sanyai_chat_id');
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyChat = () => {
    const chatText = messages.map(m => `${m.role === 'user' ? 'User' : 'Sanyai'}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(chatText);
    setCopiedId('chat');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleSmartPrompt = async () => {
    if (!input.trim()) return;
    setIsSmartPromptLoading(true);
    try {
        const res = await axios.post(`${API_URL}/smart-prompt`, { prompt: input });
        setSmartPromptData(res.data);
    } catch (error) {
        console.error("Smart Prompt failed", error);
        // Optional: Notify user of smart prompt failure
    } finally {
        setIsSmartPromptLoading(false);
    }
  };

  const acceptSmartPrompt = () => {
    if (smartPromptData) {
        setInput(smartPromptData.optimizedPrompt);
        setSmartPromptData(null);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { 
        role: 'user', 
        content: input, 
        id: Date.now().toString(),
        tokens: estimatedTokens 
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        chat_id: currentChatId,
        message: currentInput,
        depth: depth,
        webSearch: isWebSearch
      });

      if (!currentChatId) {
        const newChatId = res.data.chat_id;
        setCurrentChatId(newChatId);
        localStorage.setItem('sanyai_chat_id', newChatId);
        fetchChats();
      }

      const { response, usage } = res.data;

      // Update user message with exact input tokens
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
            ? { ...msg, tokens: usage?.input_tokens || msg.tokens, exactTokens: true } 
            : msg
      ));

      const assistantMessage = { 
        role: 'assistant', 
        content: response,
        id: Date.now().toString() + 'a',
        tokens: usage?.output_tokens
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message", error);
      let errorText = "Error: Could not reach the server. Please try again.";
      
      const attemptedUrl = `${API_URL}/chat`;

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorText = `Error ${error.response.status}: ${error.response.data?.error || error.response.statusText}`;
      } else if (error.request) {
        // The request was made but no response was received
        errorText = `Network Error: No response from ${API_URL}. Check if Backend is running.`;
      } else {
        // Something happened in setting up the request that triggered an Error
        errorText = `Request Error: ${error.message}`;
      }

      // Add debug info to the error message displayed to the user
      errorText += ` (Target: ${API_URL})`;

      const errorMessage = {
        role: 'assistant',
        content: errorText,
        id: Date.now().toString() + 'e',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full mesh-bg text-[var(--text-primary)] overflow-hidden font-sans transition-colors duration-300">
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
                onClick={() => setSidebarOpen(false)}
            />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className={`
            fixed md:relative z-30 flex flex-col h-full 
            glass-panel border-r border-[var(--border-light)]
            overflow-hidden
        `}
      >
        <div className="p-4">
            <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'var(--bg-tertiary)' }}
                whileTap={{ scale: 0.98 }}
                onClick={startNewChat}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)]/50 border border-[var(--border-light)] rounded-xl transition-all shadow-sm hover:border-[var(--accent)] hover:shadow-[0_0_10px_rgba(234,179,8,0.1)] group"
            >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                <span className="font-semibold tracking-wide">New Chat</span>
            </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-3 py-2 opacity-70">History</div>
            {chats.map(chat => (
                <motion.button
                    key={chat.id}
                    layout
                    whileHover={{ x: 4, backgroundColor: 'var(--bg-tertiary)' }}
                    onClick={() => {
                        loadMessages(chat.id);
                        if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-3 text-sm text-left rounded-lg transition-colors truncate group relative overflow-hidden
                        ${currentChatId === chat.id ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
                    `}
                >
                    <MessageSquare size={16} className={currentChatId === chat.id ? "animate-pulse" : ""} />
                    <span className="truncate relative z-10">{chat.id.slice(0, 12)}...</span>
                    {currentChatId === chat.id && <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent" />}
                </motion.button>
            ))}
        </div>

        <div className="p-4 border-t border-[var(--border-light)]/50 bg-[var(--bg-tertiary)]/20">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-yellow-600 text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(234,179,8,0.3)] group-hover:scale-110 transition-transform">
                    R
                </div>
                <div className="flex-1">
                    <div className="font-medium group-hover:text-[var(--accent)] transition-colors">Rahul</div>
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                        <Sparkles size={10} className="text-[var(--accent)]" /> Pro Member
                    </div>
                </div>
            </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 flex items-center justify-between px-6 border-b border-[var(--border-light)] glass-panel-strong sticky top-0 z-10 shadow-lg shadow-black/5">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)] transition-all hover:scale-105 active:scale-95"
                >
                    {sidebarOpen ? <Menu size={20} /> : <ChevronRight size={20} />}
                </button>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tighter animate-gradient-text drop-shadow-sm">Sanyai</h1>
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[var(--accent)] text-black rounded-full shadow-[0_0_10px_rgba(234,179,8,0.4)] animate-pulse">
                            Beta
                        </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wide">
                        Powered by OpenAI • Groq Inference
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <motion.button 
                    whileHover={{ scale: 1.05, rotate: 10 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleTheme}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--accent)] rounded-xl hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--accent)]/20 transition-all"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </motion.button>
                <motion.button 
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyChat}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--accent)] rounded-xl hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--accent)]/20 transition-all"
                    title="Copy entire chat"
                >
                    {copiedId === 'chat' ? <Check size={20} className="text-green-500" /> : <FileText size={20} />}
                </motion.button>
            </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-10 pb-10">
                <AnimatePresence initial={false}>
                {messages.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8"
                    >
                        <motion.div 
                            animate={{ y: [0, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] shadow-[0_0_30px_rgba(234,179,8,0.15)] border border-[var(--border-light)]"
                        >
                            <Bot size={48} className="drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                        </motion.div>
                        <div className="space-y-3">
                            <h2 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-[var(--text-primary)] to-[var(--text-secondary)]">
                              hi SANYAI
                            </h2>
                            <p className="text-[var(--text-secondary)] max-w-md mx-auto">
                                Experience the power of Sanyai with advanced reasoning and real-time token tracking.
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    messages.map((msg, idx) => (
                        <motion.div 
                            key={msg.id || idx}
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`group flex gap-5 md:gap-8 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role !== 'user' && (
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 text-[var(--accent)] shadow-lg border border-[var(--border-light)] mt-1">
                                    <Bot size={24} className="drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]" />
                                </div>
                            )}
                            
                            <div className={`flex flex-col max-w-[90%] md:max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className="font-medium text-[11px] uppercase tracking-wider text-[var(--text-secondary)] mb-1 px-1 flex items-center gap-2 opacity-70">
                                    {msg.role === 'user' ? 'You' : 'Sanyai AI'}
                                </div>
                                
                                <div className={`relative px-8 py-6 rounded-[2rem] text-base leading-relaxed shadow-lg transition-all duration-300 hover:shadow-2xl ${
                                    msg.role === 'user' 
                                    ? 'glass-panel text-[var(--text-primary)] rounded-tr-sm border-l-4 border-l-[var(--accent)] neon-glow' 
                                    : 'text-[var(--text-primary)] pl-0 markdown-content w-full'
                                }`}>
                                    {msg.role === 'user' ? (
                                        <>
                                            <div className="text-lg font-medium">{msg.content}</div>
                                            
                                            {/* BIG USER TOKEN DISPLAY */}
                                            {msg.tokens !== undefined && (
                                                <div className="mt-4 flex justify-end">
                                                    <div className={`
                                                        px-4 py-2 rounded-xl flex items-center gap-3
                                                        glass-panel-strong border border-[var(--accent)]/30
                                                        shadow-[0_0_15px_rgba(234,179,8,0.1)]
                                                        ${msg.exactTokens ? 'animate-pulse-glow border-[var(--accent)]/60' : ''}
                                                    `}>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold">Input Tokens</span>
                                                            <span className={`text-xl font-mono font-bold ${msg.exactTokens ? 'text-[var(--accent)] drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'text-[var(--text-secondary)]'}`}>
                                                                {msg.tokens}
                                                            </span>
                                                        </div>
                                                        <div className={`p-2 rounded-lg ${msg.exactTokens ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                                                            <Zap size={18} fill={msg.exactTokens ? "black" : "none"} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                        <div className="glass-panel p-6 rounded-[2rem] rounded-tl-sm border border-[var(--border-light)] shadow-xl relative overflow-hidden">
                                            {/* Decorative top gradient */}
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] to-transparent opacity-50" />
                                            
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({node, inline, className, children, ...props}) {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return !inline && match ? (
                                                            <div className="rounded-xl overflow-hidden my-6 border border-[var(--border-light)] shadow-2xl group/code">
                                                                <div className="flex items-center justify-between px-4 py-2 bg-[#151515] border-b border-[#2d2d2d]">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                                                                        <span className="ml-2 text-xs text-gray-400 font-mono uppercase tracking-wider">{match[1]}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleCopy(String(children), `code-${msg.id}-${idx}`)}
                                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                                    >
                                                                        {copiedId === `code-${msg.id}-${idx}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                                    </button>
                                                                </div>
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    customStyle={{ margin: 0, padding: '1.5rem', background: '#0e0e0e' }}
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            </div>
                                                        ) : (
                                                            <code className={`${className} bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded text-sm font-mono border border-[var(--accent)]/20`} {...props}>
                                                                {children}
                                                            </code>
                                                        )
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                        
                                        {/* BIG RESPONSE TOKEN DISPLAY */}
                                        {msg.tokens !== undefined && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.5 }}
                                                className="mt-6 flex justify-start"
                                            >
                                                <div className="
                                                    relative overflow-hidden group/token
                                                    flex items-center gap-4 px-6 py-3 
                                                    glass-panel-strong border border-[var(--accent)]/20 rounded-2xl
                                                    hover:border-[var(--accent)]/50 transition-all duration-300
                                                    shadow-[0_4px_20px_rgba(0,0,0,0.2)]
                                                ">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent opacity-0 group-hover/token:opacity-100 transition-opacity" />
                                                    
                                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-[0_0_10px_rgba(234,179,8,0.1)] group-hover/token:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-shadow">
                                                        <Cpu size={20} />
                                                    </div>
                                                    
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Tokens Generated</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-2xl font-mono font-bold text-[var(--text-primary)] group-hover/token:text-[var(--accent)] transition-colors drop-shadow-sm">
                                                                {msg.tokens}
                                                            </span>
                                                            <span className="text-xs text-[var(--text-muted)] font-medium">toks</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="h-8 w-[1px] bg-[var(--border-light)] mx-2" />
                                                    
                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                        <Activity size={14} className="text-green-500" />
                                                        <span className="text-[9px] font-bold text-green-500 uppercase">Complete</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                        </>
                                    )}
                                </div>
                                
                                {/* Action Bar */}
                                <div className={`flex items-center gap-2 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <button 
                                        onClick={() => handleCopy(msg.content, msg.id)}
                                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors border border-transparent hover:border-[var(--border-light)]"
                                        title="Copy text"
                                    >
                                        {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    </button>
                                    
                                    {msg.role === 'user' && (
                                        <button 
                                            onClick={() => handleEdit(msg.content)}
                                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors border border-transparent hover:border-[var(--border-light)]"
                                            title="Edit request"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                             {msg.role === 'user' && (
                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0 text-[var(--text-secondary)] mt-1 border border-[var(--border-light)] shadow-md">
                                    <User size={24} />
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
                </AnimatePresence>
                
                {isLoading && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-6"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 text-[var(--accent)] border border-[var(--border-light)] animate-pulse-glow">
                             <Bot size={24} />
                        </div>
                        <div className="glass-panel px-6 py-4 rounded-3xl rounded-tl-sm flex items-center space-x-2">
                            <span className="text-sm font-medium text-[var(--text-secondary)] mr-2">Thinking</span>
                            <div className="typing-dot bg-[var(--accent)]"></div>
                            <div className="typing-dot bg-[var(--accent)]"></div>
                            <div className="typing-dot bg-[var(--accent)]"></div>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-8 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent relative z-20 transition-colors duration-300">
            <div className="max-w-4xl mx-auto relative group/input">
                
                {/* FLOATING LIVE TOKEN MONITOR */}
                <div className="absolute -top-14 left-0 z-10 flex gap-2">
                    <div className="glass-panel p-1 rounded-xl flex items-center gap-1 border border-[var(--border-light)] shadow-lg">
                        {['Concise', 'Short', 'Medium', 'Large'].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDepth(d)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300
                                    ${depth === d 
                                        ? 'bg-[var(--accent)] text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                    }
                                `}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    <motion.button
                        onClick={() => setIsWebSearch(!isWebSearch)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
                            px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg border
                            ${isWebSearch
                                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-light)] hover:text-[var(--text-primary)]'
                            }
                        `}
                        title="Toggle Web Search"
                    >
                        <Globe size={18} className={isWebSearch ? "animate-pulse" : ""} />
                        <span className="text-xs font-bold uppercase tracking-wide">Web Search</span>
                    </motion.button>

                    <motion.button
                        onClick={handleSmartPrompt}
                        disabled={!input.trim() || isSmartPromptLoading}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
                            group relative overflow-hidden px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg
                            ${input.trim() && !isSmartPromptLoading 
                                ? 'bg-[var(--accent)] text-black cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:shadow-[0_0_25px_rgba(234,179,8,0.6)] border border-transparent' 
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)] opacity-60 cursor-not-allowed'
                            }
                        `}
                        title="Smart Prompt: Optimize and Fix"
                    >
                        {input.trim() && !isSmartPromptLoading && (
                            <motion.div
                                className="absolute inset-0 bg-white/20"
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            />
                        )}
                        <Wand2 size={18} className={`relative z-10 ${isSmartPromptLoading ? "animate-spin" : ""}`} />
                        <span className="relative z-10 text-xs font-bold uppercase tracking-wide">Smart Prompt</span>
                    </motion.button>
                </div>

                <AnimatePresence>
                    {smartPromptData && (
                         <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full mb-4 left-0 right-0 z-30"
                        >
                            <div className="glass-panel p-6 rounded-2xl border border-[var(--accent)]/30 shadow-[0_0_50px_rgba(234,179,8,0.2)] bg-[var(--bg-secondary)]/95 backdrop-blur-2xl">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="text-[var(--accent)]" size={20} />
                                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Smart Prompt Optimization</h3>
                                    </div>
                                    <button onClick={() => setSmartPromptData(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Issues Column */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Issues Detected</h4>
                                        {smartPromptData.issues.length > 0 ? (
                                            <div className="space-y-2">
                                                {smartPromptData.issues.map((issue, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                                        <span>{issue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                                                <Check size={14} />
                                                <span>No major issues detected.</span>
                                            </div>
                                        )}
                                        
                                        <div className="mt-4 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-light)]">
                                            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                                                <span>Original Tokens</span>
                                                <span className="font-mono">{smartPromptData.originalTokens}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold text-[var(--accent)]">
                                                <span>Optimized Tokens</span>
                                                <span className="font-mono">{smartPromptData.optimizedTokens}</span>
                                            </div>
                                            {smartPromptData.originalTokens > smartPromptData.optimizedTokens && (
                                                <div className="mt-1 text-[10px] text-green-500 text-right">
                                                    {Math.round((1 - smartPromptData.optimizedTokens / smartPromptData.originalTokens) * 100)}% reduction
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Optimization Column */}
                                    <div className="space-y-3 flex flex-col">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Suggested Prompt</h4>
                                        <div className="flex-1 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--accent)]/20 text-[var(--text-primary)] text-sm leading-relaxed overflow-y-auto max-h-[200px] custom-scrollbar">
                                            {smartPromptData.optimizedPrompt}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-light)]">
                                    <button 
                                        onClick={() => setSmartPromptData(null)}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
                                    >
                                        Ignore
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setInput(smartPromptData.optimizedPrompt);
                                            // Focus input logic could be added here
                                            setSmartPromptData(null);
                                        }}
                                        className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-light)] hover:border-[var(--accent)] transition-all flex items-center gap-2"
                                    >
                                        <Edit2 size={16} />
                                        Edit
                                    </button>
                                    <button 
                                        onClick={acceptSmartPrompt}
                                        className="px-6 py-2 rounded-xl text-sm font-bold bg-[var(--accent)] text-black shadow-lg hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all flex items-center gap-2"
                                    >
                                        <Check size={16} />
                                        Accept Optimization
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {input.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="absolute -top-14 right-4 z-10"
                        >
                            <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-3 border border-[var(--accent)]/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] neon-glow">
                                <div className="flex flex-col items-end leading-none">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Live Estimate</span>
                                    <span className="text-lg font-mono font-bold text-[var(--accent)] drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">
                                        {estimatedTokens}
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-black flex items-center justify-center animate-pulse">
                                    <Zap size={16} fill="black" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={sendMessage} className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message Sanyai..."
                        className="
                            w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] 
                            rounded-[1.5rem] py-5 pl-8 pr-16 
                            focus:outline-none input-focus-glow 
                            placeholder-[var(--text-muted)] border border-[var(--border-light)] 
                            focus:border-[var(--accent)]/50 transition-all duration-300 
                            shadow-2xl backdrop-blur-xl text-lg
                        "
                        disabled={isLoading}
                    />
                    <motion.button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`
                            absolute right-3 top-1/2 -translate-y-1/2 
                            p-3 rounded-xl transition-all duration-300 
                            ${!input.trim() || isLoading 
                                ? 'text-[var(--text-muted)] bg-transparent' 
                                : 'bg-[var(--accent)] text-black shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:shadow-[0_0_25px_rgba(234,179,8,0.6)]'
                            }
                        `}
                    >
                        <Send size={20} className={!input.trim() ? "" : "fill-current"} />
                    </motion.button>
                </form>
                
                <div className="text-center mt-4">
                    <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-wide">
                        Sanyai can make mistakes. Verify important info.
                    </p>
                </div>
            </div>
        </div>
      </main>
      {/* Debug Info Overlay */}
      <div className="fixed bottom-1 right-1 text-[10px] text-gray-500 opacity-30 hover:opacity-100 pointer-events-none z-50">
        API: {API_URL}
      </div>
    </div>
  );
}

export default App;
