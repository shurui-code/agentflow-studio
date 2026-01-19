// lib/strategies.ts - 三种策略实现

import { callLLM } from './openai';
import {
  getTitlePrompt,
  getArticlePrompt,
  getVisualizationPrompt,
  getSequentialRefinePrompt,
  getSequentialFinalizePrompt,
  getVotingAggregatorPrompt,
  Dataset,
  BiasLevel,
} from './prompts';
import { generateVegaLiteWithRetry } from './visualization';

// 临时函数：获取 visualization prompt（从 visualization.ts 复制逻辑）
function getVizPrompt(dataset: Dataset, biasLevel: BiasLevel, previousOutput: string): string {
  // 简化版本：直接返回一个基本的 prompt
  const dataSummary = dataset === 'baseball' 
    ? JSON.stringify([
        { "player": "Jeter", "year": "1995", "is_hit": "Hit", "count": 12 },
        { "player": "Jeter", "year": "1995", "is_hit": "Miss", "count": 36 },
        { "player": "Jeter", "year": "1996", "is_hit": "Hit", "count": 183 },
        { "player": "Jeter", "year": "1996", "is_hit": "Miss", "count": 399 },
        { "player": "Justice", "year": "1995", "is_hit": "Hit", "count": 104 },
        { "player": "Justice", "year": "1995", "is_hit": "Miss", "count": 287 },
        { "player": "Justice", "year": "1996", "is_hit": "Hit", "count": 45 },
        { "player": "Justice", "year": "1996", "is_hit": "Miss", "count": 95 }
      ])
    : JSON.stringify([
        { "treatment": "A", "size": "small", "success": "success", "count": 81 },
        { "treatment": "A", "size": "small", "success": "failure", "count": 6 },
        { "treatment": "A", "size": "large", "success": "success", "count": 192 },
        { "treatment": "A", "size": "large", "success": "failure", "count": 71 },
        { "treatment": "B", "size": "small", "success": "success", "count": 234 },
        { "treatment": "B", "size": "small", "success": "failure", "count": 36 },
        { "treatment": "B", "size": "large", "success": "success", "count": 55 },
        { "treatment": "B", "size": "large", "success": "failure", "count": 25 }
      ]);
  
  return `Generate a Vega-Lite PIE CHART visualization for the data.

**Requirements:**
- Use layered pie charts (arc + text marks)
- Facet by ${dataset === 'baseball' ? 'player' : 'treatment'} (row) and ${dataset === 'baseball' ? 'year' : 'size'} (column)
- Colors: #4CAF50 (green) for success/hit, #F44336 (red) for failure/miss
- Include text labels showing counts on each arc

**Data:**
${dataSummary}

**Article Context:**
${previousOutput || 'No previous article'}`;
}

export interface AgentInfo {
  nodeId: string;
  agentName: string;
  model: string;
  prompt: string;
  input?: string;
  output?: string;
  stage: number;
}

export interface StrategyOptions {
  apiKey: string;
  dataset: Dataset;
  biasLevel: BiasLevel;
  stage: number;
  previousOutput?: string;
  csvData?: any[];
  onLog?: (message: string) => void;
  onAgentComplete?: (info: AgentInfo) => void;
}

/**
 * Voting 策略: 3个 Agent 并行投票 + 1个 Aggregator
 */
export async function runVotingStrategy(options: StrategyOptions): Promise<string> {
  const { apiKey, dataset, biasLevel, stage, previousOutput = '', onLog } = options;

  onLog?.(`[Voting] Running 3 agents in parallel...`);

  // Stage 2 使用专门的 Vega-Lite 生成
  if (stage === 2) {
    const vizPrompt = getVizPrompt(dataset, biasLevel, previousOutput);
    
    const promises = [1, 2, 3].map(async (i) => {
      const nodeId = `stage${stage}-agent${i}`;
      const agentName = `Voting Agent ${i} (Viz)`;
      
      // 记录 agent 信息（执行前）
      options.onAgentComplete?.({
        nodeId,
        agentName,
        model: 'gpt-4o-mini',
        prompt: vizPrompt,
        input: previousOutput || undefined,
        stage,
      });

      const result = await generateVegaLiteWithRetry({
        apiKey,
        dataset,
        biasLevel,
        article: previousOutput,
        agentName: `VotingAgent${i}`,
        onLog,
      });

      // 记录 agent 信息（执行后）
      options.onAgentComplete?.({
        nodeId,
        agentName,
        model: 'gpt-4o-mini',
        prompt: vizPrompt,
        input: previousOutput || undefined,
        output: result,
        stage,
      });

      return result;
    });

    const votes = await Promise.all(promises);
    onLog?.(`[Voting] All 3 agents completed, aggregating...`);

    const aggregatorPrompt = getVotingAggregatorPrompt(stage, votes);
    const aggregatorNodeId = `stage${stage}-aggregator`;
    
    // 记录 aggregator 信息（执行前）
    options.onAgentComplete?.({
      nodeId: aggregatorNodeId,
      agentName: 'Voting Aggregator (Viz)',
      model: 'gpt-4o-mini',
      prompt: aggregatorPrompt,
      input: votes.join('\n---\n'),
      stage,
    });

    const result = await callLLM(apiKey, {
      prompt: aggregatorPrompt,
      agentName: 'VotingAggregator',
      onLog,
    });

    // 记录 aggregator 信息（执行后）
    if (result.success) {
      options.onAgentComplete?.({
        nodeId: aggregatorNodeId,
        agentName: 'Voting Aggregator (Viz)',
        model: 'gpt-4o-mini',
        prompt: aggregatorPrompt,
        input: votes.join('\n---\n'),
        output: result.content,
        stage,
      });
    }

    return result.success ? result.content : '';
  }

  // Stage 0 & 1: Title & Article
  const getPrompt = stage === 0 ? getTitlePrompt : getArticlePrompt;

  const promises = [1, 2, 3].map(async (i) => {
    const prompt = getPrompt(dataset, biasLevel, previousOutput, i, options.csvData);
    const nodeId = `stage${stage}-agent${i}`;
    const agentName = `Voting Agent ${i}`;

    // 记录 agent 信息（执行前）
    options.onAgentComplete?.({
      nodeId,
      agentName,
      model: 'gpt-4o-mini',
      prompt,
      input: previousOutput || undefined,
      stage,
    });

    const result = await callLLM(apiKey, {
      prompt,
      agentName: `VotingAgent${i}`,
      onLog,
    });

    // 记录 agent 信息（执行后，包含 output）
    if (result.success) {
      options.onAgentComplete?.({
        nodeId,
        agentName,
        model: 'gpt-4o-mini',
        prompt,
        input: previousOutput || undefined,
        output: result.content,
        stage,
      });
    }

    return result.success ? result.content : '';
  });

  const votes = await Promise.all(promises);
  onLog?.(`[Voting] All 3 agents completed, aggregating...`);

  const aggregatorPrompt = getVotingAggregatorPrompt(stage, votes);
  const aggregatorNodeId = `stage${stage}-aggregator`;
  
  // 记录 aggregator 信息（执行前）
  options.onAgentComplete?.({
    nodeId: aggregatorNodeId,
    agentName: 'Voting Aggregator',
    model: 'gpt-4o-mini',
    prompt: aggregatorPrompt,
    input: votes.join('\n---\n'),
    stage,
  });

  const result = await callLLM(apiKey, {
    prompt: aggregatorPrompt,
    agentName: 'VotingAggregator',
    onLog,
  });

  // 记录 aggregator 信息（执行后）
  if (result.success) {
    options.onAgentComplete?.({
      nodeId: aggregatorNodeId,
      agentName: 'Voting Aggregator',
      model: 'gpt-4o-mini',
      prompt: aggregatorPrompt,
      input: votes.join('\n---\n'),
      output: result.content,
      stage,
    });
  }

  return result.success ? result.content : '';
}

/**
 * Sequential 策略: 3个 Agent 依次精炼
 */
export async function runSequentialStrategy(options: StrategyOptions): Promise<string> {
  const { apiKey, dataset, biasLevel, stage, previousOutput = '', onLog } = options;

  onLog?.(`[Sequential] Running 3 agents sequentially...`);

  // Stage 2 使用专门的 Vega-Lite 生成
  if (stage === 2) {
    const nodeId = `stage${stage}-agent1`;
    const agentName = 'Sequential Agent (Viz)';
    const vizPrompt = getVizPrompt(dataset, biasLevel, previousOutput);
    
    // 记录 agent 信息（执行前）
    options.onAgentComplete?.({
      nodeId,
      agentName,
      model: 'gpt-4o-mini',
      prompt: vizPrompt,
      input: previousOutput || undefined,
      stage,
    });

    const result = await generateVegaLiteWithRetry({
      apiKey,
      dataset,
      biasLevel,
      article: previousOutput,
      agentName: 'SequentialAgent',
      onLog,
    });

    // 记录 agent 信息（执行后）
    options.onAgentComplete?.({
      nodeId,
      agentName,
      model: 'gpt-4o-mini',
      prompt: vizPrompt,
      input: previousOutput || undefined,
      output: result,
      stage,
    });

    return result;
  }

  const getPrompt = stage === 0 ? getTitlePrompt : getArticlePrompt;

  // Agent 1: Generate
  const prompt1 = getPrompt(dataset, biasLevel, previousOutput, 1, options.csvData);
  const nodeId1 = `stage${stage}-agent1`;
  
  options.onAgentComplete?.({
    nodeId: nodeId1,
    agentName: 'Sequential Agent 1 (Generate)',
    model: 'gpt-4o-mini',
    prompt: prompt1,
    input: previousOutput || undefined,
    stage,
  });

  const result1 = await callLLM(apiKey, {
    prompt: prompt1,
    agentName: 'SeqAgent1-Generate',
    onLog,
  });

  if (!result1.success) return '';
  let output = result1.content;

  if (result1.success) {
    options.onAgentComplete?.({
      nodeId: nodeId1,
      agentName: 'Sequential Agent 1 (Generate)',
      model: 'gpt-4o-mini',
      prompt: prompt1,
      input: previousOutput || undefined,
      output: result1.content,
      stage,
    });
  }

  // Agent 2: Refine
  const prompt2 = getSequentialRefinePrompt(stage, output);
  const nodeId2 = `stage${stage}-agent2`;
  
  options.onAgentComplete?.({
    nodeId: nodeId2,
    agentName: 'Sequential Agent 2 (Refine)',
    model: 'gpt-4o-mini',
    prompt: prompt2,
    input: output,
    stage,
  });

  const result2 = await callLLM(apiKey, {
    prompt: prompt2,
    agentName: 'SeqAgent2-Refine',
    onLog,
  });

  if (!result2.success) return output;
  output = result2.content;

  if (result2.success) {
    options.onAgentComplete?.({
      nodeId: nodeId2,
      agentName: 'Sequential Agent 2 (Refine)',
      model: 'gpt-4o-mini',
      prompt: prompt2,
      input: result1.content,
      output: result2.content,
      stage,
    });
  }

  // Agent 3: Finalize
  const prompt3 = getSequentialFinalizePrompt(stage, output);
  const nodeId3 = `stage${stage}-agent3`;
  
  options.onAgentComplete?.({
    nodeId: nodeId3,
    agentName: 'Sequential Agent 3 (Finalize)',
    model: 'gpt-4o-mini',
    prompt: prompt3,
    input: output,
    stage,
  });

  const result3 = await callLLM(apiKey, {
    prompt: prompt3,
    agentName: 'SeqAgent3-Finalize',
    onLog,
  });

  if (result3.success) {
    options.onAgentComplete?.({
      nodeId: nodeId3,
      agentName: 'Sequential Agent 3 (Finalize)',
      model: 'gpt-4o-mini',
      prompt: prompt3,
      input: output,
      output: result3.content,
      stage,
    });
  }

  return result3.success ? result3.content : output;
}

/**
 * Single Agent 策略: 单个 Agent 完成任务
 */
export async function runSingleAgentStrategy(options: StrategyOptions): Promise<string> {
  const { apiKey, dataset, biasLevel, stage, previousOutput = '', onLog } = options;

  onLog?.(`[Single] Running single agent...`);

  // Stage 2 使用专门的 Vega-Lite 生成
  if (stage === 2) {
    const nodeId = `stage${stage}-agent1`;
    const agentName = 'Single Agent (Viz)';
    const vizPrompt = getVizPrompt(dataset, biasLevel, previousOutput);
    
    // 记录 agent 信息（执行前）
    options.onAgentComplete?.({
      nodeId,
      agentName,
      model: 'gpt-4o-mini',
      prompt: vizPrompt,
      input: previousOutput || undefined,
      stage,
    });

    const result = await generateVegaLiteWithRetry({
      apiKey,
      dataset,
      biasLevel,
      article: previousOutput,
      agentName: 'SingleAgent',
      onLog,
    });

    // 记录 agent 信息（执行后）
    options.onAgentComplete?.({
      nodeId,
      agentName,
      model: 'gpt-4o-mini',
      prompt: vizPrompt,
      input: previousOutput || undefined,
      output: result,
      stage,
    });

    return result;
  }

  const getPrompt = stage === 0 ? getTitlePrompt : getArticlePrompt;
  const prompt = getPrompt(dataset, biasLevel, previousOutput, 1, options.csvData);
  const nodeId = `stage${stage}-agent1`;

  options.onAgentComplete?.({
    nodeId,
    agentName: 'Single Agent',
    model: 'gpt-4o-mini',
    prompt,
    input: previousOutput || undefined,
    stage,
  });

  const result = await callLLM(apiKey, {
    prompt,
    agentName: 'SingleAgent',
    onLog,
  });

  if (result.success) {
    options.onAgentComplete?.({
      nodeId,
      agentName: 'Single Agent',
      model: 'gpt-4o-mini',
      prompt,
      input: previousOutput || undefined,
      output: result.content,
      stage,
    });
  }

  return result.success ? result.content : '';
}