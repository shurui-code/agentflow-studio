// pages/index.tsx - 交互式 ReactFlow 版本（点击节点查看详情）
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { Node, Edge, useNodesState, useEdgesState, Background, Controls, MiniMap } from 'reactflow';
import dynamic from 'next/dynamic';
import vegaEmbed from 'vega-embed';

// Types
import { WorkflowState, StageResult, NodeOutput, ModalData, Strategy } from '../types';

// Lib
import { Dataset, getTitlePromptBase, getArticlePromptBase } from '../lib/prompts';
import { runVotingStrategy, runSequentialStrategy, runSingleAgentStrategy } from '../lib/strategies';
import { generateNodes, generateEdges, generateFinalNodes, generateFinalEdges } from '../lib/reactflow-utils';
import { loadCSVData, aggregateCSVData } from '../lib/csvLoader';

// Components
import { ConfigPanel } from '../components/ConfigPanel';

// Expose vega-embed to window for eval() to use
if (typeof window !== 'undefined') {
  (window as any).vegaEmbed = vegaEmbed;
}

const VegaLite = dynamic(() => import('react-vega').then((mod) => mod.VegaLite), { ssr: false });

const nodeStyles = {
  default: { background: '#fff', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e0e0e0', borderRadius: '8px', padding: '10px', cursor: 'pointer' },
  running: { background: '#f5f7ff', borderWidth: '2px', borderStyle: 'solid', borderColor: '#667eea', boxShadow: '0 0 20px rgba(102, 126, 234, 0.4)', cursor: 'pointer' },
  completed: { background: '#f0fdf4', borderWidth: '2px', borderStyle: 'solid', borderColor: '#10b981', cursor: 'pointer' },
  clickable: { cursor: 'pointer', transition: 'all 0.2s' },
};

export default function Home() {
  // 从环境变量读取 API key（支持两种命名方式）
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  
  const [state, setState] = useState<WorkflowState>({
    dataset: 'baseball',
    strategies: ['voting', 'sequential', 'single'],
    currentStage: -1,
    running: false,
    apiKey: apiKey,
  });

  const [result, setResult] = useState<StageResult>({});
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // 新增：存储节点输出和模态框状态
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, NodeOutput>>({});
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  
  const isRunningRef = useRef(false);

  // Effect to render visualization when modal opens
  useEffect(() => {
    if (showModal && modalData?.type === 'stage' && modalData.content.stage === 2) {
      console.log('\n🔄 Stage Modal opened, attempting to render visualization...');
      
      setTimeout(() => {
        const container = document.getElementById('vega-chart-modal');
        console.log('📦 Stage Modal - Container exists?', !!container);
        console.log('📦 vegaEmbed available?', typeof (window as any).vegaEmbed);
        
        if (container && modalData.content.result) {
          try {
            container.innerHTML = '';
            
            let code = '';
            if (typeof modalData.content.result === 'string') {
              // 清理代码：移除 markdown 代码块标记和 TypeScript 类型注解
              let cleanedCode = modalData.content.result
                .replace(/```javascript/gi, '')
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/const\s+(\w+):\s*any\s*=/g, 'const $1 =')  // 移除 TypeScript 类型注解
                .replace(/const\s+(\w+):\s*\{[\s\S]*?\}\s*=/g, 'const $1 =')  // 移除复杂类型注解
                .replace(/(\w+):\s*(\w+)\s*=/g, '$1 = $2')  // 移除对象属性中的类型注解（简单情况）
                .replace(/#vega-chart/g, '#vega-chart-modal')
                .trim();
              
              // 尝试提取 spec 对象并修改
              try {
                // 更精确地匹配 spec 对象（处理嵌套的大括号）
                const specMatch = cleanedCode.match(/const\s+spec\s*=\s*(\{(?:[^{}]|(?:\{[^{}]*\}))*\});/);
                if (specMatch) {
                  // 解析 spec
                  const specStr = specMatch[1];
                  let spec;
                  try {
                    spec = eval(`(${specStr})`); // 安全地解析对象
                  } catch (parseError) {
                    // 如果 eval 失败，尝试直接使用原始代码
                    throw new Error('Failed to parse spec object');
                  }
                  
                  // 移除宽度并添加 autosize
                  delete spec.width;
                  if (spec.spec) delete spec.spec.width;
                  if (spec.config && spec.config.view) delete spec.config.view.width;
                  spec.autosize = { type: 'fit', contains: 'padding' };
                  
                  // 重新生成代码
                  code = `const spec = ${JSON.stringify(spec)};\nvegaEmbed('#vega-chart-modal', spec, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
                } else {
                  // 如果无法提取 spec，只修改 vegaEmbed 调用
                  const replaced = cleanedCode.replace(
                    /vegaEmbed\(['"]#vega-chart-modal['"],\s*([^,)]+),\s*\{([^}]*)\}\)/,
                    (match, spec, options) => {
                      return `vegaEmbed('#vega-chart-modal', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                    }
                  );
                  code = replaced === cleanedCode ? cleanedCode : replaced;
                }
              } catch (e) {
                // 如果解析失败，使用原始代码但只修改 vegaEmbed 调用
                console.warn('Failed to parse spec, using fallback:', e);
                const replaced = cleanedCode.replace(
                  /vegaEmbed\(['"]#vega-chart-modal['"],\s*([^,)]+),\s*\{([^}]*)\}\)/,
                  (match, spec, options) => {
                    return `vegaEmbed('#vega-chart-modal', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                  }
                );
                code = replaced === cleanedCode ? cleanedCode : replaced;
              }
              
              // 确保 code 有值
              if (!code || code.trim() === '') {
                code = cleanedCode;
              }
            } else {
              // 如果是对象，移除宽度并添加 autosize
              const spec = JSON.parse(JSON.stringify(modalData.content.result));
              delete spec.width;
              if (spec.spec) delete spec.spec.width;
              if (spec.config && spec.config.view) delete spec.config.view.width;
              spec.autosize = { type: 'fit', contains: 'padding' };
              
              code = `(window.vegaEmbed || window.vegaEmbed)('#vega-chart-modal', ${JSON.stringify(spec)}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
            }
            
            if (code) {
              console.log('⚡ Executing visualization code in Stage Modal...');
              eval(code);
              
              // 等待图表渲染后，检查是否需要缩放
              setTimeout(() => {
                const chartElement = container.querySelector('svg, canvas, div.vega-embed');
                if (chartElement) {
                  const containerWidth = container.clientWidth - 40; // 减去 padding
                  const chartWidth = (chartElement as HTMLElement).scrollWidth || (chartElement as HTMLElement).offsetWidth;
                  
                  if (chartWidth > containerWidth) {
                    const scale = containerWidth / chartWidth;
                    (chartElement as HTMLElement).style.transform = `scale(${scale})`;
                    (chartElement as HTMLElement).style.transformOrigin = 'top left';
                    (chartElement as HTMLElement).style.width = `${chartWidth}px`;
                    (chartElement as HTMLElement).style.height = `${(chartElement as HTMLElement).scrollHeight}px`;
                    container.style.height = `${(chartElement as HTMLElement).scrollHeight * scale + 40}px`;
                    console.log(`✅ Chart scaled to ${(scale * 100).toFixed(1)}% to fit container`);
                  }
                }
              }, 500);
              
              console.log('✅ Stage Modal - Code executed!');
            }
          } catch (e) {
            console.error('❌ Stage Modal - Render error:', e);
          }
        }
      }, 100);
    }
    
    // Render in Final Report modal
    if (showModal && modalData?.type === 'final' && result.visualization) {
      console.log('\n🔄 Final Report Modal opened, attempting to render visualization...');
      
      setTimeout(() => {
        const container = document.getElementById('vega-chart-final');
        console.log('📦 Final Report - Container exists?', !!container);
        
        if (container && result.visualization) {
          try {
            container.innerHTML = '';
            
            let code = '';
            if (typeof result.visualization === 'string') {
              // 清理代码：移除 markdown 代码块标记和 TypeScript 类型注解
              let cleanedCode = result.visualization
                .replace(/```javascript/gi, '')
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/const\s+(\w+):\s*any\s*=/g, 'const $1 =')  // 移除 TypeScript 类型注解
                .replace(/const\s+(\w+):\s*\{[\s\S]*?\}\s*=/g, 'const $1 =')  // 移除复杂类型注解
                .replace(/(\w+):\s*(\w+)\s*=/g, '$1 = $2')  // 移除对象属性中的类型注解（简单情况）
                .replace(/#vega-chart/g, '#vega-chart-final')
                .trim();
              
              // 尝试提取 spec 对象并修改
              try {
                // 更精确地匹配 spec 对象（处理嵌套的大括号）
                const specMatch = cleanedCode.match(/const\s+spec\s*=\s*(\{(?:[^{}]|(?:\{[^{}]*\}))*\});/);
                if (specMatch) {
                  // 解析 spec
                  const specStr = specMatch[1];
                  let spec;
                  try {
                    spec = eval(`(${specStr})`); // 安全地解析对象
                  } catch (parseError) {
                    // 如果 eval 失败，尝试直接使用原始代码
                    throw new Error('Failed to parse spec object');
                  }
                  
                  // 移除宽度并添加 autosize
                  delete spec.width;
                  if (spec.spec) delete spec.spec.width;
                  if (spec.config && spec.config.view) delete spec.config.view.width;
                  spec.autosize = { type: 'fit', contains: 'padding' };
                  
                  // 重新生成代码
                  code = `const spec = ${JSON.stringify(spec)};\nvegaEmbed('#vega-chart-final', spec, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
                } else {
                  // 如果无法提取 spec，只修改 vegaEmbed 调用
                  const replaced = cleanedCode.replace(
                    /vegaEmbed\(['"]#vega-chart-final['"],\s*([^,)]+),\s*\{([^}]*)\}\)/,
                    (match, spec, options) => {
                      return `vegaEmbed('#vega-chart-final', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                    }
                  );
                  // 如果替换失败，使用原始代码
                  code = replaced === cleanedCode ? cleanedCode : replaced;
                }
              } catch (e) {
                // 如果解析失败，使用原始代码但只修改 vegaEmbed 调用
                console.warn('Failed to parse spec, using fallback:', e);
                const replaced = cleanedCode.replace(
                  /vegaEmbed\(['"]#vega-chart-final['"],\s*([^,)]+),\s*\{([^}]*)\}\)/,
                  (match, spec, options) => {
                    return `vegaEmbed('#vega-chart-final', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                  }
                );
                // 如果替换失败，使用原始代码（可能已经包含正确的选择器）
                code = replaced === cleanedCode ? cleanedCode : replaced;
              }
              
              // 确保 code 有值
              if (!code || code.trim() === '') {
                code = cleanedCode;
              }
            } else {
              // 如果是对象，移除宽度并添加 autosize
              const spec = JSON.parse(JSON.stringify(result.visualization));
              delete spec.width;
              if (spec.spec) delete spec.spec.width;
              if (spec.config && spec.config.view) delete spec.config.view.width;
              spec.autosize = { type: 'fit', contains: 'padding' };
              
              code = `(window.vegaEmbed || window.vegaEmbed)('#vega-chart-final', ${JSON.stringify(spec)}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
            }
            
            if (code) {
              console.log('⚡ Executing visualization code in Final Report...');
              console.log('📄 Code (first 500 chars):\n', code.substring(0, 500));
              console.log('📄 Full code length:', code.length);
              
              try {
                eval(code);
              } catch (evalError) {
                console.error('❌ Eval error:', evalError);
                console.error('❌ Problematic code (last 200 chars):', code.substring(Math.max(0, code.length - 200)));
                throw evalError;
              }
              
              // 等待图表渲染后，检查是否需要缩放
              setTimeout(() => {
                const chartElement = container.querySelector('svg, canvas, div.vega-embed');
                if (chartElement) {
                  const containerWidth = container.clientWidth - 40; // 减去 padding
                  const chartWidth = (chartElement as HTMLElement).scrollWidth || (chartElement as HTMLElement).offsetWidth;
                  
                  if (chartWidth > containerWidth) {
                    const scale = containerWidth / chartWidth;
                    (chartElement as HTMLElement).style.transform = `scale(${scale})`;
                    (chartElement as HTMLElement).style.transformOrigin = 'top left';
                    (chartElement as HTMLElement).style.width = `${chartWidth}px`;
                    (chartElement as HTMLElement).style.height = `${(chartElement as HTMLElement).scrollHeight}px`;
                    container.style.height = `${(chartElement as HTMLElement).scrollHeight * scale + 40}px`;
                    console.log(`✅ Chart scaled to ${(scale * 100).toFixed(1)}% to fit container`);
                  }
                }
              }, 500);
              
              console.log('✅ Final Report - Code executed!');
            }
          } catch (e) {
            console.error('❌ Final Report - Render error:', e);
          }
        }
      }, 100);
    }
  }, [showModal, modalData, result.visualization]);

  // API key 从环境变量读取，不需要 useEffect

  // 新增：节点点击事件
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Clicked node:', node.id);
    
    // Handle Final Report node
    if (node.id === 'final-report') {
      setModalData({ type: 'final', title: '📄 Final Report', content: result });
      setShowModal(true);
      return;
    }
    
    // 检查是否是 agent 节点（任何时候都可以点击查看）
    if (node.id.includes('agent') || node.id.includes('aggregator')) {
      const output = nodeOutputs[node.id];
      
      // 从 node.id 提取 stage 和 agent 信息
      const stageMatch = node.id.match(/stage(\d+)/);
      const stage = stageMatch ? parseInt(stageMatch[1]) : -1;
      const agentMatch = node.id.match(/agent(\d+)/);
      let agentNum = 1; // 默认值
      if (agentMatch && agentMatch[1]) {
        agentNum = parseInt(agentMatch[1], 10);
        // 确保 agentNum 是有效数字
        if (isNaN(agentNum) || agentNum < 1) {
          agentNum = 1;
        }
      }
      
      // 如果没有 output，生成基础 prompt
      let basePrompt = '';
      if (!output && stage >= 0 && stage <= 1) {
        if (stage === 0) {
          basePrompt = getTitlePromptBase(state.dataset, agentNum);
        } else if (stage === 1) {
          basePrompt = getArticlePromptBase(state.dataset, agentNum);
        }
      }
      
      // 即使没有 output，也可以显示 modal（显示 model 和 prompt，input/output 留空）
      setModalData({
        type: 'agent',
        title: output?.agentName || node.data?.label?.split('\n')[0] || 'Agent Details',
        content: output || {
          nodeId: node.id,
          agentName: node.data?.label?.split('\n')[0] || 'Agent',
          output: '',
          timestamp: '',
          stage: stage,
          model: 'gpt-4o-mini',
          prompt: basePrompt,
          input: '',
        },
      });
      setShowModal(true);
      return;
    }
    
    // 检查是否有该节点的输出数据
    const output = nodeOutputs[node.id];
    
    if (output) {
      // 显示 Agent 输出
      setModalData({
        type: 'agent',
        title: output.agentName,
        content: output,
      });
      setShowModal(true);
    } else if (node.id.includes('end')) {
      // 点击 Stage Output 节点
      const stage = parseInt(node.id.replace('stage', '').replace('-end', ''));
      const stageNames = ['Title', 'Article', 'Visualization'];
      const stageResults = [result.title, result.article, result.visualization];
      
      if (stageResults[stage]) {
        setModalData({
          type: 'stage',
          title: `Stage ${stage}: ${stageNames[stage]} - Final Output`,
          content: { stage, result: stageResults[stage] },
        });
        setShowModal(true);
      }
    }
  }, [nodeOutputs, result]);

  // 新增：添加节点输出的辅助函数（通过 AgentInfo 更新）
  const handleAgentComplete = useCallback((info: {
    nodeId: string;
    agentName: string;
    model: string;
    prompt: string;
    input?: string;
    output?: string;
    stage: number;
  }) => {
    const timestamp = new Date().toLocaleTimeString();
    setNodeOutputs(prev => ({
      ...prev,
      [info.nodeId]: { 
        nodeId: info.nodeId, 
        agentName: info.agentName, 
        output: info.output || '', 
        timestamp, 
        stage: info.stage,
        model: info.model,
        prompt: info.prompt,
        input: info.input
      }
    }));
  }, []);



  useEffect(() => {
    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    for (let stage = 0; stage < 3; stage++) {
      const stageNodes = generateNodes(stage, state.strategies[stage]);
      const stageEdges = generateEdges(stage, state.strategies[stage]);
      allNodes.push(...stageNodes);
      allEdges.push(...stageEdges);

      if (stage < 2) {
        allEdges.push({
          id: `e-connect-${stage}-${stage + 1}`,
          source: `stage${stage}-end`,
          target: `stage${stage + 1}-start`,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          animated: true,
          style: { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }
    }

    // 只有在 stage 2 完成后（有 visualization 结果）才显示 final report
    if (result.visualization) {
      allNodes.push(...generateFinalNodes());
      allEdges.push(...generateFinalEdges());
    }

    setNodes(allNodes);
    setEdges(allEdges);
  }, [state.strategies, result.visualization, setNodes, setEdges]);

  useEffect(() => {
    if (state.currentStage === -1) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id.startsWith(`stage${state.currentStage}`)) return { ...node, style: { ...node.style, ...nodeStyles.running } };
        else if (state.currentStage > 0 && node.id.startsWith(`stage${state.currentStage - 1}`)) return { ...node, style: { ...node.style, ...nodeStyles.completed } };
        return node;
      })
    );
  }, [state.currentStage, setNodes]);

  const runWorkflow = async () => {
    if (isRunningRef.current || !state.apiKey) {
      if (!state.apiKey) {
        setError('API Key not found. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your .env file.');
        return;
      }
      return;
    }
    isRunningRef.current = true;
    setState((s) => ({ ...s, running: true, currentStage: 0 }));
    setResult({});
    setError('');
    setProgress('Starting workflow...');
    setNodeOutputs({}); // 清空之前的输出

    try {
      // 加载 CSV 数据
      setProgress('📂 Loading dataset...');
      const rawCSVData = await loadCSVData(state.dataset);
      const csvData = aggregateCSVData(state.dataset, rawCSVData);
      console.log(`✅ Loaded ${rawCSVData.length} rows from ${state.dataset}.csv, aggregated to ${csvData.length} groups`);
      
      let title = '', article = '', visualization: any = null;

      // Stage 0: Title
      setState((s) => ({ ...s, currentStage: 0 }));
      setProgress('🔄 Stage 0: Generating title...');

      if (state.strategies[0] === 'voting') {
        title = await runVotingStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 0,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else if (state.strategies[0] === 'sequential') {
        title = await runSequentialStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 0,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else {
        title = await runSingleAgentStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 0,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      }

      setResult((prev) => ({ ...prev, title }));
      setProgress('✅ Stage 0 complete');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 1: Writing
      setState((s) => ({ ...s, currentStage: 1 }));
      setProgress('🔄 Stage 1: Writing article...');

      if (state.strategies[1] === 'voting') {
        article = await runVotingStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 1, 
          previousOutput: title,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else if (state.strategies[1] === 'sequential') {
        article = await runSequentialStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 1, 
          previousOutput: title,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else {
        article = await runSingleAgentStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 1, 
          previousOutput: title,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      }

      setResult((prev) => ({ ...prev, title, article }));
      setProgress('✅ Stage 1 complete');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 2: Visualization
      setState((s) => ({ ...s, currentStage: 2 }));
      setProgress('🔄 Stage 2: Creating visualization...');
      console.log('\n📊 ========== STAGE 2: VISUALIZATION ==========');
      console.log('Dataset:', state.dataset);
      console.log('Strategy:', state.strategies[2]);

      let vizResult = '';
      if (state.strategies[2] === 'voting') {
        vizResult = await runVotingStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 2, 
          previousOutput: article,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else if (state.strategies[2] === 'sequential') {
        vizResult = await runSequentialStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 2, 
          previousOutput: article,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      } else {
        vizResult = await runSingleAgentStrategy({ 
          apiKey: state.apiKey, 
          dataset: state.dataset, 
          biasLevel: '', 
          stage: 2, 
          previousOutput: article,
          csvData,
          onAgentComplete: handleAgentComplete,
          onLog: (msg) => console.log(msg)
        });
      }

      console.log('📄 Raw Viz Result Length:', vizResult?.length || 0);
      console.log('📄 Raw Viz Result (first 500 chars):\n', vizResult?.substring(0, 500));

      // Store the code as-is (it's executable JavaScript with vegaEmbed)
      visualization = vizResult; // Don't parse, just store the code
      console.log('✅ Visualization code stored successfully!');

      setResult((prev) => ({ ...prev, title, article, visualization }));
      setProgress('✅ All stages complete!');
    } catch (err: any) {
      console.error('❌ [Workflow] Error:', err);
      setError(err.message);
      setProgress('❌ Error occurred');
    } finally {
      setState((s) => ({ ...s, running: false, currentStage: -1 }));
      isRunningRef.current = false;
    }
  };


  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fa', overflow: 'hidden' }}>

      {/* Node Details Modal */}
      {showModal && modalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>{modalData.title}</h2>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>✕ Close</button>
            </div>

            {modalData.type === 'agent' && (
              <div>
                {/* Model */}
                {modalData.content.model && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>MODEL:</h3>
                    <div style={{ 
                      padding: '12px', 
                      background: '#f9fafb', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: '#1f2937'
                    }}>
                      {modalData.content.model}
                    </div>
                  </div>
                )}

                {/* System Prompt */}
                {modalData.content.prompt && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>SYSTEM PROMPT:</h3>
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                      <div
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          lineHeight: '1.6',
                          background: 'white',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowY: 'auto',
                          maxHeight: '260px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {modalData.content.prompt}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>INPUT:</h3>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        lineHeight: '1.6',
                        background: modalData.content.input ? 'white' : '#f9fafb',
                        color: modalData.content.input ? '#1f2937' : '#9ca3af',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowY: 'auto',
                        maxHeight: '200px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {modalData.content.input || 'No input yet...'}
                    </div>
                  </div>
                </div>

                {/* Output */}
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>OUTPUT:</h3>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        lineHeight: '1.6',
                        background: modalData.content.output ? 'white' : '#f9fafb',
                        color: modalData.content.output ? '#1f2937' : '#9ca3af',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowY: 'auto',
                        maxHeight: '260px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {modalData.content.output || 'No output yet...'}
                    </div>
                  </div>
                </div>

                {/* Timestamp */}
                {modalData.content.timestamp && (
                  <p style={{ marginTop: '16px', fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
                    Timestamp: {modalData.content.timestamp}
                  </p>
                )}
              </div>
            )}

            {modalData.type === 'stage' && (
              <div>
                {modalData.content.stage === 2 && modalData.content.result ? (
                  <>
                    <div style={{ width: '100%', marginBottom: '16px', overflow: 'hidden' }}>
                      <div id="vega-chart-modal" style={{ width: '100%', minHeight: '400px', padding: '20px', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}></div>
                    </div>
                    {(() => {
                      try {
                        console.log('\n🎨 ========== RENDERING IN MODAL ==========');
                        console.log('📦 vegaEmbed available?', typeof (window as any).vegaEmbed);
                        
                        const container = document.getElementById('vega-chart-modal');
                        console.log('📦 Container found?', !!container);
                        
                        if (container) {
                          container.innerHTML = ''; // Clear previous content
                          
                          let code = '';
                          if (typeof modalData.content.result === 'string') {
                            // 清理代码：移除 markdown 代码块标记和 TypeScript 类型注解
                            code = modalData.content.result
                              .replace(/```javascript/gi, '')
                              .replace(/```json/gi, '')
                              .replace(/```/g, '')
                              .replace(/const\s+(\w+):\s*any\s*=/g, 'const $1 =')  // 移除 TypeScript 类型注解
                              .replace(/const\s+(\w+):\s*\{[\s\S]*?\}\s*=/g, 'const $1 =')  // 移除复杂类型注解
                              .replace(/#vega-chart/g, '#vega-chart-modal')
                              .trim();
                            
                            // 提取 spec 并移除固定宽度，添加 autosize
                            code = code.replace(
                              /(const\s+spec\s*=\s*\{[\s\S]*?\});[\s\S]*?vegaEmbed\(['"]#vega-chart-modal['"],\s*spec/,
                              (match, specDef) => {
                                // 移除 spec 中的固定 width 设置
                                let cleanedSpec = specDef
                                  .replace(/"width"\s*:\s*\d+/g, '')  // 移除根级别的 width
                                  .replace(/width\s*:\s*\d+/g, '')    // 移除其他 width
                                  .replace(/,(\s*[,}])/g, '$1')       // 清理多余的逗号
                                  .replace(/,\s*,/g, ',');            // 清理双逗号
                                
                                // 确保 spec 有 autosize 配置
                                if (!cleanedSpec.includes('autosize')) {
                                  cleanedSpec = cleanedSpec.replace(/(\$schema[^,]+),/, `$1,\n  "autosize": {"type": "fit", "contains": "padding"},`);
                                }
                                
                                return cleanedSpec + ';\nvegaEmbed(\'#vega-chart-modal\', spec, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })';
                              }
                            );
                            
                            // 如果没有匹配到，直接修改 vegaEmbed 调用
                            if (!code.includes('autosize')) {
                              code = code.replace(
                                /vegaEmbed\(['"]#vega-chart-modal['"],\s*([^,]+),\s*\{([^}]*)\}\)/,
                                (match, spec, options) => {
                                  return `vegaEmbed('#vega-chart-modal', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                                }
                              );
                            }
                          } else {
                            // 如果是对象，移除宽度并添加 autosize
                            const spec = JSON.parse(JSON.stringify(modalData.content.result));
                            delete spec.width;
                            if (spec.spec) delete spec.spec.width;
                            if (spec.config && spec.config.view) delete spec.config.view.width;
                            spec.autosize = { type: 'fit', contains: 'padding' };
                            
                            code = `(window.vegaEmbed || window.vegaEmbed)('#vega-chart-modal', ${JSON.stringify(spec)}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
                          }
                          
                          console.log('📄 Code to execute (first 300 chars):\n', code.substring(0, 300));
                          console.log('📄 Full code:\n', code);
                          
                          // Execute the code
                          if (code) {
                            console.log('⚡ Executing code with eval...');
                            try {
                              eval(code);
                            } catch (evalError: any) {
                              console.error('❌ Eval error:', evalError);
                              console.error('❌ Problematic code (last 200 chars):', code.substring(Math.max(0, code.length - 200)));
                              throw evalError;
                            }
                            
                            // 等待图表渲染后，检查是否需要缩放
                            setTimeout(() => {
                              const chartElement = container.querySelector('svg, canvas, div.vega-embed');
                              if (chartElement) {
                                const containerWidth = container.clientWidth - 40; // 减去 padding
                                const chartWidth = (chartElement as HTMLElement).scrollWidth || (chartElement as HTMLElement).offsetWidth;
                                
                                if (chartWidth > containerWidth) {
                                  const scale = containerWidth / chartWidth;
                                  (chartElement as HTMLElement).style.transform = `scale(${scale})`;
                                  (chartElement as HTMLElement).style.transformOrigin = 'top left';
                                  (chartElement as HTMLElement).style.width = `${chartWidth}px`;
                                  (chartElement as HTMLElement).style.height = `${(chartElement as HTMLElement).scrollHeight}px`;
                                  container.style.height = `${(chartElement as HTMLElement).scrollHeight * scale + 40}px`;
                                  console.log(`✅ Chart scaled to ${(scale * 100).toFixed(1)}% to fit container`);
                                }
                              }
                            }, 500);
                            
                            console.log('✅ eval() completed without errors');
                          }
                          
                          // Check if anything was rendered
                          setTimeout(() => {
                            console.log('🔍 Container innerHTML after 1s:', container.innerHTML.substring(0, 200));
                            console.log('🔍 Container children count:', container.children.length);
                          }, 1000);
                        }
                      } catch (e) {
                        console.error('❌ Error executing Vega-Lite code:', e);
                        console.error('❌ Error stack:', (e as Error).stack);
                        return <div style={{ color: '#ef4444', padding: '20px' }}>
                          Failed to render: {(e as Error).message}
                          <br/>
                          <small>Check console for details</small>
                        </div>;
                      }
                      return null;
                    })()}
                    <details style={{ marginTop: '16px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#667eea', padding: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
                        🔍 Show Vega-Lite Code
                      </summary>
                      <pre style={{ marginTop: '12px', padding: '16px', background: '#1a1a2e', color: '#16c784', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', maxHeight: '400px', fontFamily: 'monospace', lineHeight: '1.5' }}>
                        {typeof modalData.content.result === 'string' ? modalData.content.result : JSON.stringify(modalData.content.result, null, 2)}
                      </pre>
                    </details>
                  </>
                ) : (
                  <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{JSON.stringify(modalData.content.result, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {modalData.type === 'final' && (
              <div>
                {result.title && (
                  <div style={{ marginBottom: '16px', padding: '16px', background: '#fff7ed', borderLeft: '4px solid #f59e0b', borderRadius: '6px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ea580c', marginBottom: '8px' }}>📌 Title</h3>
                    <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>{result.title}</p>
                  </div>
                )}
                {result.article && (
                  <div style={{ marginBottom: '16px', padding: '16px', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '6px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb', marginBottom: '8px' }}>📝 Article</h3>
                    <div 
                      style={{ fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: result.article }}
                    />
                  </div>
                )}
                {result.visualization && (
                  <div style={{ padding: '16px', background: '#f0fdf4', borderLeft: '4px solid #10b981', borderRadius: '6px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#059669', marginBottom: '12px' }}>📊 Visualization</h3>
                    <div style={{ width: '100%', marginBottom: '12px', overflow: 'hidden' }}>
                      <div id="vega-chart-final" style={{ width: '100%', minHeight: '400px', padding: '20px', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}></div>
                    </div>
                    {(() => {
                      try {
                        const container = document.getElementById('vega-chart-final');
                        if (container && result.visualization) {
                          container.innerHTML = '';
                          
                          let code = '';
                          if (typeof result.visualization === 'string') {
                            // 清理代码：移除 markdown 代码块标记和 TypeScript 类型注解
                            code = result.visualization
                              .replace(/```javascript/gi, '')
                              .replace(/```json/gi, '')
                              .replace(/```/g, '')
                              .replace(/const\s+(\w+):\s*any\s*=/g, 'const $1 =')  // 移除 TypeScript 类型注解
                              .replace(/const\s+(\w+):\s*\{[\s\S]*?\}\s*=/g, 'const $1 =')  // 移除复杂类型注解
                              .replace(/#vega-chart/g, '#vega-chart-final')
                              .trim();
                            
                            // 提取 spec 并移除固定宽度，添加 autosize
                            code = code.replace(
                              /(const\s+spec\s*=\s*\{[\s\S]*?\});[\s\S]*?vegaEmbed\(['"]#vega-chart-final['"],\s*spec/,
                              (match, specDef) => {
                                // 移除 spec 中的固定 width 设置
                                let cleanedSpec = specDef
                                  .replace(/"width"\s*:\s*\d+/g, '')  // 移除根级别的 width
                                  .replace(/width\s*:\s*\d+/g, '')    // 移除其他 width
                                  .replace(/,(\s*[,}])/g, '$1')       // 清理多余的逗号
                                  .replace(/,\s*,/g, ',');            // 清理双逗号
                                
                                // 确保 spec 有 autosize 配置
                                if (!cleanedSpec.includes('autosize')) {
                                  cleanedSpec = cleanedSpec.replace(/(\$schema[^,]+),/, `$1,\n  "autosize": {"type": "fit", "contains": "padding"},`);
                                }
                                
                                return cleanedSpec + ';\nvegaEmbed(\'#vega-chart-final\', spec, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })';
                              }
                            );
                            
                            // 如果没有匹配到，直接修改 vegaEmbed 调用
                            if (!code.includes('autosize')) {
                              code = code.replace(
                                /vegaEmbed\(['"]#vega-chart-final['"],\s*([^,]+),\s*\{([^}]*)\}\)/,
                                (match, spec, options) => {
                                  return `vegaEmbed('#vega-chart-final', ${spec}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true })`;
                                }
                              );
                            }
                          } else {
                            // 如果是对象，移除宽度并添加 autosize
                            const spec = JSON.parse(JSON.stringify(result.visualization));
                            delete spec.width;
                            if (spec.spec) delete spec.spec.width;
                            if (spec.config && spec.config.view) delete spec.config.view.width;
                            spec.autosize = { type: 'fit', contains: 'padding' };
                            
                            code = `(window.vegaEmbed || window.vegaEmbed)('#vega-chart-final', ${JSON.stringify(spec)}, { renderer: "canvas", actions: false, autosize: { type: "fit", contains: "padding" }, resize: true });`;
                          }
                          
                          if (code) {
                            eval(code);
                            
                            // 等待图表渲染后，检查是否需要缩放
                            setTimeout(() => {
                              const chartElement = container.querySelector('svg, canvas, div.vega-embed');
                              if (chartElement) {
                                const containerWidth = container.clientWidth - 40; // 减去 padding
                                const chartWidth = (chartElement as HTMLElement).scrollWidth || (chartElement as HTMLElement).offsetWidth;
                                
                                if (chartWidth > containerWidth) {
                                  const scale = containerWidth / chartWidth;
                                  (chartElement as HTMLElement).style.transform = `scale(${scale})`;
                                  (chartElement as HTMLElement).style.transformOrigin = 'top left';
                                  (chartElement as HTMLElement).style.width = `${chartWidth}px`;
                                  (chartElement as HTMLElement).style.height = `${(chartElement as HTMLElement).scrollHeight}px`;
                                  container.style.height = `${(chartElement as HTMLElement).scrollHeight * scale + 40}px`;
                                  console.log(`✅ Chart scaled to ${(scale * 100).toFixed(1)}% to fit container`);
                                }
                              }
                            }, 500);
                            
                            console.log('✅ Vega-Lite rendered in Final Report');
                          }
                        }
                      } catch (e) {
                        console.error('❌ Error rendering in Final Report:', e);
                        return <div style={{ color: '#ef4444', padding: '12px', background: '#fee2e2', borderRadius: '4px', marginTop: '8px' }}>
                          Failed to render: {(e as Error).message}
                          <br />
                          <small style={{ color: '#991b1b' }}>Check console for details</small>
                        </div>;
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '12px 20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            🔬 AgentFlow
          </h1>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ width: '400px', background: 'white', boxShadow: '2px 0 8px rgba(0,0,0,0.05)', overflowY: 'auto', overflowX: 'hidden', flexShrink: 0, boxSizing: 'border-box' }}>
          {/* Config Panel */}
          <ConfigPanel
            dataset={state.dataset}
            strategies={state.strategies}
            running={state.running}
            progress={progress}
            error={error}
            onDatasetChange={(dataset) => setState((s) => ({ ...s, dataset }))}
            onStrategyChange={(stage, strategy) => {
              setState((s) => {
                const newStrategies = [...s.strategies] as [Strategy, Strategy, Strategy];
                newStrategies[stage] = strategy;
                return { ...s, strategies: newStrategies };
              });
            }}
            onRun={runWorkflow}
            onReset={() => {
              setState({
                dataset: 'baseball',
                strategies: ['voting', 'sequential', 'single'],
                currentStage: -1,
                running: false,
                apiKey: apiKey,
              });
              setResult({});
              setError('');
              setProgress('');
              setNodeOutputs({});
              isRunningRef.current = false;
            }}
          />
        </div>

        {/* ReactFlow (Full Screen) */}
        <div style={{ flex: 1, background: 'white', minWidth: 0, overflow: 'hidden', minHeight: 0 }}>
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}