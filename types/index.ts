// types/index.ts - 集中的类型定义

import { Dataset } from '../lib/prompts';

export type Strategy = 'voting' | 'sequential' | 'single';

export interface WorkflowState {
  dataset: Dataset;
  strategies: [Strategy, Strategy, Strategy];
  currentStage: number;
  running: boolean;
  apiKey: string;
}

export interface StageResult {
  title?: string;
  article?: string;
  visualization?: any;
}

export interface NodeOutput {
  nodeId: string;
  agentName: string;
  output: string;
  timestamp: string;
  stage: number;
  model?: string;
  prompt?: string;
  input?: string;
}

export interface ModalData {
  type: 'agent' | 'stage' | 'final';
  title: string;
  content: any;
}