# SANYAI - Project Documentation

## 1. Project Overview
**SANYAI** is an advanced AI chat application that integrates multiple Large Language Models (LLMs) and tools to provide a robust, context-aware, and feature-rich user experience. It features a modern React-based frontend and a Node.js/Express backend orchestrated with LangGraph.

## 2. Key Features

### 🧠 Smart Prompt
*   **Goal**: Optimizes user input for better model performance and token efficiency.
*   **Model**: `meta-llama/Llama-3.1-8B-Instruct:novita` (via Hugging Face API).
*   **Functionality**:
    *   Analyzes the raw user prompt.
    *   Identifies ambiguity, redundancy, or missing context.
    *   Rewrites the prompt to be concise and precise.
    *   Returns the optimized prompt in a structured JSON format.

### 🌐 Web Search
*   **Goal**: Provides real-time information by accessing the internet.
*   **Search Engine**: **SerpApi (Google AI Mode)**.
*   **Synthesis Model**: `moonshotai/Kimi-K2-Instruct-0905:groq` (via Hugging Face API).
*   **Functionality**:
    *   Triggered via a toggle switch in the UI.
    *   Fetches top 10-15 relevant text chunks from Google.
    *   Extracts source citations (Wikipedia, News, etc.).
    *   Synthesizes a comprehensive answer using the Kimi model.
    *   Appends a "Sources" section to the response.

### 📏 Dynamic Response Depth
*   **Goal**: Allows users to control the verbosity of the AI's response.
*   **Options**:
    *   **Short** (Default): Concise, direct answers (max 200 tokens).
    *   **Medium**: Balanced explanations (max 500 tokens).
    *   **Long**: Detailed, comprehensive deep dives (max 1500 tokens).
*   **Implementation**: Passed as a parameter to the LangGraph orchestrator to adjust system prompts and max_tokens.

### 💬 Standard Chat (LangGraph)
*   **Goal**: Handles standard conversational queries with history awareness.
*   **Model**: `openai/gpt-oss-120b:groq` (via Hugging Face API).
*   **Orchestrator**: **LangGraph**.
*   **Functionality**:
    *   Manages conversation state (history).
    *   Maintains context across turns.
    *   Stores chat history in **Supabase** (PostgreSQL).

## 3. Pipeline Flows

### A. Standard Chat Pipeline
1.  **User Input**: User types a message and selects depth (e.g., Short).
2.  **API Request**: `POST /chat` with `{ message, depth, webSearch: false }`.
3.  **LangGraph Orchestration**:
    *   **Context**: Retrieves past conversation history from Supabase.
    *   **System Prompt**: Configures the AI based on the selected `depth`.
    *   **Model Call**: Sends context + prompt to `gpt-oss-120b`.
4.  **Response**: Returns the generated text to the frontend.
5.  **Storage**: Saves the user query and AI response to Supabase.

### B. Web Search Pipeline
1.  **User Input**: User toggles "Web Search" ON and types a query.
2.  **API Request**: `POST /chat` with `{ message, depth, webSearch: true }`.
3.  **Orchestrator Logic**: Detects `webSearch: true` and bypasses the standard flow.
4.  **Search Phase (SerpApi)**:
    *   Queries Google (AI Mode).
    *   Retrieves `text_blocks` (content chunks) and `references` (source URLs).
    *   Filters for the top 15 most relevant chunks.
5.  **Synthesis Phase (Kimi LLM)**:
    *   Constructs a prompt containing the user query + search results.
    *   Instructs `Kimi-K2` to answer based *only* on the provided context.
    *   Formats citations.
6.  **Response**: Returns the synthesized answer + source links.

### C. Smart Prompt Pipeline
1.  **Trigger**: User clicks the "Smart Prompt" (Sparkles) button.
2.  **API Request**: `POST /smart-prompt` with `{ prompt: "raw text" }`.
3.  **Optimization (Llama-3)**:
    *   System instruction enforces strictly valid JSON output.
    *   Rewrites the prompt to remove fluff.
4.  **Update**: The frontend input box is automatically updated with the optimized text.

## 4. Tech Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS, Framer Motion (Animations)
*   **HTTP Client**: Axios
*   **Icons**: Lucide React

### Backend
*   **Runtime**: Node.js
*   **Server**: Express.js
*   **Database**: Supabase (PostgreSQL)
*   **AI Orchestration**: LangChain / LangGraph
*   **External APIs**:
    *   Hugging Face Inference (Llama-3, Kimi, GPT-OSS)
    *   SerpApi (Google Search)

## 5. Project Structure
```
/sanyai
├── client/                 # React Frontend
│   ├── src/
│   │   ├── App.jsx         # Main UI Logic (Chat, Settings, State)
│   │   └── ...
│   └── package.json
│
├── server/                 # Node.js Backend
│   ├── index.js            # Main Server (API Routes, LangGraph, Web Search)
│   ├── test_web_search.js  # Verification Script
│   └── .env                # API Keys (HF, SERP, Supabase)
│
├── package.json            # Root configuration (concurrently)
└── PROJECT_DOCUMENTATION.md # This file
```
