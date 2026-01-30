/**
 * MLStatsStore - AI 模型推理统计存储
 * 
 * 跟踪和持久化 AI 模型的推理统计数据，包括：
 * - 推理次数
 * - 推理耗时
 * - 成功/失败率
 * - 标签分布
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 单次推理记录
 */
export interface InferenceRecord {
  timestamp: number;
  type: 'image' | 'audio';
  duration: number; // 毫秒
  success: boolean;
  topLabel?: string;
  topScore?: number;
  labels?: string[];
}

/**
 * 模型推理统计
 */
export interface ModelInferenceStats {
  totalInferences: number;
  successCount: number;
  failCount: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  lastInference?: InferenceRecord;
  labelDistribution: Record<string, number>;
}

/**
 * 日期统计
 */
export interface DailyStats {
  date: string; // YYYY-MM-DD
  imageInferences: number;
  audioInferences: number;
  avgConfidence: number;
  totalDuration: number;
}

/**
 * Store 状态
 */
interface MLStatsState {
  // 总体统计
  imageStats: ModelInferenceStats;
  audioStats: ModelInferenceStats;
  
  // 近期记录（最近100条）
  recentRecords: InferenceRecord[];
  
  // 日统计（最近30天）
  dailyStats: DailyStats[];
  
  // 操作
  recordInference: (record: Omit<InferenceRecord, 'timestamp'>) => void;
  getStatsForType: (type: 'image' | 'audio') => ModelInferenceStats;
  getRecentRecords: (limit?: number) => InferenceRecord[];
  getDailyStats: (days?: number) => DailyStats[];
  getLabelDistribution: (type: 'image' | 'audio') => Array<{ label: string; count: number; percentage: number }>;
  getAverageConfidence: () => number;
  getTotalInferences: () => number;
  reset: () => void;
}

/**
 * 初始化空统计
 */
const createEmptyStats = (): ModelInferenceStats => ({
  totalInferences: 0,
  successCount: 0,
  failCount: 0,
  totalDuration: 0,
  avgDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  labelDistribution: {},
});

/**
 * 获取今天的日期字符串
 */
const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * ML 统计 Store
 */
export const useMLStatsStore = create<MLStatsState>()(
  persist(
    (set, get) => ({
      imageStats: createEmptyStats(),
      audioStats: createEmptyStats(),
      recentRecords: [],
      dailyStats: [],

      recordInference: (record) => {
        const fullRecord: InferenceRecord = {
          ...record,
          timestamp: Date.now(),
        };

        set((state) => {
          // 更新对应类型的统计
          const statsKey = record.type === 'image' ? 'imageStats' : 'audioStats';
          const currentStats = state[statsKey];
          
          const newStats: ModelInferenceStats = {
            ...currentStats,
            totalInferences: currentStats.totalInferences + 1,
            successCount: currentStats.successCount + (record.success ? 1 : 0),
            failCount: currentStats.failCount + (record.success ? 0 : 1),
            totalDuration: currentStats.totalDuration + record.duration,
            avgDuration: (currentStats.totalDuration + record.duration) / (currentStats.totalInferences + 1),
            minDuration: Math.min(currentStats.minDuration, record.duration),
            maxDuration: Math.max(currentStats.maxDuration, record.duration),
            lastInference: fullRecord,
            labelDistribution: {
              ...currentStats.labelDistribution,
              ...(record.topLabel ? {
                [record.topLabel]: (currentStats.labelDistribution[record.topLabel] || 0) + 1
              } : {}),
            },
          };

          // 更新日统计
          const today = getTodayString();
          const dailyStatsIndex = state.dailyStats.findIndex(d => d.date === today);
          let newDailyStats = [...state.dailyStats];

          if (dailyStatsIndex >= 0) {
            const existing = newDailyStats[dailyStatsIndex];
            newDailyStats[dailyStatsIndex] = {
              ...existing,
              imageInferences: existing.imageInferences + (record.type === 'image' ? 1 : 0),
              audioInferences: existing.audioInferences + (record.type === 'audio' ? 1 : 0),
              avgConfidence: record.topScore 
                ? (existing.avgConfidence * (existing.imageInferences + existing.audioInferences) + record.topScore) 
                  / (existing.imageInferences + existing.audioInferences + 1)
                : existing.avgConfidence,
              totalDuration: existing.totalDuration + record.duration,
            };
          } else {
            newDailyStats.push({
              date: today,
              imageInferences: record.type === 'image' ? 1 : 0,
              audioInferences: record.type === 'audio' ? 1 : 0,
              avgConfidence: record.topScore || 0,
              totalDuration: record.duration,
            });
          }

          // 保留最近30天
          if (newDailyStats.length > 30) {
            newDailyStats = newDailyStats.slice(-30);
          }

          // 更新近期记录
          let newRecentRecords = [fullRecord, ...state.recentRecords];
          if (newRecentRecords.length > 100) {
            newRecentRecords = newRecentRecords.slice(0, 100);
          }

          return {
            ...state,
            [statsKey]: newStats,
            recentRecords: newRecentRecords,
            dailyStats: newDailyStats,
          };
        });
      },

      getStatsForType: (type) => {
        const state = get();
        return type === 'image' ? state.imageStats : state.audioStats;
      },

      getRecentRecords: (limit = 20) => {
        return get().recentRecords.slice(0, limit);
      },

      getDailyStats: (days = 7) => {
        const stats = get().dailyStats;
        return stats.slice(-days);
      },

      getLabelDistribution: (type) => {
        const stats = get().getStatsForType(type);
        const total = Object.values(stats.labelDistribution).reduce((a, b) => a + b, 0);
        
        return Object.entries(stats.labelDistribution)
          .map(([label, count]) => ({
            label,
            count,
            percentage: total > 0 ? count / total : 0,
          }))
          .sort((a, b) => b.count - a.count);
      },

      getAverageConfidence: () => {
        const records = get().recentRecords.filter(r => r.topScore !== undefined);
        if (records.length === 0) return 0;
        return records.reduce((sum, r) => sum + (r.topScore || 0), 0) / records.length;
      },

      getTotalInferences: () => {
        const state = get();
        return state.imageStats.totalInferences + state.audioStats.totalInferences;
      },

      reset: () => {
        set({
          imageStats: createEmptyStats(),
          audioStats: createEmptyStats(),
          recentRecords: [],
          dailyStats: [],
        });
      },
    }),
    {
      name: 'scenelens-ml-stats',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        imageStats: state.imageStats,
        audioStats: state.audioStats,
        recentRecords: state.recentRecords.slice(0, 50), // 只持久化最近50条
        dailyStats: state.dailyStats,
      }),
    }
  )
);

export default useMLStatsStore;
