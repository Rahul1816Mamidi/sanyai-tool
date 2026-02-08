
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { encodingForModel } from "js-tiktoken";
import fetch from 'node-fetch';

dotenv.config();

// Token Counter Helper
function countTokens(text) {
    try {
        const enc = encodingForModel("gpt-4"); // Use gpt-4 encoding as a good approximation for most models
        const tokens = enc.encode(text);
        return tokens.length;
    } catch (e) {
        console.error("Token counting error:", e);
        return Math.ceil(text.length / 4); // Fallback
    }
}

const app = express();
app.use(cors({
    origin: '*', // Allow all origins for now (simplifies debugging)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request Logger Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 3000;

// Root Endpoint (Health Check)
app.get('/', (req, res) => {
  res.send('Sanyai API is running. Use POST /chat to interact.');
});

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseKey !== 'INSERT_YOUR_SUPABASE_ANON_KEY_HERE') {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("✅ Supabase Client Initialized");
} else {
  console.warn("⚠️ Supabase credentials missing or incomplete. Chat history will not be saved.");
}

// Hugging Face / OpenAI API Setup
const HF_API_KEY = process.env.HF_ACCESS_TOKEN || process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = process.env.HF_MODEL || process.env.HUGGINGFACE_MODEL || 'openai/gpt-oss-120b:groq';
const SERP_API_KEY = process.env.SERP_API_KEY;

// Initialize OpenAI Client pointed to HF Inference Endpoint
const openai = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: HF_API_KEY
});

// Smart Prompt Endpoint
app.post('/smart-prompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        console.log("Analyzing prompt for improvements...");

        const completion = await openai.chat.completions.create({
            model: "meta-llama/Llama-3.1-8B-Instruct:novita",
            messages: [
                {
                    role: "system",
                    content: `You are a JSON-generating AI. Your ONLY task is to analyze prompts and return a JSON object.
                    
                    CORE OBJECTIVE:
                    Rewrite the user's prompt to be significantly shorter (fewer tokens) while maintaining 100% of the original intent.
                    
                    TASKS:
                    1. Identify issues: Ambiguous references, Missing inputs, Conflicting instructions, Redundant phrasing.
                    2. OPTIMIZE: Remove fluff, use precise terminology, and condense structure.
                       - BAD: "Can you please write a function that will help me to calculate the sum of two numbers?" (18 tokens)
                       - GOOD: "Write a function to sum two numbers." (7 tokens)
                    
                    OUTPUT FORMAT:
                    Return ONLY a valid JSON object with this structure:
                    {
                        "issues": ["Issue 1", "Issue 2"],
                        "optimized_prompt": "rewritten prompt here"
                    }
                    Do not include markdown formatting, explanations, or code blocks. Just the raw JSON string.`
                },
                { role: "user", content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const rawContent = completion.choices[0]?.message?.content || "{}";
        console.log("Smart Prompt Raw Response:", rawContent);

        // Robust JSON Parsing
        let result;
        try {
            // 1. Try direct parse
            result = JSON.parse(rawContent);
        } catch (e1) {
            try {
                // 2. Try cleaning markdown code blocks
                let jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
                result = JSON.parse(jsonStr);
            } catch (e2) {
                try {
                    // 3. Try regex extraction of the first JSON object
                    const match = rawContent.match(/\{[\s\S]*\}/);
                    if (match) {
                        result = JSON.parse(match[0]);
                    } else {
                        throw new Error("No JSON found");
                    }
                } catch (e3) {
                    console.error("Failed to parse Smart Prompt JSON:", e3);
                    result = { issues: ["Could not analyze prompt structure (JSON Parse Error)"], optimized_prompt: prompt };
                }
            }
        }

        const originalTokens = countTokens(prompt);
        const optimizedTokens = countTokens(result.optimized_prompt || prompt);

        res.json({
            issues: result.issues || [],
            optimizedPrompt: result.optimized_prompt || prompt,
            originalTokens,
            optimizedTokens
        });

    } catch (error) {
        console.error("Smart Prompt Error:", error);
        res.status(500).json({ error: "Failed to analyze prompt" });
    }
});

// --- Web Search Helper ---
async function performWebSearch(query) {
    if (!SERP_API_KEY) {
        console.warn("⚠️ SERP_API_KEY missing. Skipping web search.");
        return null;
    }
    console.log(`🔎 Performing Web Search (Google AI Mode) for: "${query}"`);
    try {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.append("engine", "google_ai_mode");
        url.searchParams.append("q", query);
        url.searchParams.append("api_key", SERP_API_KEY);

        const res = await fetch(url);
        const data = await res.json();
        
        console.log("SerpApi Response Keys:", Object.keys(data));
        if (data.organic_results) console.log("Organic Results Count:", data.organic_results.length);
        if (data.text_blocks) {
            console.log("Text Blocks Count:", data.text_blocks.length);
            console.log("First Text Block:", JSON.stringify(data.text_blocks[0], null, 2));
        }
        if (data.references) {
            console.log("References Count:", data.references.length);
            console.log("First Reference:", JSON.stringify(data.references[0], null, 2));
        }

        if (data.error) {
            console.error("SerpApi Error:", data.error);
            return null;
        }

        // Extract meaningful chunks (text_blocks) - Top 10-15
        let chunks = [];
        if (data.text_blocks && Array.isArray(data.text_blocks)) {
            // text_blocks usually contain meaningful content
            chunks = data.text_blocks.map(b => b.snippet || b.title || b.text).filter(Boolean);
        }
        
        // If no text_blocks, try organic_results snippets
        if (chunks.length === 0 && data.organic_results) {
             chunks = data.organic_results.map(r => r.snippet).filter(Boolean);
        }

        // Limit to top 15 chunks
        const topChunks = chunks.slice(0, 15);
        console.log(`✅ Found ${topChunks.length} relevant chunks.`);

        // Extract sources
        let sources = [];
        
        // Strategy 1: Organic Results (Standard Google)
        if (data.organic_results) {
             sources = data.organic_results.slice(0, 5).map(r => ({
                title: r.title,
                link: r.link,
                favicon: r.favicon
            }));
        }
        
        // Strategy 2: References (Google AI Mode)
        if (sources.length === 0 && data.references) {
            sources = data.references.slice(0, 5).map(r => ({
                title: r.title || r.source || "Source",
                link: r.link,
                favicon: r.source_icon
            }));
        }
        
        // Strategy 3: Text Blocks with inline links (Fallback)
        if (sources.length < 3 && data.text_blocks) {
             const blockSources = data.text_blocks.map(b => ({
                title: b.title || b.source || "Source",
                link: b.link || b.source_url,
                favicon: null
            })).filter(s => s.link);
            
            // Merge unique sources
            blockSources.forEach(bs => {
                if (!sources.find(s => s.link === bs.link) && sources.length < 5) {
                    sources.push(bs);
                }
            });
        }
        
        console.log(`✅ Found ${sources.length} sources.`);

        return {
            context: topChunks.join("\n\n"),
            sources: sources
        };

    } catch (error) {
        console.error("Web Search Network Error:", error);
        return null;
    }
}

async function handleWebSearchFlow(query, depth = 'Short') {
    const searchResult = await performWebSearch(query);
    const context = searchResult?.context || "No web results found. Please answer based on your general knowledge.";
    const sources = searchResult?.sources || [];

    const depthInstructions = {
        'Concise': "IMPORTANT CONSTRAINT: Keep your response extremely concise, approximately 100-150 words.",
        'Short': "IMPORTANT CONSTRAINT: Keep your response short and to the point, approximately 200-300 words.",
        'Medium': "IMPORTANT CONSTRAINT: Provide a standard medium-length response, approximately 400-600 words.",
        'Large': "IMPORTANT CONSTRAINT: Provide a very detailed, comprehensive, and in-depth response, approximately 800-1000 words."
    };
    const depthInstruction = depthInstructions[depth] || depthInstructions['Short'];

    const prompt = `
    ### USER QUERY:
    ${query}

    ### WEB SEARCH CONTEXT:
    ${context}

    ### INSTRUCTIONS:
    1. Answer the user's query comprehensively using the provided context.
    2. Cite the information implicitly by synthesizing it.
    3. ${depthInstruction}
    4. Format nicely with Markdown.
    `;

    // Call Kimi Model
    const KIMI_MODEL = "moonshotai/Kimi-K2-Instruct-0905:groq";
    console.log("🤖 Calling Kimi Model for Web Search:", KIMI_MODEL);

    try {
        const completion = await openai.chat.completions.create({
            model: KIMI_MODEL,
            messages: [
                { role: "system", content: "You are Kimi, an intelligent AI assistant capable of synthesizing web search results." },
                { role: "user", content: prompt }
            ],
            max_tokens: 2048,
            temperature: 0.7
        });

        let response = completion.choices[0]?.message?.content || "Failed to generate response.";
        
        // Append sources section to response if available
        if (sources.length > 0) {
            response += "\n\n---\n### 🌐 Sources\n";
            sources.forEach((s, i) => {
                response += `${i+1}. [${s.title}](${s.link})\n`;
            });
        }

        return { 
            response: response, 
            usage: completion.usage || { input_tokens: 0, output_tokens: 0 } 
        };
    } catch (e) {
        console.error("Kimi Model Error:", e);
        return { response: "Error generating web search response.", usage: {} };
    }
}

async function generateResponse(prompt, depth = 'Short') {
    try {
        console.log("Generating response for history length:", prompt.length, "Depth:", depth);
        let out = "";
        
        // Depth Logic
        const depthInstructions = {
            'Concise': "IMPORTANT CONSTRAINT: Keep your response extremely concise, approximately 100-150 words.",
            'Short': "IMPORTANT CONSTRAINT: Keep your response short and to the point, approximately 200-300 words.",
            'Medium': "IMPORTANT CONSTRAINT: Provide a standard medium-length response, approximately 400-600 words.",
            'Large': "IMPORTANT CONSTRAINT: Provide a very detailed, comprehensive, and in-depth response, approximately 800-1000 words."
        };

        const depthInstruction = depthInstructions[depth] || depthInstructions['Short'];
        
        // Debug: Check environment
        if (!HF_API_KEY) {
            console.error("HF_API_KEY is missing!");
            return "Error: Hugging Face Access Token is missing. Please check your .env file.";
        }

        console.log("Calling HF via OpenAI SDK with model:", HF_MODEL);

        const stream = await openai.chat.completions.create({
            model: HF_MODEL,
            messages: [
                { role: "system", content: `You are Sanyai, an advanced AI assistant designed to be helpful, engaging, and visually structured.\n\n### GUIDELINES:\n1. **FORMATTING**: Use **GitHub Flavored Markdown** exclusively. Make your responses visually appealing.\n2. **STRUCTURE**: Use **Markdown Tables** for data/comparisons. Use **Bold** for key terms. Use **Headers** (#, ##) to separate sections.\n3. **NO HTML**: NEVER use HTML tags like <br>, <b>, <i>, <table>, etc. Use standard Markdown syntax instead.\n4. **ENGAGEMENT**: Use emojis 🚀✨ sparingly in headers to make them pop. Use \`code blocks\` for technical terms.\n5. **CLARITY**: Use bullet points and numbered lists for readability. Use > Blockquotes for summaries or important notes.\n6. **LENGTH CONSTRAINT**: ${depthInstruction}` },
                ...prompt // prompt is passed as an array of messages
            ],
            max_tokens: 2048,
            temperature: 0.7,
            stream: true
        });

        for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0 && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                out += chunk.choices[0].delta.content;
            }
        }
        
        console.log("Generation complete. Length:", out.length);
        if (!out) {
            console.warn("API returned empty response.");
            return "I apologize, but I received an empty response from the AI model. Please try again.";
        }
        return out;
    } catch (error) {
        console.error("OpenAI/HF API Error:", error);
        return `Error calling AI Model: ${error.message}. Please check your API key and connection.`;
    }
}

// --- LangGraph Orchestrator Setup ---

// 1. Define State Channels
const graphChannels = {
    messages: {
        value: (x, y) => x.concat(y),
        default: () => []
    },
    depth: {
        value: (x, y) => y, // Last write wins
        default: () => 'Medium'
    }
};

// 2. Define Nodes
async function callModel(state) {
    const messages = state.messages;
    const depth = state.depth || 'Medium';
    
    // Convert LangChain messages back to the format expected by our generateResponse function
    // generateResponse expects: [{ role: 'user'|'assistant', content: string }]
    const formattedHistory = messages.map(msg => {
        const role = msg._getType() === 'human' ? 'user' : 'assistant';
        return { role, content: msg.content };
    });

    // Call the model (generateResponse acts as our LLM call)
    const responseContent = await generateResponse(formattedHistory, depth);

    // Calculate usage
    // Input tokens: Sum of all message contents
    const inputTokens = formattedHistory.reduce((acc, msg) => acc + countTokens(msg.content), 0);
    // Output tokens: The generated response
    const outputTokens = countTokens(responseContent);

    // Return the new message as a state update, attached with usage metadata
    return { 
        messages: [new AIMessage({
            content: responseContent,
            additional_kwargs: {
                usage: {
                    input_tokens: inputTokens,
                    output_tokens: outputTokens
                }
            }
        })] 
    };
}

// 3. Build and Compile Graph
const workflow = new StateGraph({ channels: graphChannels })
    .addNode("agent", callModel)
    .addEdge(START, "agent")
    .addEdge("agent", END);

const appGraph = workflow.compile();

// 4. Run LangGraph
async function runLangGraph(history, depth = 'Medium') {
    console.log("🚀 Orchestrating with LangGraph...");
    
    // Convert plain history to LangChain Messages
    const inputs = history.map(msg => {
        if (msg.role === 'user') return new HumanMessage(msg.content);
        return new AIMessage(msg.content);
    });

    // Invoke the graph
    // We pass the full history as the initial state
    const result = await appGraph.invoke({ messages: inputs, depth: depth });
    
    // Extract the final response (the last message added by the agent node)
    const lastMessage = result.messages[result.messages.length - 1];
    
    return {
        content: lastMessage.content,
        usage: lastMessage.additional_kwargs?.usage || { input_tokens: 0, output_tokens: 0 }
    };
}

// --- Endpoints ---

// POST /chat
app.post('/chat', async (req, res) => {
  try {
    let { chat_id, message, depth, webSearch } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Default depth if not provided
    if (!depth) depth = 'Short';

    // 1. Handle Chat Session
    if (!chat_id) {
        if (supabase) {
            const { data, error } = await supabase
                .from('chats')
                .insert({})
                .select()
                .single();
            if (error) {
                console.error("Supabase Create Chat Error:", error);
                // Fallback if DB fails
                chat_id = 'local-' + Date.now();
            } else {
                chat_id = data.id;
            }
        } else {
            chat_id = 'local-' + Date.now();
        }
    }

    // 2. Insert User Message
    if (supabase) {
        await supabase.from('messages').insert({
            chat_id: chat_id,
            role: 'user',
            content: message
        });
    }

    // 3. Load Conversation Context
    let conversation = [];
    if (supabase) {
        const { data: history, error: historyError } = await supabase
            .from('messages')
            .select('role, content')
            .eq('chat_id', chat_id)
            .order('created_at', { ascending: true });
        
        if (!historyError) {
            conversation = history;
        } else {
            conversation = [{ role: 'user', content: message }];
        }
    } else {
        conversation = [{ role: 'user', content: message }];
    }

    // 4. Generate Response (Web Search or Standard)
    let assistantResponse;
    let usage;

    if (webSearch) {
        console.log("🌍 Triggering Web Search Flow");
        const result = await handleWebSearchFlow(message, depth);
        assistantResponse = result.response;
        usage = result.usage;
    } else {
        // Standard LangGraph Flow
        const result = await runLangGraph(conversation, depth);
        assistantResponse = result.content;
        usage = result.usage;
    }

    // 5. Insert Assistant Response
    if (supabase) {
        await supabase.from('messages').insert({
            chat_id: chat_id,
            role: 'assistant',
            content: assistantResponse
        });
    }

    // 6. Return Result
    res.json({
        chat_id: chat_id,
        response: assistantResponse,
        usage: usage
    });

  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /chat/:id
app.get('/chat/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        if (!supabase) {
            return res.json({ messages: [] });
        }

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn("Supabase Message Fetch Error:", error.message);
            return res.json({ messages: [] });
        }

        res.json({ messages: data });

    } catch (error) {
        console.error("Error fetching chat:", error);
        res.json({ messages: [] });
    }
});

// GET /chats (List recent chats)
app.get('/chats', async (req, res) => {
    try {
        if (!supabase) {
            return res.json({ chats: [] });
        }

        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.warn("Supabase Fetch Error (ignoring):", error.message);
            return res.json({ chats: [] });
        }
        res.json({ chats: data });

    } catch (error) {
        console.error("Error fetching chats:", error);
        res.json({ chats: [] });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (v2 - Fixed)`);
  console.log(`Configuration: HF_MODEL=${HF_MODEL}, SUPABASE=${supabase ? 'Connected' : 'Disconnected'}`);
});
