// lib/csvLoader.ts - CSV 数据读取工具

import { Dataset } from './prompts';

export interface CSVRow {
  [key: string]: string | number;
}

/**
 * 从 public/data 目录读取 CSV 文件
 */
export async function loadCSVData(dataset: Dataset): Promise<CSVRow[]> {
  const csvPath = `/data/${dataset}.csv`;
  
  try {
    const response = await fetch(csvPath);
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV for ${dataset}:`, error);
    return [];
  }
}

/**
 * 解析 CSV 文本为对象数组
 */
function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  // 第一行是 header
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const row: CSVRow = {};
    headers.forEach((header, idx) => {
      const value = values[idx].trim();
      // 尝试转换为数字
      const numValue = parseFloat(value);
      row[header] = isNaN(numValue) ? value : numValue;
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * 将原始 CSV 数据转换为可视化用的聚合数据格式
 */
export function aggregateCSVData(dataset: Dataset, csvData: CSVRow[]): any[] {
  if (dataset === 'baseball') {
    return aggregateBaseballData(csvData);
  } else {
    return aggregateKidneyData(csvData);
  }
}

/**
 * 聚合 Baseball 数据
 */
function aggregateBaseballData(csvData: CSVRow[]): any[] {
  const counts: Record<string, number> = {};
  
  csvData.forEach(row => {
    const player = String(row.player).trim();
    const year = String(Math.round(Number(row.year))).trim();
    const isHit = Number(row.is_hit) === 1 ? 'Hit' : 'Miss';
    
    const key = `${player}|${year}|${isHit}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  const result: any[] = [];
  Object.entries(counts).forEach(([key, count]) => {
    const [player, year, is_hit] = key.split('|');
    result.push({ player, year, is_hit, count });
  });
  
  return result;
}

/**
 * 聚合 Kidney 数据
 */
function aggregateKidneyData(csvData: CSVRow[]): any[] {
  const counts: Record<string, number> = {};
  
  csvData.forEach(row => {
    const treatment = String(row.treatment).trim();
    const size = String(row.stone_size).trim();
    const success = Number(row.success) === 1 ? 'success' : 'failure';
    
    const key = `${treatment}|${size}|${success}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  const result: any[] = [];
  Object.entries(counts).forEach(([key, count]) => {
    const [treatment, size, success] = key.split('|');
    result.push({ treatment, size, success, count });
  });
  
  return result;
}
