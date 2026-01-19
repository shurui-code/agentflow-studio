// lib/tasks.ts - 任务系统

import { Dataset } from './prompts';
import { HallucinationType } from './hallucination';

type Strategy = 'voting' | 'sequential' | 'single';

export interface Task {
  id: number;
  title: string;
  description: string;
  config: {
    dataset: Dataset;
    hallucinationType: HallucinationType;
    strategies: [Strategy, Strategy, Strategy];
    stageHallucination: { 0: boolean; 1: boolean; 2: boolean };
  };
  completed: boolean;
}

export const SUGGESTED_TASKS: Task[] = [
  {
    id: 1,
    title: "Run a Basic Workflow",
    description: "Test the system without any hallucination",
    config: {
      dataset: 'baseball',
      hallucinationType: '',
      strategies: ['single', 'single', 'single'],
      stageHallucination: { 0: false, 1: false, 2: false },
    },
    completed: false,
  },
  {
    id: 2,
    title: "Test Factual Hallucination",
    description: "See how incorrect statistics affect the output",
    config: {
      dataset: 'baseball',
      hallucinationType: 'factual',
      strategies: ['single', 'single', 'single'],
      stageHallucination: { 0: false, 1: true, 2: false },
    },
    completed: false,
  },
  {
    id: 3,
    title: "Try Cherry-picking Bias",
    description: "Test selective fact presentation on kidney data",
    config: {
      dataset: 'kidney',
      hallucinationType: 'cherry',
      strategies: ['sequential', 'sequential', 'sequential'],
      stageHallucination: { 0: false, 1: true, 2: false },
    },
    completed: false,
  },
];

/**
 * 检查配置是否匹配任务
 */
export function checkTaskCompletion(
  task: Task,
  currentConfig: {
    dataset: Dataset;
    hallucinationType: HallucinationType;
    strategies: [Strategy, Strategy, Strategy];
    stageHallucination: { 0: boolean; 1: boolean; 2: boolean };
  },
  workflowCompleted: boolean
): boolean {
  if (!workflowCompleted) return false;

  return (
    task.config.dataset === currentConfig.dataset &&
    task.config.hallucinationType === currentConfig.hallucinationType &&
    task.config.strategies[0] === currentConfig.strategies[0] &&
    task.config.strategies[1] === currentConfig.strategies[1] &&
    task.config.strategies[2] === currentConfig.strategies[2] &&
    task.config.stageHallucination[0] === currentConfig.stageHallucination[0] &&
    task.config.stageHallucination[1] === currentConfig.stageHallucination[1] &&
    task.config.stageHallucination[2] === currentConfig.stageHallucination[2]
  );
}

/**
 * 获取任务进度
 */
export function getTaskProgress(tasks: Task[]): { 
  completed: number; 
  total: number; 
  percentage: number 
} {
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const percentage = Math.round((completed / total) * 100);
  
  return { completed, total, percentage };
}