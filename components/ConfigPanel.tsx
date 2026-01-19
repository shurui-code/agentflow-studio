// components/ConfigPanel.tsx - 配置面板组件

import React, { useState } from 'react';
import { Dataset } from '../lib/prompts';
import { baseballGroundTruth, kidneyGroundTruth } from '../lib/groundTruth';

type Strategy = 'voting' | 'sequential' | 'single';

interface ConfigPanelProps {
  dataset: Dataset;
  strategies: [Strategy, Strategy, Strategy];
  running: boolean;
  progress: string;
  error: string;
  
  onDatasetChange: (dataset: Dataset) => void;
  onStrategyChange: (stage: number, strategy: Strategy) => void;
  onRun: () => void;
  onReset: () => void;
}

export function ConfigPanel({
  dataset,
  strategies,
  running,
  progress,
  error,
  onDatasetChange,
  onStrategyChange,
  onRun,
  onReset,
}: ConfigPanelProps) {
  const stageNames = ['Title', 'Writing', 'Visualization'];
  const [hoveredDataset, setHoveredDataset] = useState<Dataset | null>(null);
  
  return (
    <div style={{ width: '100%', background: 'white', boxShadow: '2px 0 8px rgba(0,0,0,0.05)', overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>⚙️ Configuration</h2>

      {/* Dataset */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '10px', color: '#374151' }}>📊 Dataset</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            className={`p-2 border-2 rounded transition-all ${dataset === 'baseball' ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 hover:border-purple-300'}`}
            onClick={() => onDatasetChange('baseball')}
            onMouseEnter={() => setHoveredDataset('baseball')}
            onMouseLeave={() => setHoveredDataset(null)}
            style={{ padding: '10px', border: `2px solid ${dataset === 'baseball' ? '#7c3aed' : '#d1d5db'}`, borderRadius: '8px', background: dataset === 'baseball' ? '#7c3aed' : 'white', color: dataset === 'baseball' ? 'white' : '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box' }}
          >
            ⚾ Baseball
          </button>
          <button
            className={`p-2 border-2 rounded transition-all ${dataset === 'kidney' ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 hover:border-purple-300'}`}
            onClick={() => onDatasetChange('kidney')}
            onMouseEnter={() => setHoveredDataset('kidney')}
            onMouseLeave={() => setHoveredDataset(null)}
            style={{ padding: '10px', border: `2px solid ${dataset === 'kidney' ? '#7c3aed' : '#d1d5db'}`, borderRadius: '8px', background: dataset === 'kidney' ? '#7c3aed' : 'white', color: dataset === 'kidney' ? 'white' : '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box' }}
          >
            🏥 Kidney
          </button>
        </div>
        
        {/* Ground Truth Tooltip */}
        {hoveredDataset && (
          <div
            onMouseEnter={() => setHoveredDataset(hoveredDataset)}
            onMouseLeave={() => setHoveredDataset(null)}
            style={{
              position: 'fixed',
              top: '80px',
              left: '360px',
              padding: '20px',
              background: 'white',
              border: '2px solid #667eea',
              borderRadius: '12px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
              zIndex: 10000,
              width: '500px',
              fontSize: '13px',
              lineHeight: '1.8',
              color: '#1f2937',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '12px', color: '#667eea', fontSize: '16px', borderBottom: '2px solid #e0e7ff', paddingBottom: '8px' }}>
              📊 Ground Truth - {hoveredDataset === 'baseball' ? 'Baseball Dataset' : 'Kidney Treatment Dataset'}
            </div>
            <div>
              {hoveredDataset === 'baseball' ? baseballGroundTruth.trim() : kidneyGroundTruth.trim()}
            </div>
          </div>
        )}
      </div>

      {/* Strategies */}
      {stageNames.map((name, idx) => (
        <div key={idx} style={{ marginBottom: '16px', padding: '14px', background: '#f9fafb', borderRadius: '10px', boxSizing: 'border-box' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '10px', color: '#374151' }}>Stage {idx}: {name}</h3>
          
          {/* Strategy Selection */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['voting', 'sequential', 'single'] as Strategy[]).map((strat) => (
              <button
                key={strat}
                className={`flex-1 p-2 text-xs border-2 rounded transition-all ${strategies[idx] === strat ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 hover:border-purple-300'}`}
                onClick={() => onStrategyChange(idx, strat)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: `2px solid ${strategies[idx] === strat ? '#7c3aed' : '#d1d5db'}`,
                  borderRadius: '8px',
                  background: strategies[idx] === strat ? '#7c3aed' : 'white',
                  color: strategies[idx] === strat ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              >
                {strat}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Run Button */}
      <button
        onClick={onRun}
        disabled={running}
        style={{
          width: '100%',
        padding: '16px',
          background: running ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
        borderRadius: '10px',
        fontWeight: '800',
          cursor: running ? 'not-allowed' : 'pointer',
        fontSize: '16px',
          marginBottom: '12px',
        }}
      >
        {running ? '⏳ Running...' : '▶️ Run Workflow'}
      </button>

      {/* Reset Button */}
      <button
        onClick={onReset}
        disabled={running}
        style={{
          width: '100%',
          padding: '12px',
          background: running ? '#9ca3af' : '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: running ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          marginBottom: '12px',
        }}
      >
        🔄 Reset
      </button>

      {/* Progress */}
      {progress && (
        <div style={{ padding: '12px', background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '13px', color: '#1e40af', marginBottom: '12px' }}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Tip */}
      <div style={{ marginTop: '24px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#059669', marginBottom: '8px' }}>💡 Tip</h3>
        <p style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.5', margin: 0 }}>
          Click on any <strong>Agent node</strong> to view its output, or click <strong>Output nodes</strong> to see stage results!
        </p>
      </div>
    </div>
  );
}