/**
 * useSceneDetection - 场景检测自定义 Hook
 * 
 * 负责：
 * - 场景检测逻辑
 * - 规则引擎初始化
 * - 场景建议管理
 */

import { useState, useEffect, useCallback } from 'react';
import { useSceneStore } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import { silentContextEngine } from '../sensors';
import { ruleEngine, SceneExecutor } from '../rules';
import { sceneSuggestionManager } from '../services/SceneSuggestionManager';
import { notificationManager } from '../notifications';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import type { SilentContext, SceneSuggestionPackage, SuggestionExecutionResult } from '../types';

export interface UseSceneDetectionReturn {
  // 状态
  isDetecting: boolean;
  detectionError: string | null;
  currentContext: SilentContext | null;
  sceneSuggestion: SceneSuggestionPackage | null;
  loadingSuggestion: boolean;

  // 方法
  detectScene: () => Promise<void>;
  loadSceneSuggestion: (context: SilentContext) => Promise<void>;
  executeSceneActions: (context: SilentContext) => Promise<void>;
  executeSuggestion: (suggestion: SceneSuggestionPackage) => Promise<SuggestionExecutionResult | null>;
}

const sceneNames: Record<string, string> = {
  COMMUTE: '通勤模式',
  OFFICE: '办公模式',
  HOME: '到家模式',
  STUDY: '学习模式',
  SLEEP: '睡前模式',
  TRAVEL: '出行模式',
  UNKNOWN: '未知场景',
};

export function useSceneDetection(): UseSceneDetectionReturn {
  // 使用 useShallow 避免选择器返回新对象导致的无限循环
  const {
    currentContext,
    setCurrentContext,
    setIsDetecting,
    setDetectionError,
    addToHistory,
    isDetecting,
    detectionError,
  } = useSceneStore(
    useShallow(state => ({
      currentContext: state.currentContext,
      setCurrentContext: state.setCurrentContext,
      setIsDetecting: state.setIsDetecting,
      setDetectionError: state.setDetectionError,
      addToHistory: state.addToHistory,
      isDetecting: state.isDetecting,
      detectionError: state.detectionError,
    }))
  );

  const [sceneSuggestion, setSceneSuggestion] = useState<SceneSuggestionPackage | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化
  useEffect(() => {
    const init = async () => {
      await initializeRuleEngine();
      await initializeSceneSuggestionManager();
      await initializeNotifications();
      setIsInitialized(true);
    };
    init();
  }, []);

  const initializeRuleEngine = async () => {
    try {
      await ruleEngine.loadRules();
      console.log('[useSceneDetection] Rule engine initialized with', ruleEngine.getRules().length, 'rules');
    } catch (error) {
      console.error('[useSceneDetection] Failed to initialize rule engine:', error);
    }
  };

  const initializeSceneSuggestionManager = async () => {
    try {
      await sceneSuggestionManager.initialize();
      console.log('[useSceneDetection] SceneSuggestionManager initialized');
    } catch (error) {
      console.warn('[useSceneDetection] Failed to initialize SceneSuggestionManager:', error);
    }
  };

  const initializeNotifications = async () => {
    const success = await notificationManager.initialize();
    if (!success) {
      console.warn('[useSceneDetection] Failed to initialize notifications');
    }
  };

  const loadSceneSuggestion = useCallback(async (context: SilentContext) => {
    setLoadingSuggestion(true);
    try {
      const suggestion = await sceneSuggestionManager.getSuggestionByContext(context, {
        includeSystemAdjustments: true,
        includeAppLaunches: true,
        includeFallbackNotes: false,
        minConfidence: 0.3,
        // 🚀 启用动态 AI 建议功能
        enableDynamicSuggestions: true,
      });
      setSceneSuggestion(suggestion);
      console.log('[useSceneDetection] Loaded scene suggestion:', suggestion?.sceneId, 
        suggestion?.dynamicNotes ? '(含动态建议)' : '(静态配置)');
    } catch (error) {
      console.warn('[useSceneDetection] Failed to load scene suggestion:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  }, []);

  const executeSceneActions = useCallback(async (context: SilentContext) => {
    try {
      const matchedRules = await ruleEngine.matchRules(context);

      if (matchedRules.length === 0) {
        console.log('[useSceneDetection] No rules matched for context:', context.context);
        return;
      }

      console.log('[useSceneDetection] Matched', matchedRules.length, 'rule(s)');

      const bestRule = matchedRules[0];
      console.log('[useSceneDetection] Executing rule:', bestRule.rule.id, 'score:', bestRule.score);

      const executor = new SceneExecutor();
      const results = await executor.execute(bestRule.rule.actions);

      const successCount = results.filter(r => r.success).length;
      console.log('[useSceneDetection] Execution results:', successCount, '/', results.length, 'actions succeeded');
    } catch (error) {
      console.error('[useSceneDetection] Error executing scene actions:', error);
    }
  }, []);

  const showSceneNotification = useCallback(async (context: SilentContext) => {
    await notificationManager.showSceneSuggestion({
      sceneType: context.context,
      title: `检测到${sceneNames[context.context]}`,
      body: `置信度: ${(context.confidence * 100).toFixed(0)}%`,
      actions: [],
      confidence: context.confidence,
    });
  }, []);

  const detectScene = useCallback(async () => {
    setIsDetecting(true);
    setDetectionError(null);
    setSceneSuggestion(null);

    try {
      const context = await silentContextEngine.getContext();
      setCurrentContext(context);

      // 添加到历史
      addToHistory({
        sceneType: context.context,
        timestamp: Date.now(),
        confidence: context.confidence,
        triggered: false,
        userAction: null,
      });

      // 获取场景建议包
      await loadSceneSuggestion(context);

      // 注意：不再自动执行场景动作，而是等待用户确认
      // 如需自动执行，用户需要在设置中启用
      // await executeSceneActions(context);

      // 显示通知（如果置信度足够高）
      if (context.confidence > 0.5) {
        await showSceneNotification(context);
      }
    } catch (error) {
      console.error('[useSceneDetection] Scene detection error:', error);
      setDetectionError((error as Error).message);
    } finally {
      setIsDetecting(false);
    }
  }, [
    setIsDetecting,
    setDetectionError,
    setCurrentContext,
    addToHistory,
    loadSceneSuggestion,
    executeSceneActions,
    showSceneNotification,
  ]);

  const executeSuggestion = useCallback(async (suggestion: SceneSuggestionPackage): Promise<SuggestionExecutionResult | null> => {
    try {
      const result = await sceneSuggestionManager.executeSuggestion(
        suggestion.sceneId,
        'execute',
        {
          showProgress: true,
          autoFallback: true,
        }
      );

      // 记录到历史
      addToHistory({
        sceneType: result.sceneId,
        timestamp: Date.now(),
        confidence: currentContext?.confidence ?? 0.7,
        triggered: true,
        userAction: result.success ? 'accept' : 'cancel',
      });

      // 记录用户反馈到预测触发器
      predictiveTrigger.recordFeedback(result.sceneId, result.success ? 'accept' : 'cancel');

      return result;
    } catch (error) {
      console.error('[useSceneDetection] Execute suggestion failed:', error);
      return null;
    }
  }, [addToHistory, currentContext]);

  return {
    isDetecting,
    detectionError,
    currentContext,
    sceneSuggestion,
    loadingSuggestion,
    detectScene,
    loadSceneSuggestion,
    executeSceneActions,
    executeSuggestion,
  };
}

export default useSceneDetection;
