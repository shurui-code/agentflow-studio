// components/TaskPanel.tsx - 任务面板组件

import React from 'react';
import { Task, getTaskProgress } from '../lib/tasks';
import { Dataset } from '../lib/prompts';
import { HallucinationType } from '../lib/hallucination';

type Strategy = 'voting' | 'sequential' | 'single';

interface TaskPanelProps {
  tasks: Task[];
  onApplyTaskConfig: (config: {
    dataset: Dataset;
    hallucinationType: HallucinationType;
    strategies: [Strategy, Strategy, Strategy];
    stageHallucination: { 0: boolean; 1: boolean; 2: boolean };
  }) => void;
}

export function TaskPanel({ tasks, onApplyTaskConfig }: TaskPanelProps) {
  const progress = getTaskProgress(tasks);

  return (
    <div style={{ 
      marginBottom: '20px', 
      padding: '16px', 
      background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
      borderRadius: '8px', 
      border: '2px solid #667eea'
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          💡 Suggested Tasks
        </h3>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: '600',
          color: progress.completed === progress.total ? '#10b981' : '#667eea',
          padding: '4px 12px',
          background: progress.completed === progress.total ? '#d1fae5' : '#e0e7ff',
          borderRadius: '12px'
        }}>
          {progress.completed}/{progress.total}
        </div>
      </div>

      {/* 进度条 */}
      <div style={{ 
        height: '6px', 
        background: '#e5e7eb', 
        borderRadius: '3px', 
        overflow: 'hidden',
        marginBottom: '16px'
      }}>
        <div style={{ 
          height: '100%', 
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          width: `${progress.percentage}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>

      {/* 任务列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              padding: '12px',
              background: task.completed ? '#f0fdf4' : '#ffffff',
              border: task.completed ? '2px solid #10b981' : '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: task.completed ? 'default' : 'pointer',
              transition: 'all 0.2s',
              opacity: task.completed ? 0.8 : 1,
            }}
            onClick={() => !task.completed && onApplyTaskConfig(task.config)}
            onMouseEnter={(e) => {
              if (!task.completed) {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.transform = 'translateX(2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!task.completed) {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              {/* 复选框 */}
              <div style={{ 
                marginTop: '2px',
                fontSize: '18px',
                color: task.completed ? '#10b981' : '#d1d5db'
              }}>
                {task.completed ? '✅' : '⬜'}
              </div>

              {/* 任务内容 */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: task.completed ? '#059669' : '#1f2937',
                  marginBottom: '4px',
                  textDecoration: task.completed ? 'line-through' : 'none'
                }}>
                  Task {task.id}: {task.title}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: task.completed ? '#6b7280' : '#6b7280',
                  marginBottom: '6px'
                }}>
                  {task.description}
                </div>
                
                {/* 配置信息 */}
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px',
                  fontSize: '11px'
                }}>
                  <span style={{ 
                    padding: '2px 8px', 
                    background: '#dbeafe', 
                    color: '#1e40af',
                    borderRadius: '4px'
                  }}>
                    {task.config.dataset === 'baseball' ? '⚾ Baseball' : '🏥 Kidney'}
                  </span>
                  {task.config.hallucinationType && (
                    <span style={{ 
                      padding: '2px 8px', 
                      background: task.config.hallucinationType === 'factual' ? '#fee2e2' : 
                                 task.config.hallucinationType === 'cherry' ? '#fed7aa' : '#f3e8ff',
                      color: task.config.hallucinationType === 'factual' ? '#991b1b' : 
                             task.config.hallucinationType === 'cherry' ? '#9a3412' : '#6b21a8',
                      borderRadius: '4px'
                    }}>
                      {task.config.hallucinationType}
                    </span>
                  )}
                  <span style={{ 
                    padding: '2px 8px', 
                    background: '#e0e7ff', 
                    color: '#3730a3',
                    borderRadius: '4px'
                  }}>
                    {task.config.strategies[0]}
                  </span>
                </div>
              </div>

              {/* 应用按钮 */}
              {!task.completed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyTaskConfig(task.config);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#667eea',
                    background: 'white',
                    border: '1px solid #667eea',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#667eea';
                  }}
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div style={{ 
        marginTop: '12px', 
        padding: '10px',
        background: '#fffbeb',
        borderRadius: '6px',
        fontSize: '11px', 
        color: '#92400e',
        lineHeight: '1.5'
      }}>
        💡 <strong>Tip:</strong> Click "Apply" to auto-configure settings for each task, or explore on your own!
      </div>
    </div>
  );
}