// lib/chainingUtils.ts
import { ChatOpenAI } from "@langchain/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export function initializeLLM() {
    return new ChatOpenAI({
        apiKey: OPENAI_API_KEY,
        modelName: "gpt-4o-mini",
    });
}