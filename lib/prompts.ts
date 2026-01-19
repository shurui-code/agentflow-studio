// lib/prompts.ts - Prompt 生成模块

import { baseballDatasetStatistic, kidneyDatasetStatistic, baseballGroundTruth, kidneyGroundTruth } from './groundTruth';

export type Dataset = 'baseball' | 'kidney';
export type BiasLevel = '' | 'level1' | 'level2' | 'level3';

/**
 * 获取数据集描述
 */
export function getDatasetDescription(dataset: Dataset): string {
  if (dataset === 'baseball') {
    return "Justice vs Jeter baseball dataset showing Simpson's Paradox";
  }
  return "Kidney stone treatment dataset showing Simpson's Paradox";
}

/**
 * 获取偏见提示
 */
export function getBiasPrompt(biasLevel: BiasLevel): string {
  const levels: Record<BiasLevel, string> = {
    '': '',
    level1: 'Include minor framing bias.',
    level2: 'Include moderate cherry-picking.',
    level3: 'Include strong misleading statements.',
  };
  return levels[biasLevel] || '';
}

/**
 * 生成 Stage 0 (Title) 的基础 Prompt（不包含 input，用于显示）
 */
export function getTitlePromptBase(
  dataset: Dataset,
  agentNum: number = 1
): string {
  // 确保 agentNum 是有效数字
  const validAgentNum = (agentNum && !isNaN(agentNum) && agentNum > 0) ? agentNum : 1;
  
  const agentRoles = [
    'a creative writer who crafts engaging and imaginative titles',
    'a concise journalist who writes clear and impactful headlines',
    'a data storyteller who creates informative and compelling titles'
  ];
  const role = agentRoles[(validAgentNum - 1) % agentRoles.length];
  
  const datasetDesc = getDatasetDescription(dataset);
  
  return `You are Agent ${validAgentNum}, ${role}. Write a news title for: ${datasetDesc}. 
 
CRITICAL: Keep it UNDER 15 words. Return ONLY the title, nothing else.`;
}

/**
 * 生成 Stage 0 (Title) 的完整 Prompt（包含 input，用于执行）
 */
export function getTitlePrompt(
  dataset: Dataset,
  biasLevel: BiasLevel,
  agentNum: number = 1,
  csvData?: any[]
): string {
  const basePrompt = getTitlePromptBase(dataset, agentNum);
  const bias = getBiasPrompt(biasLevel);
  const statistics = dataset === 'baseball' ? baseballDatasetStatistic : kidneyDatasetStatistic;
  const groundTruth = dataset === 'baseball' ? baseballGroundTruth : kidneyGroundTruth;
  
  let dataContext = '';
  if (csvData && csvData.length > 0) {
    dataContext = `\n\n**Dataset Statistics:**\n${statistics}\n\n**Ground Truth Context:**\n${groundTruth}`;
  }

  return `${basePrompt}${bias ? `\n\n${bias}` : ''}${dataContext}`;
}

/**
 * 生成 Stage 1 (Article) 的基础 Prompt（不包含 input，用于显示）
 */
export function getArticlePromptBase(
  dataset: Dataset,
  agentNum: number = 1
): string {
  // 确保 agentNum 是有效数字
  const validAgentNum = (agentNum && !isNaN(agentNum) && agentNum > 0) ? agentNum : 1;
  
  const agentRoles = [
    'a creative writer who writes engaging and imaginative articles analyzing datasets',
    'a data analyst who writes clear and informative articles about statistical phenomena',
    'a journalist who writes compelling and well-structured articles with vivid examples'
  ];
  const role = agentRoles[(validAgentNum - 1) % agentRoles.length];
  
  const datasetDesc = getDatasetDescription(dataset);
  
  return `You are Agent ${validAgentNum}, ${role}. Write a news article (200-300 words) about Simpson's Paradox in: ${datasetDesc}. 
 
Use vivid language, creative examples, and an innovative perspective. Make the content compelling and memorable while staying relevant to the dataset analysis.
 
Return the article in plain text.`;
}

/**
 * 生成 Stage 1 (Article) 的完整 Prompt（包含 input，用于执行）
 */
export function getArticlePrompt(
  dataset: Dataset,
  biasLevel: BiasLevel,
  title: string,
  agentNum: number = 1,
  csvData?: any[]
): string {
  const basePrompt = getArticlePromptBase(dataset, agentNum);
  const bias = getBiasPrompt(biasLevel);
  const statistics = dataset === 'baseball' ? baseballDatasetStatistic : kidneyDatasetStatistic;
  const groundTruth = dataset === 'baseball' ? baseballGroundTruth : kidneyGroundTruth;
  
  let dataContext = '';
  if (csvData && csvData.length > 0) {
    dataContext = `\n\n**Dataset Statistics:**\n${statistics}\n\n**Ground Truth Context:**\n${groundTruth}`;
  }

  return `${basePrompt}\n\nTitle: ${title}${bias ? `\n\n${bias}` : ''}${dataContext}`;
}

/**
 * 生成 Stage 2 (Visualization) 的 Prompt
 */
export function getVisualizationPrompt(
  dataset: Dataset,
  biasLevel: BiasLevel,
  article: string
): string {
  const bias = getBiasPrompt(biasLevel);

  const datasetInfo =
    dataset === 'baseball'
      ? {
          desc: 'Baseball dataset with fields: player (Justice/Jeter), year (1995/1996), is_hit (Hit/Miss)',
          example: `[
  {"player": "Jeter", "year": "1995", "is_hit": "Hit", "count": 12},
  {"player": "Jeter", "year": "1995", "is_hit": "Miss", "count": 36},
  {"player": "Jeter", "year": "1996", "is_hit": "Hit", "count": 183},
  {"player": "Jeter", "year": "1996", "is_hit": "Miss", "count": 399},
  {"player": "Justice", "year": "1995", "is_hit": "Hit", "count": 104},
  {"player": "Justice", "year": "1995", "is_hit": "Miss", "count": 287},
  {"player": "Justice", "year": "1996", "is_hit": "Hit", "count": 45},
  {"player": "Justice", "year": "1996", "is_hit": "Miss", "count": 95}
]`,
          facet: 'player',
        }
      : {
          desc: 'Kidney stone dataset with fields: treatment (A/B), size (small/large), success (success/failure)',
          example: `[
  {"treatment": "A", "size": "small", "success": "success", "count": 81},
  {"treatment": "A", "size": "small", "success": "failure", "count": 6},
  {"treatment": "A", "size": "large", "success": "success", "count": 192},
  {"treatment": "A", "size": "large", "success": "failure", "count": 71},
  {"treatment": "B", "size": "small", "success": "success", "count": 234},
  {"treatment": "B", "size": "small", "success": "failure", "count": 36},
  {"treatment": "B", "size": "large", "success": "success", "count": 55},
  {"treatment": "B", "size": "large", "success": "failure", "count": 25}
]`,
          facet: 'treatment',
        };

  return `You are a Vega-Lite expert. Generate a specification to visualize Simpson's Paradox.

**Dataset**: ${datasetInfo.desc}
**Context**: ${article.substring(0, 500)}...
**Bias**: ${bias}

**Data format** (use this exact structure):
${datasetInfo.example}

**Requirements**:
1. Use faceted bar chart grouped by ${datasetInfo.facet}
2. Show the paradox clearly (success/hit vs failure/miss)
3. Use colors: success/hit in green shades, failure/miss in red shades
4. Add tooltips showing exact counts
5. Width: 300px per facet

**CRITICAL OUTPUT RULES**:
- Return ONLY valid JSON
- Start with { and end with }
- NO markdown (\`\`\`json)
- NO explanations
- NO comments in JSON

**Template**:
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"values": ${datasetInfo.example}},
  "facet": {"row": {"field": "${datasetInfo.facet}", "type": "nominal"}},
  "spec": {
    "width": 300,
    "mark": "bar",
    "encoding": {
      "x": {"field": "...", "type": "..."},
      "y": {"field": "count", "type": "quantitative"},
      "color": {"field": "...", "type": "nominal"},
      "tooltip": [...]
    }
  }
}`;
}

/**
 * 生成 Sequential 策略的细化 Prompt
 */
export function getSequentialRefinePrompt(stage: number, content: string): string {
  if (stage === 0) {
    return `Refine this title. Keep it UNDER 15 words. Return ONLY the title:\n${content}`;
  } else if (stage === 1) {
    return `Refine this article (keep 200-300 words):\n${content}`;
  } else {
    return `Improve this Vega-Lite spec (fix any issues, improve colors/layout). Return ONLY valid JSON:\n${content}`;
  }
}

export function getSequentialFinalizePrompt(stage: number, content: string): string {
  if (stage === 0) {
    return `Final polish. MUST be UNDER 15 words. Return ONLY the title, absolutely nothing else:\n${content}`;
  } else if (stage === 1) {
    return `Finalize this article:\n${content}`;
  } else {
    return `Finalize this Vega-Lite spec (add polish, ensure clarity). Return ONLY valid JSON:\n${content}`;
  }
}

/**
 * 生成 Voting 策略的聚合 Prompt
 */
export function getVotingAggregatorPrompt(stage: number, votes: string[]): string {
  if (stage === 0) {
    return `Choose the best title from these options:\n${votes.join('\n')}\n\nReturn ONLY the best title (under 15 words).`;
  } else if (stage === 1) {
    return `Combine these into one cohesive 200-300 word article:\n${votes.join('\n---\n')}`;
  } else {
    return `You are a Vega-Lite expert. Analyze these 3 specifications and create ONE improved version.
Preserve the best encodings, colors, and interactivity. Return ONLY valid JSON (no markdown).

Specs to aggregate:
${votes.join('\n---\n')}`;
  }
}