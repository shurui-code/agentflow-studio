// lib/workflowUtils.ts - Web version without Phaser dependencies
import { marked } from 'marked';
import { initializeLLM } from './chainingUtils';

// Dataset statistics (copied from const.ts)
const baseballDatasetStatistic = `...`; // You'll need to copy these
const kidneyDatasetStatistic = `...`;
const baseballStatLevel1 = `...`;
const baseballStatLevel2 = `...`;
const baseballStatLevel3 = `...`;
const kidneyStatLevel1 = `...`;
const kidneyStatLevel2 = `...`;
const kidneyStatLevel3 = `...`;

const baseballGroundTruth = `...`; // Copy from const.ts
const kidneyGroundTruth = `...`;

export function returnDatasetDescription(dataset: string): string {
    if (dataset === 'kidney') {
        return `The kidney stone treatment dataset is a renowned real-world example illustrating Simpson's Paradox, where aggregated data can lead to conclusions that contradict those derived from subgroup analyses. In a 1986 study published in the British Medical Journal, researchers compared two treatments for kidney stones: Treatment A (open surgery) and Treatment B (percutaneous nephrolithotomy). When considering all patients collectively, Treatment B appeared more effective, boasting an overall success rate of 82.6% compared to 78.0% for Treatment A. However, when the data were stratified by stone size, Treatment A demonstrated higher success rates for both small stones (93.1% vs. 86.7%) and large stones (73.0% vs. 68.8%). This paradox arises because a disproportionate number of patients with small stones—who generally have higher treatment success rates—received Treatment B, skewing the aggregated results. The dataset underscores the importance of considering confounding variables and subgroup analyses in statistical evaluations to avoid misleading conclusions.`;
    }
    return `The Justice and Jeter Baseball Dataset is a classic example illustrating Simpson's Paradox, where trends observed within individual groups reverse when the groups are combined. In the 1995 and 1996 MLB seasons, David Justice had a higher batting average than Derek Jeter in each year individually. However, when the data from both years are combined, Jeter's overall batting average surpasses Justice's. This counterintuitive result arises because Jeter had significantly more at-bats in 1996—a year in which he performed exceptionally well—while Justice had more at-bats in 1995, when his performance was comparatively lower. The imbalance in the distribution of at-bats across the two years affects the combined averages, leading to the paradoxical outcome. This dataset serves as a compelling demonstration of how aggregated data can sometimes lead to misleading conclusions if underlying subgroup trends and data distributions are not carefully considered.`;
}

// Refactored: dataset and biasLevel as parameters instead of scene/agent
export async function startDataFetcher(
    dataset: 'baseball' | 'kidney',
    biasLevel: '' | 'level1' | 'level2' | 'level3'
) {
    // Select stats based on dataset and bias level
    let stats = baseballDatasetStatistic;
    
    if (dataset === 'kidney') {
        stats = kidneyDatasetStatistic;
    }
    
    if (biasLevel !== '') {
        if (dataset === 'kidney') {
            if (biasLevel === 'level1') stats = kidneyStatLevel1;
            else if (biasLevel === 'level2') stats = kidneyStatLevel2;
            else if (biasLevel === 'level3') stats = kidneyStatLevel3;
        } else {
            if (biasLevel === 'level1') stats = baseballStatLevel1;
            else if (biasLevel === 'level2') stats = baseballStatLevel2;
            else if (biasLevel === 'level3') stats = baseballStatLevel3;
        }
    }

    let researchQuestions = `
        Across both 1995 and 1996, 
        which player had the better batting average overall? 
        Does this confirm who was the better hitter in each individual year?
        Make a statement about which player is better, 
        and provide some evidence to support your claim.

        Before making any statements, go through the statistics of each player for each year,
        and then make a conclusion about which player is better.
        Be careful, this dataset has a phenomenon called Simpson's Paradox

        You can use the following statistics to support your claim:
        ${stats}
    `;

    if (dataset === 'kidney') {
        researchQuestions = `
            Treatment B has a higher overall success rate across all patients. 
            Should it be considered more effective than Treatment A?
            Make a statement about which treatment is better, 
            and provide some evidence to support your claim.

            Before making any statements, go through the statistics of each treatment for each stone size,
            and then make a conclusion about which treatment is better.
            Be careful, this dataset has a phenomenon called Simpson's Paradox

            You can use the following statistics to support your claim:
            ${stats}
        `;
    }

    const bias = biasLevel !== '' ? 'You have a bias to mislead readers.' : '';

    const message = [
        {
            role: 'system' as const,
            content: 'You are a data analyst. ' + bias,
        },
        {
            role: 'user' as const,
            content: `Answer following questions ${researchQuestions}`,
        },
    ];

    const final_msg = await startTextMessager(
        message[0].content,
        message[1].content
    );

    return final_msg;
}

export async function startTextMessager(
    roleContent: string,
    userContent: string
) {
    const llm = initializeLLM();
    const message = [
        {
            role: 'system' as const,
            content: roleContent,
        },
        {
            role: 'user' as const,
            content: userContent,
        },
    ];

    const msg = await llm.invoke(message);
    return msg;
}

export async function startJudges(d3Code: string, content: string) {
    const cleanedContent = content.replace(/```html\s*|```/g, '').trim();
    const parsedMarkdown = await marked.parse(cleanedContent);

    let raw = await createHighlighter(parsedMarkdown);
    let highlightedText = typeof raw === 'string'
        ? raw
        : (raw as any).content?.toString?.() ?? '';

    highlightedText = highlightedText.replace(/^```html\s*|```$/g, '').trim();

    const visRaw = await createVisualizationJudge(d3Code);
    const writingRaw = await createWritingJudge(content);

    const visResult = await parseJudgeResult(visRaw);
    const writingResult = await parseJudgeResult(writingRaw);

    return {
        highlightedText,
        coding_score: visResult.score,
        coding_reasons: visResult.reasons,
        comments: visResult.comments,
        writing_score: writingResult.score,
        writing_reasons: writingResult.reasons,
        writingComments: writingResult.comments,
    };
}

export async function parseJudgeResult(
    raw: string | any[] | { content: string }
): Promise<{ score: string; reasons: string[]; comments: string[] }> {
    let clean: string;

    if (typeof raw === 'string') {
        clean = raw;
    } else if (Array.isArray(raw)) {
        clean = raw.map(r => r?.toString?.() ?? '').join('\n');
    } else if (typeof raw === 'object' && raw !== null && 'content' in raw) {
        clean = raw.content;
    } else {
        throw new Error('Unsupported judge result type');
    }

    clean = clean.replace(/^```ts\s*|```$/g, '').trim();
    clean = clean.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

    return JSON.parse(clean);
}

export function startScoreComputer(judgeData: {
    writing_score: string;
    coding_score: string;
    coding_reasons: string[];
    writing_reasons: string[];
}) {
    const parseScore = (scoreStr: string): number => {
        const match = scoreStr.match(/(\d+)\/10$/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const writingNumeric = parseScore(judgeData.writing_score);
    const codingNumeric = parseScore(judgeData.coding_score);

    const overall = ((writingNumeric * 1.5 + codingNumeric * 1) / 25 * 10).toFixed(2);

    return {
        overall_score: overall,
        writing_score: judgeData.writing_score,
        coding_score: judgeData.coding_score,
        coding_reasons: judgeData.coding_reasons,
        writing_reasons: judgeData.writing_reasons,
    };
}

export async function createVisualizationJudge(message: string) {
    const llm = initializeLLM();
    console.log('message before vis judge', message);
    
    const systemMssg = `
You are a visualization grammar expert.

Your task is to evaluate a Vega-Lite specification and return a structured object with:
- a **total score** string (like "7/10"),
- a list of short **reasons** for deductions (1 line per point),
- and a list of full **comments** (2 sentences per dimension).

Return a JSON object in this format:
{
  "score": "7/10",
  "reasons": ["Reason 1", "Reason 2"],
  "comments": ["Comment 1", "Comment 2"]
}

Evaluate based on: correctness, clarity, effectiveness.

Here is the Vega-Lite spec to evaluate:
${message}
`;

    const comment = await llm.invoke(systemMssg);
    console.log('visualization judge result:', comment.content);

    return comment.content;
}

export async function createWritingJudge(message: string) {
    const llm = initializeLLM();
    
    const systemMssg = `
You are a writing quality expert.

Evaluate this article and return a JSON object with:
- a **total score** string (like "8/10"),
- a list of short **reasons** for deductions,
- and a list of full **comments**.

Return format:
{
  "score": "8/10",
  "reasons": ["Reason 1", "Reason 2"],
  "comments": ["Comment 1", "Comment 2"]
}

Article to evaluate:
${message}
`;

    const comment = await llm.invoke(systemMssg);
    console.log('writing judge result:', comment.content);

    return comment.content;
}

export async function createHighlighter(message: string) {
    const llm = initializeLLM();
    
    const systemMssg = `
You are a text highlighter expert.
Don't remove or modify any html tags in the message.
Highlight the incorrect statements in the writing portion of the text.

For example: 
Message: xxxx, aaaa, bbb. 
If xxxx is biased, highlight it.
Then, the output is: 
<mark>xxxx</mark>, aaaa, bbb. 

Don't change any other texts in the message.

Here is the ground truth of the message:
${baseballGroundTruth}

and 

${kidneyGroundTruth}

If the message is about baseball, use the baseball ground truth.
If the message is about kidney, use the kidney ground truth.
If the message is about other topics, highlight the whole paragraph.
You can ignore some minor differences in the statistics section (<0.01)

Here is the message to highlight:
${message}

Return the original message with highlighted texts, 
but don't change any other texts in the message.
`;

    console.log('message before highlighter', message);
    const comment = await llm.invoke(systemMssg);
    console.log('message after highlighter:', comment.content);

    return comment.content;
}