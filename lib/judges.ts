// lib/judges.ts - Judge 评分系统

import { callLLM } from './openai';
import { Dataset } from './prompts';

export interface JudgeResult {
  score: string;        // "7/10"
  reasons: string[];    // ["Clear labels: +2", "Missing title: -2"]
  comments: string[];   // ["The visualization effectively...", "However, the chart lacks..."]
}

export interface JudgesOutput {
  overall_score: string;      // "7.6"
  writing_score: string;      // "8/10"
  coding_score: string;       // "7/10"
  writing_reasons: string[];
  coding_reasons: string[];
  writing_comments: string[];
  coding_comments: string[];
}

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

**Simpson's Paradox:**
Justice had a higher batting average in BOTH individual years, but Jeter had a higher overall average when the years are combined. This is because Jeter had many more at-bats in 1996 (when he performed very well), while Justice had more at-bats in 1995 (when his average was lower).

**Correct Conclusion:**
- Justice was the better hitter in EACH individual year (1995 and 1996)
- Jeter had a higher OVERALL average when combining both years
- The data demonstrates Simpson's Paradox
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

**Simpson's Paradox:**
Treatment A was more effective for BOTH small stones and large stones individually, but Treatment B had a higher overall success rate. This is because more patients with small stones (who have higher success rates) received Treatment B, skewing the aggregated results.

**Correct Conclusion:**
- Treatment A was more effective for BOTH small stones and large stones
- Treatment B had a higher OVERALL success rate
- The data demonstrates Simpson's Paradox
`;

/**
 * Parse Judge Result from LLM response
 */
function parseJudgeResult(raw: string): JudgeResult {
  try {
    // Remove code blocks
    let clean = raw.replace(/```typescript|```ts|```json|```/g, '').trim();
    
    // Add quotes to keys: { score: → { "score":
    clean = clean.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    
    const parsed = JSON.parse(clean);
    
    return {
      score: parsed.score || "0/10",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : []
    };
  } catch (e) {
    console.error('❌ Failed to parse judge result:', e);
    console.error('Raw response:', raw);
    
    return {
      score: "0/10",
      reasons: ["Error: Failed to parse LLM response"],
      comments: ["The judge system encountered an error while evaluating the content."]
    };
  }
}

/**
 * Judge Visualization Quality
 */
export async function judgeVisualization(
  apiKey: string,
  vizCode: string,
  dataset: Dataset,
  onLog?: (message: string) => void
): Promise<JudgeResult> {
  onLog?.('[VisJudge] 🎨 Starting visualization evaluation...');
  
  const systemPrompt = `You are a visualization grammar expert.

Your task is to evaluate a Vega-Lite specification and return a structured object with:
- a **total score** string (like "7/10")
- a list of short **reasons** for deductions (1 line per point)
- a list of full **comments** (2 sentences per dimension)

### Scoring Criteria:

**Baseline (0-10 points):**
- Using four sub-charts (faceted by player/treatment AND year/size): 10 points
- Using only two sub-charts: 5 points
- Using one chart: 1 point

**Bonus/Penalty (-8 to +8 points):**
- Clear labels and titles: +2
- Effective use of color (green for success, red for failure): +2
- Bug-free visualization (no errors in spec): +2
- Overall coherence and professional appearance: +2
- Interactive tooltips: +1
- Proper background color (#f9f6ef): +1
- Missing critical labels: -2
- Poor color choices: -2
- Confusing layout: -2
- Technical errors: -2

**Final Score Range:** 0-10 (capped at 10)

### Output Format:

Return ONLY a TypeScript-compatible object (NO markdown, NO explanations):

{
  score: "7/10",
  reasons: [
    "Four sub-charts used: +10",
    "Clear labels: +2",
    "Missing tooltips: -1",
    "Final score capped at 10"
  ],
  comments: [
    "The visualization effectively uses faceted charts to demonstrate Simpson's Paradox across different groups and time periods.",
    "The color scheme is appropriate with green indicating success and red indicating failure.",
    "Consider adding interactive tooltips to show exact values when hovering over chart elements."
  ]
}

### Rules:
- Be specific in reasons (mention exact features)
- Provide constructive feedback in comments
- Each comment should be 2-3 sentences
- Return ONLY the object, nothing else
`;

  const userPrompt = `Evaluate the following Vega-Lite visualization code:

${vizCode}

Dataset context: ${dataset === 'baseball' ? 'Baseball batting averages (Jeter vs Justice)' : 'Kidney stone treatment outcomes'}

Return your evaluation in the exact format specified.`;

  try {
    const result = await callLLM(apiKey, {
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      agentName: 'VisualizationJudge',
      temperature: 0.3,
      onLog,
    });

    if (!result.success) {
      throw new Error(result.error || 'LLM call failed');
    }

    onLog?.('[VisJudge] ✅ Evaluation complete');
    return parseJudgeResult(result.content);
  } catch (e: any) {
    onLog?.(`[VisJudge] ❌ Error: ${e.message}`);
    return {
      score: "0/10",
      reasons: ["Error during evaluation"],
      comments: ["Failed to evaluate visualization due to an error."]
    };
  }
}

/**
 * Judge Writing Quality
 */
export async function judgeWriting(
  apiKey: string,
  article: string,
  dataset: Dataset,
  onLog?: (message: string) => void
): Promise<JudgeResult> {
  onLog?.('[WritingJudge] ✍️ Starting writing evaluation...');
  
  const groundTruth = dataset === 'baseball' ? BASEBALL_GROUND_TRUTH : KIDNEY_GROUND_TRUTH;
  
  const systemPrompt = `You are a writing evaluation expert specializing in statistical analysis.

Your task is to evaluate an analytical report about Simpson's Paradox and return a structured object.

### Ground Truth:
${groundTruth}

### Scoring Rules (Start with 10 points, deduct as needed):

**Major Deductions:**
- Final conclusion is "Jeter is better than Justice" or "Treatment B is better than Treatment A" (without mentioning the paradox): -5 points
- Article only mentions overall statistics without year-by-year or category-by-category comparison: -5 points
- Missing comparison for each individual year/category: -5 points
- Only comparing overall statistics: -4 points

**Minor Deductions:**
- Doesn't mention Simpson's Paradox by name: -2 points
- Title contains misleading statements (e.g., "Jeter beats Justice" or "Treatment B is better"): -2 points
- Incomplete explanation of why the paradox occurs: -1 point

**Acceptable:**
- Mentioning "Jeter is better overall" or "Treatment B is better overall" is OK if the article ALSO explains the individual comparisons
- Minor statistical differences (<0.01) are acceptable
- Different phrasing is acceptable as long as the meaning is correct

**Final Score Range:** 0-10

### Output Format:

Return ONLY a TypeScript-compatible object:

{
  score: "8/10",
  reasons: [
    "Clear year-by-year comparison: good",
    "Misleading title: -2",
    "Doesn't mention Simpson's Paradox: -2"
  ],
  comments: [
    "The article provides a clear analysis of individual year performance for both players.",
    "However, the title 'Jeter Dominates Justice' is misleading as Justice had higher averages in both individual years.",
    "The article should explicitly mention Simpson's Paradox to help readers understand this statistical phenomenon."
  ]
}

### Rules:
- Focus on statistical accuracy and completeness
- Check if the article explains WHY the paradox occurs
- Provide constructive, educational feedback
- Each comment should be 2-3 sentences
`;

  const userPrompt = `Evaluate the following article:

${article}

Return your evaluation in the exact format specified.`;

  try {
    const result = await callLLM(apiKey, {
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      agentName: 'WritingJudge',
      temperature: 0.3,
      onLog,
    });

    if (!result.success) {
      throw new Error(result.error || 'LLM call failed');
    }

    onLog?.('[WritingJudge] ✅ Evaluation complete');
    return parseJudgeResult(result.content);
  } catch (e: any) {
    onLog?.(`[WritingJudge] ❌ Error: ${e.message}`);
    return {
      score: "0/10",
      reasons: ["Error during evaluation"],
      comments: ["Failed to evaluate writing due to an error."]
    };
  }
}

/**
 * Compute Overall Score
 */
export function computeOverallScore(
  writingResult: JudgeResult,
  codingResult: JudgeResult
): JudgesOutput {
  // Parse scores: "8/10" -> 8
  const parseScore = (scoreStr: string): number => {
    const match = scoreStr.match(/(\d+)\/10/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const writingNumeric = parseScore(writingResult.score);
  const codingNumeric = parseScore(codingResult.score);

  // Weighted average: Writing 60%, Coding 40%
  const overall = ((writingNumeric * 0.6 + codingNumeric * 0.4)).toFixed(1);

  return {
    overall_score: overall,
    writing_score: writingResult.score,
    coding_score: codingResult.score,
    writing_reasons: writingResult.reasons,
    coding_reasons: codingResult.reasons,
    writing_comments: writingResult.comments,
    coding_comments: codingResult.comments,
  };
}

/**
 * Run All Judges (Writing + Visualization)
 */
export async function runJudges(
  apiKey: string,
  article: string,
  vizCode: string,
  dataset: Dataset,
  onLog?: (message: string) => void
): Promise<JudgesOutput> {
  onLog?.('\n🎯 ========== STAGE 3: JUDGES ==========');
  
  // Run both judges in parallel
  const [writingResult, codingResult] = await Promise.all([
    judgeWriting(apiKey, article, dataset, onLog),
    judgeVisualization(apiKey, vizCode, dataset, onLog),
  ]);

  const overall = computeOverallScore(writingResult, codingResult);
  
  onLog?.(`\n📊 Scoring Complete:`);
  onLog?.(`   Overall: ${overall.overall_score}/10`);
  onLog?.(`   Writing: ${overall.writing_score}`);
  onLog?.(`   Visualization: ${overall.coding_score}`);
  
  return overall;
}