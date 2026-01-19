// pages/api/test-openai.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ChatOpenAI } from '@langchain/openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  
  console.log('[Test] API Key present:', !!OPENAI_API_KEY);
  console.log('[Test] Starting OpenAI test...');
  
  try {
    const llm = new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      timeout: 10000, // 10秒超时
    });
    
    console.log('[Test] Calling OpenAI API...');
    const startTime = Date.now();
    
    const result = await llm.invoke('Say "Hello, test successful!"');
    
    const duration = Date.now() - startTime;
    console.log('[Test] ✅ SUCCESS in', duration, 'ms');
    console.log('[Test] Response:', result.content);
    
    return res.status(200).json({
      success: true,
      message: result.content,
      duration: duration
    });
  } catch (error: any) {
    console.error('[Test] ❌ ERROR:', error.message);
    console.error('[Test] Full error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
}