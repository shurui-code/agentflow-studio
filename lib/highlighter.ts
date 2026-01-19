// lib/highlighter.ts - 高亮 Hallucination 内容

import { callLLM } from './openai';
import { Dataset } from './prompts';

/**
 * Ground Truth 数据
 */
const BASEBALL_GROUND_TRUTH = `
**Ground Truth for Baseball Dataset:**

1995 Season:
- Derek Jeter: 12 hits in 48 at-bats (batting average: .250)
- David Justice: 104 hits in 391 at-bats (batting average: .266)
- Justice had a higher batting average in 1995

1996 Season:
- Derek Jeter: 183 hits in 582 at-bats (batting average: .314)
- David Justice: 45 hits in 140 at-bats (batting average: .321)
- Justice had a higher batting average in 1996

Combined (1995 + 1996):
- Derek Jeter: 195 hits in 630 at-bats (batting average: .310)
- David Justice: 149 hits in 531 at-bats (batting average: .281)
- Jeter had a higher overall batting average

**Correct Conclusion:**
Justice was the better hitter in EACH individual year (1995 and 1996), 
but Jeter had a higher OVERALL average when combining both years. 
This demonstrates Simpson's Paradox.
`;

const KIDNEY_GROUND_TRUTH = `
**Ground Truth for Kidney Stone Treatment Dataset:**

Small Stones:
- Treatment A: 81 successes out of 87 patients (93.1% success rate)
- Treatment B: 234 successes out of 270 patients (86.7% success rate)
- Treatment A was more effective for small stones

Large Stones:
- Treatment A: 192 successes out of 263 patients (73.0% success rate)
- Treatment B: 55 successes out of 80 patients (68.8% success rate)
- Treatment A was more effective for large stones

Combined (All Patients):
- Treatment A: 273 successes out of 350 patients (78.0% success rate)
- Treatment B: 289 successes out of 350 patients (82.6% success rate)
- Treatment B had a higher overall success rate

**Correct Conclusion:**
Treatment A was more effective for BOTH small stones and large stones individually,
but Treatment B had a higher overall success rate.
This demonstrates Simpson's Paradox.
`;

/**
 * 使用 LLM 高亮文章中的错误/误导性内容
 */
export async function highlightHallucinations(
  apiKey: string,
  article: string,
  dataset: Dataset,
  onLog?: (message: string) => void
): Promise<string> {
  onLog?.('[Highlighter] 🎨 Starting to identify hallucinated content...');

  const groundTruth = dataset === 'baseball' ? BASEBALL_GROUND_TRUTH : KIDNEY_GROUND_TRUTH;

  const systemPrompt = `You are a text highlighter expert specializing in identifying incorrect or misleading statements.

**Your Task:**
1. Read the article carefully
2. Compare it with the ground truth data
3. Identify INCORRECT or MISLEADING statements
4. Wrap those statements in <mark> tags
5. Return the modified article

**Ground Truth:**
${groundTruth}

**Rules:**
- Only highlight statements that are factually wrong or misleading
- Use <mark style="background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 3px;">incorrect text</mark>
- Do NOT modify any other parts of the text
- Do NOT remove or change HTML tags that already exist
- Ignore minor statistical differences (<0.01)
- Focus on major errors like:
  * Wrong numbers (e.g., "Jeter had 500 hits" when it's actually 195)
  * Wrong conclusions (e.g., "Jeter was better in both years")
  * Missing critical information (e.g., not mentioning Simpson's Paradox)
  * Cherry-picked facts that mislead

**Important:**
- If the article mentions "overall" stats and also mentions individual year/category stats, that's OK - don't highlight
- Only highlight if the article ONLY shows overall stats without individual breakdowns
- If title is misleading (e.g., "Jeter Dominates Justice"), highlight the title

**Example:**

Input:
"Derek Jeter had 500 hits in 1995-1996 combined. He was clearly the better player."

Output:
"Derek Jeter had <mark style="background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 3px;">500 hits</mark> in 1995-1996 combined. <mark style="background-color: #fee2e2; color: #991b1b; padding: 2px 4px; border-radius: 3px;">He was clearly the better player.</mark>"

Now highlight the following article:`;

  const userPrompt = article;

  try {
    const result = await callLLM(apiKey, {
      prompt: `${systemPrompt}\n\n${userPrompt}\n\nReturn ONLY the highlighted article, no explanations.`,
      agentName: 'Highlighter',
      temperature: 0.3,
      onLog,
    });

    if (!result.success) {
      onLog?.(`[Highlighter] ❌ Failed: ${result.error}`);
      return article; // Return original if highlighting fails
    }

    onLog?.('[Highlighter] ✅ Highlighting complete');
    return result.content;
  } catch (e: any) {
    onLog?.(`[Highlighter] ❌ Error: ${e.message}`);
    return article; // Return original on error
  }
}

/**
 * 简单版本：只在顶部添加警告，不修改文本
 */
export function addHallucinationWarning(
  article: string,
  hallucinatedStages: { stage: number; agent: number; type: string }[]
): string {
  if (hallucinatedStages.length === 0) return article;

  const warningBanner = `
<div style="padding: 16px; background-color: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; margin-bottom: 20px;">
  <h3 style="font-size: 16px; font-weight: 600; color: #991b1b; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
    ⚠️ Hallucination Warning
  </h3>
  <p style="font-size: 14px; color: #7f1d1d; margin: 0 0 8px 0;">
    This report contains content generated by hallucinated agents:
  </p>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #7f1d1d;">
    ${hallucinatedStages
      .map(
        (h) => `
    <li>
      <strong>Stage ${h.stage}</strong> (${h.stage === 0 ? 'Title' : h.stage === 1 ? 'Writing' : 'Visualization'}): 
      Agent ${h.agent} - <em>${h.type}</em> hallucination
    </li>`
      )
      .join('')}
  </ul>
  <p style="font-size: 12px; color: #7f1d1d; margin: 8px 0 0 0; font-style: italic;">
    💡 Highlighted content indicates potential errors or misleading statements.
  </p>
</div>
`;

  return warningBanner + article;
}

/**
 * 从 hallucinationConfig 提取 hallucinated stages 信息
 */
export function extractHallucinatedStages(hallucinationConfig?: {
  type: string;
  selectedAgents?: { 0?: number; 1?: number; 2?: number };
}): { stage: number; agent: number; type: string }[] {
  if (!hallucinationConfig || !hallucinationConfig.type) return [];

  const stages: { stage: number; agent: number; type: string }[] = [];

  Object.entries(hallucinationConfig.selectedAgents || {}).forEach(([stageStr, agent]) => {
    if (agent) {
      stages.push({
        stage: parseInt(stageStr),
        agent: agent,
        type: hallucinationConfig.type,
      });
    }
  });

  return stages;
}