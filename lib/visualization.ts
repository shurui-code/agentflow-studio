// lib/visualization.ts - 完整的 Vega-Lite 生成系统（基于原始代码）

import { callLLM } from './openai';
import { Dataset, BiasLevel } from './prompts';

export interface VizGenerationOptions {
  apiKey: string;
  dataset: Dataset;
  biasLevel: BiasLevel;
  article: string;
  agentName: string;
  maxRetries?: number;
  onLog?: (message: string) => void;
}

/**
 * 获取数据集的可视化数据
 */
function getVisualizationData(dataset: Dataset): string {
  if (dataset === 'baseball') {
    return JSON.stringify([
      { "player": "Jeter", "year": "1995", "is_hit": "Hit", "count": 12 },
      { "player": "Jeter", "year": "1995", "is_hit": "Miss", "count": 36 },
      { "player": "Jeter", "year": "1996", "is_hit": "Hit", "count": 183 },
      { "player": "Jeter", "year": "1996", "is_hit": "Miss", "count": 399 },
      { "player": "Justice", "year": "1995", "is_hit": "Hit", "count": 104 },
      { "player": "Justice", "year": "1995", "is_hit": "Miss", "count": 287 },
      { "player": "Justice", "year": "1996", "is_hit": "Hit", "count": 45 },
      { "player": "Justice", "year": "1996", "is_hit": "Miss", "count": 95 }
    ]);
  } else {
    return JSON.stringify([
      { "treatment": "A", "size": "small", "success": "success", "count": 81 },
      { "treatment": "A", "size": "small", "success": "failure", "count": 6 },
      { "treatment": "A", "size": "large", "success": "success", "count": 192 },
      { "treatment": "A", "size": "large", "success": "failure", "count": 71 },
      { "treatment": "B", "size": "small", "success": "success", "count": 234 },
      { "treatment": "B", "size": "small", "success": "failure", "count": 36 },
      { "treatment": "B", "size": "large", "success": "success", "count": 55 },
      { "treatment": "B", "size": "large", "success": "failure", "count": 25 }
    ]);
  }
}

/**
 * 生成自动可视化 Prompt（无偏见）- 饼图版本
 */
function generateAutoVISPrompt(dataSummary: string): string {
  return `You are an expert in Vega-Lite visualization.

Your task is to generate a valid Vega-Lite specification that visualizes Simpson's Paradox using PIE CHARTS.

**Design Requirements (CRITICAL):**
- Use LAYERED PIE CHARTS (arc mark + text mark)
- Visualize the proportion of hit/miss (or success/failure)
- Facet by row (player/treatment) and column (year/size)
- Background color: MUST be "#f9f6ef" (newspaper style)
- Color scheme: green (#4CAF50) for success/hit, red (#F44336) for failure/miss
- Font: Georgia or serif fonts
- Add text labels on each arc showing percentage

**Critical Rules:**
1. Use ONLY the data provided
2. Return the COMPLETE code including vegaEmbed() call
3. Use the exact template structure provided below
4. Do NOT modify data values

**Data Summary:**
${dataSummary}

**REQUIRED OUTPUT FORMAT:**
You MUST return code in this exact format:

const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": "#f9f6ef",
  "data": {
    "values": ${dataSummary}
  },
  "facet": {
    "row": {"field": "player", "type": "nominal"},
    "column": {"field": "year", "type": "nominal"}
  },
  "spec": {
    "layer": [
      {
        "mark": {"type": "arc", "innerRadius": 0},
        "encoding": {
          "theta": {"field": "count", "type": "quantitative"},
          "color": {
            "field": "is_hit",
            "type": "nominal",
            "scale": {
              "domain": ["Hit", "Miss"],
              "range": ["#4CAF50", "#F44336"]
            }
          },
          "tooltip": [
            {"field": "is_hit", "type": "nominal"},
            {"field": "count", "type": "quantitative"}
          ]
        }
      },
      {
        "mark": {"type": "text", "radius": 80},
        "encoding": {
          "theta": {"field": "count", "type": "quantitative"},
          "text": {"field": "count", "type": "quantitative"}
        }
      }
    ]
  }
};

vegaEmbed('#vega-chart', spec, {
  renderer: "canvas",
  actions: false,
  scaleFactor: 2
});

Return ONLY the code above with proper data and structure. NO explanations.`;
}

/**
 * 生成有偏见的 Prompt
 */
function generateBiasedPrompt(facetVar: string, dataSummary: string, biasLevel: BiasLevel): string {
  const biasInstructions: Record<BiasLevel, string> = {
    '': '',
    'level1': 'Include subtle visual framing that slightly emphasizes one group over another (e.g., chart ordering, color saturation differences).',
    'level2': 'Use color choices, chart ordering, and axis scaling to moderately favor one group and downplay the other.',
    'level3': 'Design the visualization to strongly mislead viewers about which group performs better through aggressive color choices, misleading scales, and strategic data presentation.',
  };

  const bias = biasInstructions[biasLevel] || '';

  return `You are an expert in Vega-Lite visualization.

Generate a valid Vega-Lite specification for visualizing the data.

**Design Requirements (CRITICAL):**
- Background color: MUST be "#f9f6ef" (newspaper style)
- Color scheme: Use green (#4CAF50 or #10b981) for success/hit, red (#F44336 or #ef4444) for failure/miss
- Font: Use Georgia or serif fonts for clean, professional look
- Width: 300px per facet chart
- Include tooltips with detailed information
- Border radius: 6-8px for modern appearance

${bias ? `**Bias Instruction (Level ${biasLevel}):**\n${bias}\n` : ''}

**Data Summary:**
${dataSummary}

**Critical Rules:**
1. Return ONLY valid Vega-Lite JSON
2. NO markdown (\`\`\`json)
3. Use the provided data exactly as given
4. Facet by ${facetVar}
5. Show success/failure or hit/miss proportions
6. Professional newspaper aesthetic

**IMPORTANT:** The spec must be production-ready with proper styling, colors, and layout.`;
}

/**
 * 验证 Vega-Lite Spec
 */
function validateVegaLiteSpec(spec: any): { valid: boolean; error?: string } {
  if (!spec.$schema) {
    return { valid: false, error: 'Missing $schema field' };
  }
  if (!spec.data) {
    return { valid: false, error: 'Missing data field' };
  }
  if (!spec.mark && !spec.spec) {
    return { valid: false, error: 'Missing mark or spec field' };
  }
  return { valid: true };
}

/**
 * 清理代码（保留 vegaEmbed 调用）
 */
function extractJSON(text: string): string {
  // 只移除 markdown 代码块标记
  let clean = text.replace(/```javascript/gi, '').replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // 移除可能的语言标识
  clean = clean.replace(/^\s*(json|javascript|js|ts|typescript)\s*\n/i, '');
  
  return clean;
}

/**
 * 获取具体的错误修复建议
 */
function getSpecificFix(error: string): string {
  const fixes: Record<string, string> = {
    'undefined variable': 'Ensure all fields in encodings exist in the data',
    'missing scale': 'Add proper scale definitions for categorical data',
    'invalid data': 'Validate data structure matches Vega-Lite requirements',
    'Missing $schema': 'Add "$schema": "https://vega.github.io/schema/vega-lite/v5.json"',
    'Missing data': 'Ensure "data" field with "values" array is present',
    'Missing mark': 'Add "mark" field (e.g., "bar", "line", "point")',
  };
  
  for (const [key, value] of Object.entries(fixes)) {
    if (error.includes(key)) return value;
  }
  
  return 'Review Vega-Lite specification structure';
}

/**
 * 生成 Vega-Lite 可视化（带重试和错误修复）
 */
export async function generateVegaLiteWithRetry(
  options: VizGenerationOptions
): Promise<string> {
  const {
    apiKey,
    dataset,
    biasLevel,
    article,
    agentName,
    maxRetries = 3,
    onLog,
  } = options;

  const dataSummary = getVisualizationData(dataset);
  const facetVar = dataset === 'baseball' ? 'player' : 'treatment';
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n🔄 [${agentName}] ========== ATTEMPT ${attempt}/${maxRetries} ==========`);
    onLog?.(`[${agentName}] 🔄 Attempt ${attempt}/${maxRetries} to generate Vega-Lite...`);

    try {
      // 选择 Prompt
      const systemPrompt = biasLevel === '' 
        ? generateAutoVISPrompt(dataSummary)
        : generateBiasedPrompt(facetVar, dataSummary, biasLevel);

      console.log(`📝 [${agentName}] System Prompt Length:`, systemPrompt.length);
      console.log(`📊 [${agentName}] Dataset:`, dataset);
      console.log(`🎚️ [${agentName}] Bias Level:`, biasLevel || 'None');

      // 用户 Prompt
      const userPrompt = `
Generate a Vega-Lite PIE CHART visualization for the data.

**Requirements:**
- Use layered pie charts (arc + text marks)
- Facet by ${facetVar} (row) and year/size (column)
- Colors: #4CAF50 (green) for success/hit, #F44336 (red) for failure/miss
- Include text labels showing counts on each arc

**Data:**
${dataSummary}

**CRITICAL: Return code in this EXACT format:**

const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { "values": ${dataSummary} },
  ... (your spec here)
};

vegaEmbed('#vega-chart', spec, {
  renderer: "canvas",
  actions: false,
  scaleFactor: 2
});

**Rules:**
1. Return COMPLETE code including vegaEmbed() call
2. Use '#vega-chart' as the div selector
3. NO markdown blocks
4. NO explanations
5. Code must be executable with eval()

${lastError ? `**Fix this error:** ${lastError}\n${getSpecificFix(lastError)}` : ''}
`;

      const result = await callLLM(apiKey, {
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        agentName,
        temperature: 0.7,
        onLog,
      });

      console.log(`✅ [${agentName}] LLM Response received (${result.content?.length || 0} chars)`);

      if (!result.success) {
        console.error(`❌ [${agentName}] LLM call failed:`, result.error);
        throw new Error(result.error || 'LLM call failed');
      }

      console.log(`📄 [${agentName}] Raw LLM Output:\n`, result.content.substring(0, 500) + '...');

      // 清理代码
      const cleanCode = extractJSON(result.content);
      console.log(`🧹 [${agentName}] Cleaned code length:`, cleanCode.length);
      console.log(`🧹 [${agentName}] Cleaned code:\n`, cleanCode);

      // 不需要 parse，直接返回代码供 eval 执行
      console.log(`✅ [${agentName}] Code ready for eval execution`);
      onLog?.(`[${agentName}] ✅ Vega-Lite code generated on attempt ${attempt}!`);
      return cleanCode;
    } catch (e: any) {
      lastError = e.message;
      console.error(`\n❌ [${agentName}] ========== ATTEMPT ${attempt} FAILED ==========`);
      console.error(`❌ [${agentName}] Error:`, e.message);
      console.error(`❌ [${agentName}] Stack:`, e.stack?.substring(0, 200));
      onLog?.(
        `[${agentName}] ⚠️ Attempt ${attempt} failed: ${e.message.substring(0, 100)}...`
      );

      if (attempt === maxRetries) {
        console.error(`\n❌❌❌ [${agentName}] ALL ATTEMPTS FAILED ❌❌❌`);
        console.error(`❌ [${agentName}] Last error:`, lastError);
        console.log(`🔄 [${agentName}] Using fallback visualization...`);
        onLog?.(`[${agentName}] ❌ All ${maxRetries} attempts failed, using fallback spec`);

        // 返回简单的后备可视化
        const fallbackSpec = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          background: '#f9f6ef',
          title: `${dataset === 'baseball' ? 'Baseball' : 'Kidney Stone'} Data - Fallback Visualization`,
          data: { values: JSON.parse(dataSummary) },
          mark: 'bar',
          encoding: {
            x: { field: dataset === 'baseball' ? 'is_hit' : 'success', type: 'nominal', title: 'Outcome' },
            y: { field: 'count', type: 'quantitative', title: 'Count' },
            color: { 
              field: dataset === 'baseball' ? 'is_hit' : 'success', 
              type: 'nominal',
              scale: { range: ['#10b981', '#ef4444'] }
            }
          }
        };

        console.log(`📊 [${agentName}] Fallback spec:\n`, JSON.stringify(fallbackSpec, null, 2));
        return JSON.stringify(fallbackSpec);
      }

      // 等待 1 秒后重试
      console.log(`⏳ [${agentName}] Waiting 1 second before retry...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return '{}';
}