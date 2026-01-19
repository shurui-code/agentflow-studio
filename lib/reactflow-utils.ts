// lib/reactflow-utils.ts - ReactFlow 节点和边生成

import { Node, Edge } from 'reactflow';
import { Strategy } from '../types';

const nodeStyles = {
  default: { background: '#fff', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e0e0e0', borderRadius: '8px', padding: '10px', cursor: 'pointer' },
  running: { background: '#f5f7ff', borderWidth: '2px', borderStyle: 'solid', borderColor: '#667eea', boxShadow: '0 0 20px rgba(102, 126, 234, 0.4)', cursor: 'pointer' },
  completed: { background: '#f0fdf4', borderWidth: '2px', borderStyle: 'solid', borderColor: '#10b981', cursor: 'pointer' },
  clickable: { cursor: 'pointer', transition: 'all 0.2s' },
};

const stageColors = { 0: '#f59e0b', 1: '#3b82f6', 2: '#10b981' };

/**
 * 生成指定 stage 的节点
 */
export function generateNodes(
  stage: number, 
  strategy: Strategy
): Node[] {
  const baseY = stage * 350 + 50;
  const stageNames = ['📝 Title', '✍️ Writing', '📊 Visualization'];

  if (strategy === 'voting') {
    return [
      { 
        id: `stage${stage}-start`, 
        data: { label: `${stageNames[stage]}\n[Voting]` }, 
        position: { x: 100, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          background: '#f3f4f6', 
          fontWeight: 'bold', 
          borderColor: stageColors[stage as keyof typeof stageColors], 
          borderWidth: '3px' 
        } 
      },
      
      // Agent 1 - 垂直排列
      { 
        id: `stage${stage}-agent1`, 
        data: { label: '🤖 Agent 1\n[Click to view]' }, 
        position: { x: 300, y: baseY + 20 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      // Agent 2
      { 
        id: `stage${stage}-agent2`, 
        data: { label: '🤖 Agent 2\n[Click to view]' }, 
        position: { x: 300, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      // Agent 3
      { 
        id: `stage${stage}-agent3`, 
        data: { label: '🤖 Agent 3\n[Click to view]' }, 
        position: { x: 300, y: baseY + 180 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      { 
        id: `stage${stage}-aggregator`, 
        data: { label: '🗳️ Vote\nAggregator' }, 
        position: { x: 500, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          background: '#fef3c7', 
          borderColor: stageColors[stage as keyof typeof stageColors], 
          fontWeight: 'bold' 
        } 
      },
      
      { 
        id: `stage${stage}-end`, 
        data: { label: '✅ Output\n[Click to view]' }, 
        position: { x: 700, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
          background: '#f0fdf4', 
          borderColor: stageColors[stage as keyof typeof stageColors] 
        } 
      },
    ];
  } else if (strategy === 'sequential') {
    return [
      { 
        id: `stage${stage}-start`, 
        data: { label: `${stageNames[stage]}\n[Sequential]` }, 
        position: { x: 100, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          background: '#f3f4f6', 
          fontWeight: 'bold', 
          borderColor: stageColors[stage as keyof typeof stageColors], 
          borderWidth: '3px' 
        } 
      },
      
      // Agent 1
      { 
        id: `stage${stage}-agent1`, 
        data: { label: '🤖 Agent 1\n(Generate)\n[Click]' }, 
        position: { x: 300, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      // Agent 2
      { 
        id: `stage${stage}-agent2`, 
        data: { label: '🤖 Agent 2\n(Refine)\n[Click]' }, 
        position: { x: 475, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      // Agent 3
      { 
        id: `stage${stage}-agent3`, 
        data: { label: '🤖 Agent 3\n(Finalize)\n[Click]' }, 
        position: { x: 650, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
        } 
      },
      
      { 
        id: `stage${stage}-end`, 
        data: { label: '✅ Output\n[Click to view]' }, 
        position: { x: 825, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
          background: '#f0fdf4', 
          borderColor: stageColors[stage as keyof typeof stageColors] 
        } 
      },
    ];
  } else {
    // Single agent
    return [
      { 
        id: `stage${stage}-start`, 
        data: { label: `${stageNames[stage]}\n[Single Agent]` }, 
        position: { x: 100, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          background: '#f3f4f6', 
          fontWeight: 'bold', 
          borderColor: stageColors[stage as keyof typeof stageColors], 
          borderWidth: '3px' 
        } 
      },
      
      // Single Agent
      { 
        id: `stage${stage}-agent1`, 
        data: { label: '🤖 Single Agent\n(Complete Task)\n[Click]' }, 
        position: { x: 400, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
          background: '#fef3c7',
        } 
      },
      
      { 
        id: `stage${stage}-end`, 
        data: { label: '✅ Output\n[Click to view]' }, 
        position: { x: 700, y: baseY + 100 }, 
        style: { 
          ...nodeStyles.default, 
          ...nodeStyles.clickable, 
          background: '#f0fdf4', 
          borderColor: stageColors[stage as keyof typeof stageColors] 
        } 
      },
    ];
  }
}

/**
 * 生成指定 stage 的边
 */
export function generateEdges(stage: number, strategy: Strategy): Edge[] {
  const color = stageColors[stage as keyof typeof stageColors];
  
  if (strategy === 'voting') {
    return [
      // Start -> Agents (从 start 的 bottom 到 agents 的 left，三个 agents 垂直排列)
      { id: `e-s${stage}-start-a1`, source: `stage${stage}-start`, target: `stage${stage}-agent1`, sourceHandle: 'bottom', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      { id: `e-s${stage}-start-a2`, source: `stage${stage}-start`, target: `stage${stage}-agent2`, sourceHandle: 'bottom', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      { id: `e-s${stage}-start-a3`, source: `stage${stage}-start`, target: `stage${stage}-agent3`, sourceHandle: 'bottom', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      // Agents -> Aggregator (从 agents 的 right 到 aggregator 的 left)
      { id: `e-s${stage}-a1-agg`, source: `stage${stage}-agent1`, target: `stage${stage}-aggregator`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 2 } },
      { id: `e-s${stage}-a2-agg`, source: `stage${stage}-agent2`, target: `stage${stage}-aggregator`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 2 } },
      { id: `e-s${stage}-a3-agg`, source: `stage${stage}-agent3`, target: `stage${stage}-aggregator`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 2 } },
      // Aggregator -> End (从 aggregator 的 right 到 end 的 left，然后 end 从 bottom 导出)
      { id: `e-s${stage}-agg-end`, source: `stage${stage}-aggregator`, target: `stage${stage}-end`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 3 } },
    ];
  } else if (strategy === 'sequential') {
    return [
      // Start -> Agent 1 (从 start 的 bottom 到 agent1 的 left)
      { id: `e-s${stage}-start-a1`, source: `stage${stage}-start`, target: `stage${stage}-agent1`, sourceHandle: 'bottom', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      // Agent 1 -> Agent 2 (从左到右)
      { id: `e-s${stage}-a1-a2`, source: `stage${stage}-agent1`, target: `stage${stage}-agent2`, sourceHandle: 'right', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      // Agent 2 -> Agent 3 (从左到右)
      { id: `e-s${stage}-a2-a3`, source: `stage${stage}-agent2`, target: `stage${stage}-agent3`, sourceHandle: 'right', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      // Agent 3 -> End (从 agent3 的 right 到 end 的 left，然后 end 从 bottom 导出)
      { id: `e-s${stage}-a3-end`, source: `stage${stage}-agent3`, target: `stage${stage}-end`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 3 } },
    ];
  } else {
    return [
      // Start -> Agent (从 start 的 right 到 agent 的 left)
      { id: `e-s${stage}-start-a1`, source: `stage${stage}-start`, target: `stage${stage}-agent1`, sourceHandle: 'right', targetHandle: 'left', animated: true, style: { stroke: color, strokeWidth: 2 } },
      // Agent -> End (从 agent 的 right 到 end 的 left，然后 end 从 bottom 导出)
      { id: `e-s${stage}-a1-end`, source: `stage${stage}-agent1`, target: `stage${stage}-end`, sourceHandle: 'right', targetHandle: 'left', style: { stroke: color, strokeWidth: 3 } },
    ];
  }
}

/**
 * 生成最终节点（Final Report）
 */
export function generateFinalNodes(): Node[] {
  return [
    { 
      id: 'final-report', 
      data: { label: '📄 Final Report\n[Click to view]' }, 
      position: { x: 400, y: 1200 }, 
      style: { 
        ...nodeStyles.default, 
        ...nodeStyles.clickable, 
        background: '#fef3c7', 
        borderColor: '#f59e0b', 
        borderWidth: '3px', 
        fontWeight: 'bold', 
        fontSize: '15px' 
      } 
    },
  ];
}

/**
 * 生成最终边（连接 Stage 2 到 Final Report）
 */
export function generateFinalEdges(): Edge[] {
  return [
    { id: 'e-s2-final', source: 'stage2-end', target: 'final-report', sourceHandle: 'bottom', targetHandle: 'top', animated: true, style: { stroke: '#f59e0b', strokeWidth: 3 } },
  ];
}