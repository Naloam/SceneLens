/**
 * useUserTriggeredAnalysis - 用户触发分析自定义 Hook
 * 
 * 负责：
 * - 音量键双击触发
 * - 桌面快捷方式触发
 * - 用户触发的场景识别
 * - 整合 ML 预测结果与静默上下文
 */

import { useState, useEffect, useCallback } from 'react';
import { DeviceEventEmitter, Alert } from 'react-native';
import { UserTriggeredAnalyzer } from '../core/UserTriggeredAnalyzer';
import { unifiedSceneAnalyzer, UnifiedAnalysisResult } from '../core/UnifiedSceneAnalyzer';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import { useSceneStore } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import type { TriggeredContext, SceneType } from '../types';

// 单例分析器实例
const userTriggeredAnalyzer = new UserTriggeredAnalyzer();

// 场景名称映射
const SCENE_DISPLAY_NAMES: Record<SceneType, string> = {
  COMMUTE: '通勤模式',
  OFFICE: '办公模式',
  HOME: '居家模式',
  STUDY: '学习模式',
  SLEEP: '休息模式',
  TRAVEL: '出行模式',
  UNKNOWN: '未知场景',
};

export interface UseUserTriggeredAnalysisReturn {
  // 状态
  isAnalyzing: boolean;
  triggeredResult: TriggeredContext | null;
  unifiedResult: UnifiedAnalysisResult | null;
  volumeKeyEnabled: boolean;
  shortcutEnabled: boolean;

  // 方法
  analyze: () => Promise<void>;
  toggleVolumeKeyListener: () => Promise<void>;
  toggleDesktopShortcut: () => Promise<void>;
  handleFeedback: (result: TriggeredContext | UnifiedAnalysisResult, action: 'accept' | 'ignore' | 'cancel') => void;
  setTriggeredResult: (result: TriggeredContext | null) => void;
  clearResult: () => void;
}

export function useUserTriggeredAnalysis(): UseUserTriggeredAnalysisReturn {
  // 使用 useShallow 避免不必要的重渲染
  const { addToHistory, setCurrentContext } = useSceneStore(
    useShallow(state => ({
      addToHistory: state.addToHistory,
      setCurrentContext: state.setCurrentContext,
    }))
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triggeredResult, setTriggeredResult] = useState<TriggeredContext | null>(null);
  const [unifiedResult, setUnifiedResult] = useState<UnifiedAnalysisResult | null>(null);
  const [volumeKeyEnabled, setVolumeKeyEnabled] = useState(false);
  const [shortcutEnabled, setShortcutEnabled] = useState(false);

  // 初始化
  useEffect(() => {
    initializeUserTriggeredFeatures();
    subscribeUserTriggeredResults();

    return () => {
      userTriggeredAnalyzer.cleanup();
      DeviceEventEmitter.removeAllListeners('UserTriggeredAnalysisResult');
    };
  }, []);

  const initializeUserTriggeredFeatures = async () => {
    try {
      // 启用音量键双击触发
      const volumeKeySuccess = await userTriggeredAnalyzer.enableVolumeKeyTrigger(true);
      setVolumeKeyEnabled(volumeKeySuccess);
      console.log('[useUserTriggeredAnalysis] 音量键双击触发:', volumeKeySuccess ? '已启用' : '启用失败');

      // 创建桌面快捷方式
      const shortcutSuccess = await userTriggeredAnalyzer.createDesktopShortcut();
      setShortcutEnabled(shortcutSuccess);
      console.log('[useUserTriggeredAnalysis] 桌面快捷方式:', shortcutSuccess ? '已创建' : '创建失败');

      // 启用快捷方式触发监听
      const shortcutListenSuccess = await userTriggeredAnalyzer.enableShortcutTrigger(true);
      setShortcutEnabled(shortcutListenSuccess && shortcutSuccess);
      console.log('[useUserTriggeredAnalysis] 桌面快捷方式监听:', shortcutListenSuccess ? '已启用' : '未启用');

      // 预加载模型
      await userTriggeredAnalyzer.preloadModels();
    } catch (error) {
      console.warn('[useUserTriggeredAnalysis] 初始化用户触发功能失败:', error);
    }
  };

  const subscribeUserTriggeredResults = () => {
    DeviceEventEmitter.removeAllListeners('UserTriggeredAnalysisResult');
    DeviceEventEmitter.addListener('UserTriggeredAnalysisResult', async (payload: any) => {
      if (!payload) return;
      if (payload.ok && payload.result) {
        const rawResult: TriggeredContext = payload.result;
        setTriggeredResult(rawResult);
        
        // 🚀 使用统一场景分析器整合 ML 预测与静默上下文
        try {
          const unified = await unifiedSceneAnalyzer.analyze(rawResult.predictions);
          setUnifiedResult(unified);
          
          // 更新全局上下文状态（用于与 useSceneDetection 共享）
          const silentContext = unifiedSceneAnalyzer.convertToSilentContext(unified);
          setCurrentContext(silentContext);
          
          const sceneName = SCENE_DISPLAY_NAMES[unified.sceneType];
          const notes = unified.personalizedNotes.join('\n');
          
          Alert.alert(
            `🎯 场景识别: ${sceneName}`,
            `${notes}\n\n综合置信度: ${(unified.confidence * 100).toFixed(0)}%`,
            [
              { text: '取消', onPress: () => handleFeedback(unified, 'cancel') },
              { text: '忽略', onPress: () => handleFeedback(unified, 'ignore') },
              { text: '接受', onPress: () => handleFeedback(unified, 'accept') },
            ]
          );
        } catch (error) {
          console.warn('[useUserTriggeredAnalysis] 统一分析失败，使用原始结果:', error);
          const top = rawResult.predictions[0];
          if (top) {
            Alert.alert(
              '🎯 场景识别完成',
              `识别结果: ${top.label}\n置信度: ${(top.score * 100).toFixed(1)}%`,
              [
                { text: '取消', onPress: () => handleFeedback(rawResult, 'cancel') },
                { text: '忽略', onPress: () => handleFeedback(rawResult, 'ignore') },
                { text: '接受', onPress: () => handleFeedback(rawResult, 'accept') },
              ]
            );
          }
        }
      } else if (!payload.ok && payload.error) {
        Alert.alert('识别失败', payload.error);
      }
    });
  };

  const analyze = useCallback(async () => {
    if (isAnalyzing) {
      Alert.alert('提示', '场景识别正在进行中，请稍候...');
      return;
    }

    setIsAnalyzing(true);
    setTriggeredResult(null);
    setUnifiedResult(null);

    try {
      console.log('[useUserTriggeredAnalysis] 开始用户触发的场景识别...');

      const result = await userTriggeredAnalyzer.analyze({
        audioDurationMs: 1000,
        autoCleanup: true,
        maxRetries: 2,
      });

      setTriggeredResult(result);

      // 🚀 使用统一场景分析器整合多源信号
      const unified = await unifiedSceneAnalyzer.analyze(result.predictions);
      setUnifiedResult(unified);
      
      // 同步更新全局上下文状态
      const silentContext = unifiedSceneAnalyzer.convertToSilentContext(unified);
      setCurrentContext(silentContext);

      const sceneName = SCENE_DISPLAY_NAMES[unified.sceneType];
      const notes = unified.personalizedNotes.join('\n');

      Alert.alert(
        `🎯 场景识别: ${sceneName}`,
        `${notes}\n\n综合置信度: ${(unified.confidence * 100).toFixed(0)}%`,
        [
          { text: '取消', onPress: () => handleFeedback(unified, 'cancel') },
          { text: '忽略', onPress: () => handleFeedback(unified, 'ignore') },
          { text: '接受', onPress: () => handleFeedback(unified, 'accept') },
        ]
      );

      // 记录到历史
      addToHistory({
        sceneType: unified.sceneType,
        timestamp: result.timestamp,
        confidence: unified.confidence,
        triggered: true,
        userAction: null,
      });

    } catch (error) {
      console.error('[useUserTriggeredAnalysis] 用户触发分析失败:', error);
      Alert.alert(
        '识别失败',
        `场景识别出错: ${(error as Error).message}`,
        [{ text: '确定' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, addToHistory]);

  const handleFeedback = useCallback((result: TriggeredContext | UnifiedAnalysisResult, action: 'accept' | 'ignore' | 'cancel') => {
    // 判断结果类型
    const isUnified = 'sceneType' in result && 'matchDetails' in result;
    const sceneType = isUnified ? (result as UnifiedAnalysisResult).sceneType : 'UNKNOWN';
    const confidence = isUnified ? (result as UnifiedAnalysisResult).confidence : (result as TriggeredContext).confidence;
    
    console.log('[useUserTriggeredAnalysis] 用户反馈:', action, '场景:', sceneType, '置信度:', confidence);

    // 记录反馈到预测触发器
    predictiveTrigger.recordFeedback(sceneType, action);
    
    // 如果是统一分析结果，同时记录到统一分析器
    if (isUnified) {
      unifiedSceneAnalyzer.recordFeedback(result as UnifiedAnalysisResult, action);
    }

    if (action === 'accept') {
      const sceneName = SCENE_DISPLAY_NAMES[sceneType];
      console.log('[useUserTriggeredAnalysis] 用户接受建议:', sceneName);

      Alert.alert(
        '已接受',
        `已记录您的偏好: ${sceneName}`,
        [{ text: '确定' }]
      );
    }
  }, []);

  const toggleVolumeKeyListener = useCallback(async () => {
    try {
      const newState = !volumeKeyEnabled;
      const success = await userTriggeredAnalyzer.enableVolumeKeyTrigger(newState);
      
      if (success) {
        setVolumeKeyEnabled(newState);
        Alert.alert(
          '设置成功',
          `音量键触发已${newState ? '启用' : '禁用'}`,
          [{ text: '确定' }]
        );
      } else {
        Alert.alert(
          '设置失败',
          '无法切换音量键触发状态',
          [{ text: '确定' }]
        );
      }
    } catch (error) {
      console.error('[useUserTriggeredAnalysis] Toggle volume key listener error:', error);
      Alert.alert(
        '设置失败',
        `切换音量键触发时出错: ${(error as Error).message}`,
        [{ text: '确定' }]
      );
    }
  }, [volumeKeyEnabled]);

  const toggleDesktopShortcut = useCallback(async () => {
    try {
      if (shortcutEnabled) {
        const success = await userTriggeredAnalyzer.removeDesktopShortcut();
        if (success) {
          setShortcutEnabled(false);
          Alert.alert('已删除', '桌面快捷方式已移除');
        }
      } else {
        const success = await userTriggeredAnalyzer.createDesktopShortcut();
        if (success) {
          setShortcutEnabled(true);
          Alert.alert('已创建', '桌面快捷方式已添加，点击即可触发场景识别');
        } else {
          Alert.alert('创建失败', '无法创建桌面快捷方式');
        }
      }
    } catch (error) {
      console.error('[useUserTriggeredAnalysis] 切换桌面快捷方式失败:', error);
      Alert.alert('操作失败', (error as Error).message);
    }
  }, [shortcutEnabled]);

  const clearResult = useCallback(() => {
    setTriggeredResult(null);
    setUnifiedResult(null);
  }, []);

  return {
    isAnalyzing,
    triggeredResult,
    unifiedResult,
    volumeKeyEnabled,
    shortcutEnabled,
    analyze,
    toggleVolumeKeyListener,
    toggleDesktopShortcut,
    handleFeedback,
    setTriggeredResult,
    clearResult,
  };
}

export default useUserTriggeredAnalysis;
