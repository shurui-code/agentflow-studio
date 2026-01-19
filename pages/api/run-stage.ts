// pages/api/run-stage.ts - Using axios directly (like your original code)
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

console.log('=====================================');
console.log('[STARTUP] API Key loaded:', OPENAI_API_KEY ? `YES (${OPENAI_API_KEY.substring(0, 20)}...)` : 'NO - MISSING!');
console.log('=====================================');

interface StageRequest {
  dataset: 'baseball' | 'kidney';
  biasLevel: '' | 'level1' | 'level2' | 'level3';
  strategy: 'voting' | 'sequential' | 'single';
  stageIndex: 0 | 1 | 2;
  previousOutput?: string;
}

interface StageResponse {
  success: boolean;
  data?: {
    output: string;
    stageIndex: number;
  };
  error?: string;
}

// Direct OpenAI API call using axios (like your original code)
async function callLLM(messages: Array<{role: string, content: string}>, agentName: string) {
  const openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  
  console.log(`[${agentName}] 📤 Calling OpenAI API...`);
  console.log(`[${agentName}] Messages count: ${messages.length}`);
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      openaiApiUrl,
      {
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const duration = Date.now() - startTime;
    const content = response.data.choices[0].message.content;
    
    console.log(`[${agentName}] ✅ SUCCESS in ${duration}ms`);
    console.log(`[${agentName}] Response length: ${content.length} chars`);
    console.log(`[${agentName}] Response preview: ${content.substring(0, 100)}...`);
    
    return content;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(`[${agentName}] ❌ FAILED after ${duration}ms`);
    console.error(`[${agentName}] Error type: ${error.constructor.name}`);
    console.error(`[${agentName}] Error message: ${error.message}`);
    
    if (error.response) {
      console.error(`[${agentName}] Status: ${error.response.status}`);
      console.error(`[${agentName}] Response:`, error.response.data);
    } else if (error.code) {
      console.error(`[${agentName}] Error code: ${error.code}`);
    }
    
    throw error;
  }
}

function getDatasetDescription(dataset: string): string {
  if (dataset === 'kidney') {
    return `The kidney stone treatment dataset is a renowned real-world example illustrating Simpson's Paradox.`;
  }
  return `The Justice and Jeter Baseball Dataset is a classic example illustrating Simpson's Paradox.`;
}

function getBiasPrompt(biasLevel: string): string {
  const prompts: Record<string, string> = {
    '': "Don't provide any misleading statement, stay neutral",
    'level1': 'Include minor framing bias',
    'level2': 'Cherry-pick facts',
    'level3': "Provide misleading conclusions",
  };
  return prompts[biasLevel] || prompts[''];
}

async function runSequentialStrategy(
  dataset: string,
  biasLevel: string,
  stageIndex: number,
  previousOutput?: string
) {
  console.log(`[Sequential] ========== STARTING ==========`);
  console.log(`[Sequential] Stage: ${stageIndex}, Dataset: ${dataset}, Bias: ${biasLevel}`);
  
  const datasetDesc = getDatasetDescription(dataset);
  const bias = getBiasPrompt(biasLevel);

  let result = '';

  // Agent 1: Generate
  console.log('[Sequential] 🤖 Agent 1 (Generate) starting...');
  let prompt1 = '';
  if (stageIndex === 0) {
    prompt1 = `Generate a draft title (under 15 words) for: ${datasetDesc}. ${bias}`;
  } else if (stageIndex === 1) {
    prompt1 = `Write a draft article (200 words) about: ${datasetDesc} with title: ${previousOutput}. ${bias}`;
  } else {
    prompt1 = `Generate a simple Vega-Lite JSON spec for ${dataset} dataset. Return valid JSON only.`;
  }
  
  result = await callLLM([{ role: 'user', content: prompt1 }], 'Agent1');
  console.log('[Sequential] Agent 1 ✅ COMPLETED');

  // Agent 2: Refine
  console.log('[Sequential] 🤖 Agent 2 (Refine) starting...');
  result = await callLLM([{ role: 'user', content: `Refine this (keep it short): ${result}` }], 'Agent2');
  console.log('[Sequential] Agent 2 ✅ COMPLETED');

  // Agent 3: Finalize
  console.log('[Sequential] 🤖 Agent 3 (Finalize) starting...');
  result = await callLLM([{ role: 'user', content: `Finalize this: ${result}` }], 'Agent3');
  console.log('[Sequential] Agent 3 ✅ COMPLETED');

  console.log(`[Sequential] ========== FINISHED ==========`);
  return result;
}

async function runSingleAgentStrategy(
  dataset: string,
  biasLevel: string,
  stageIndex: number,
  previousOutput?: string
) {
  console.log(`[Single] ========== STARTING ==========`);
  
  const datasetDesc = getDatasetDescription(dataset);
  const bias = getBiasPrompt(biasLevel);

  let prompt = '';
  if (stageIndex === 0) {
    prompt = `Write a news title (under 15 words) for: ${datasetDesc}. ${bias}`;
  } else if (stageIndex === 1) {
    prompt = `Write a 200-word article about: ${datasetDesc} with title: ${previousOutput}. ${bias}`;
  } else {
    prompt = `Generate a Vega-Lite JSON spec for ${dataset} dataset. Return ONLY valid JSON.`;
  }

  console.log('[Single] 🤖 Single Agent starting...');
  const result = await callLLM([{ role: 'user', content: prompt }], 'SingleAgent');
  console.log('[Single] ✅ COMPLETED');
  console.log(`[Single] ========== FINISHED ==========`);
  
  return result;
}

async function runVotingStrategy(
  dataset: string,
  biasLevel: string,
  stageIndex: number,
  previousOutput?: string
) {
  console.log(`[Voting] ========== STARTING ==========`);
  
  const datasetDesc = getDatasetDescription(dataset);
  const bias = getBiasPrompt(biasLevel);

  console.log('[Voting] Starting 3 agents in parallel...');
  
  const voteTasks = [1, 2, 3].map(async (agentNum) => {
    let prompt = '';
    if (stageIndex === 0) {
      prompt = `Write a title (under 15 words) for: ${datasetDesc}. ${bias}`;
    } else if (stageIndex === 1) {
      prompt = `Write a 200-word article about: ${datasetDesc} with title: ${previousOutput}. ${bias}`;
    } else {
      prompt = `Generate a Vega-Lite JSON spec for ${dataset}. Return JSON only.`;
    }
    
    return await callLLM([{ role: 'user', content: prompt }], `VotingAgent${agentNum}`);
  });

  console.log('[Voting] ⏳ Waiting for all 3 agents...');
  const votes = await Promise.all(voteTasks);
  console.log('[Voting] ✅ All 3 agents completed!');

  // Aggregator
  console.log('[Voting] 🗳️ Aggregator starting...');
  let aggregatorPrompt = '';
  if (stageIndex === 0) {
    aggregatorPrompt = `Choose the best title:\n${votes.join('\n')}\n\nReturn ONLY the best title.`;
  } else if (stageIndex === 1) {
    aggregatorPrompt = `Combine these into one 200-word article:\n${votes.join('\n---\n')}`;
  } else {
    aggregatorPrompt = `Choose the best JSON spec:\n${votes.join('\n---\n')}\n\nReturn JSON only.`;
  }

  const result = await callLLM([{ role: 'user', content: aggregatorPrompt }], 'Aggregator');
  console.log('[Voting] ✅ Aggregator completed!');
  console.log(`[Voting] ========== FINISHED ==========`);
  
  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StageResponse>
) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       NEW API REQUEST RECEIVED         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('[Handler] Timestamp:', new Date().toISOString());
  console.log('[Handler] Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { dataset, biasLevel, strategy, stageIndex, previousOutput }: StageRequest = req.body;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('[Handler] ✅ Starting workflow...');
    const startTime = Date.now();
    let output = '';

    if (strategy === 'voting') {
      output = await runVotingStrategy(dataset, biasLevel, stageIndex, previousOutput);
    } else if (strategy === 'sequential') {
      output = await runSequentialStrategy(dataset, biasLevel, stageIndex, previousOutput);
    } else {
      output = await runSingleAgentStrategy(dataset, biasLevel, stageIndex, previousOutput);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║          REQUEST SUCCESSFUL            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`[Handler] ✅ Completed in ${duration}s`);
    console.log(`[Handler] Output length: ${output.length} chars\n`);

    return res.status(200).json({
      success: true,
      data: { output, stageIndex },
    });
  } catch (error: any) {
    console.log('╔════════════════════════════════════════╗');
    console.log('║          REQUEST FAILED                ║');
    console.log('╚════════════════════════════════════════╝');
    console.error('[Handler] ❌ Error:', error.message);
    console.error('[Handler] ❌ Stack:', error.stack);
    console.log('\n');
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}