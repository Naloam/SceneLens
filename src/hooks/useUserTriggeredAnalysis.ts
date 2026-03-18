/**
 * useUserTriggeredAnalysis - 用户触发分析自定义 Hook
 * 
 * 负责：
 * - 音量键双击触发
 * - 桌面快捷方式触发
 * - 用户触发的场景识别
 * - 整合 ML 预测结果与静默上下文
 * 
 * v2.0: 集成 SmartSuggestion 支持增强的规则系统
 * v2.1: 添加 SmartAction 执行支持
 */

import { useState, useEffect, useCallback } from 'react';
import { DeviceEventEmitter, Alert } from 'react-native';
import { UserTriggeredAnalyzer } from '../core/UserTriggeredAnalyzer';
import { unifiedSceneAnalyzer, UnifiedAnalysisResult } from '../core/UnifiedSceneAnalyzer';
import { predictiveTrigger } from '../core/PredictiveTrigger';
import { sceneBridge } from '../core/SceneBridge';
import { SystemSettingsController } from '../automation/SystemSettingsController';
import { resolveDoNotDisturbSettings } from '../automation/systemSettingTransforms';
import type { VolumeStreamType } from '../types/automation';
import { appDiscoveryEngine } from '../discovery/AppDiscoveryEngine';
import { personalizationManager } from '../services/suggestion/PersonalizationManager';
import { useSceneStore, useMLStatsStore } from '../stores';
import { useShallow } from 'zustand/react/shallow';
import type { TriggeredContext, SceneType, AppCategory } from '../types';
import type { SmartSuggestion, SmartAction } from '../services/suggestion';

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

const APP_CATEGORY_INTENT: Record<AppCategory, string | null> = {
  TRANSIT_APP: 'TRANSIT_APP_TOP1',
  MUSIC_PLAYER: 'MUSIC_PLAYER_TOP1',
  PAYMENT_APP: 'PAYMENT_APP_TOP1',
  MEETING_APP: 'MEETING_APP_TOP1',
  STUDY_APP: 'STUDY_APP_TOP1',
  SMART_HOME: 'SMART_HOME_TOP1',
  CALENDAR: 'CALENDAR_TOP1',
  OTHER: null,
};

const APP_CATEGORY_FALLBACK_PACKAGE: Record<AppCategory, string | null> = {
  TRANSIT_APP: 'com.eg.android.AlipayGphone',
  MUSIC_PLAYER: 'com.netease.cloudmusic',
  PAYMENT_APP: 'com.eg.android.AlipayGphone',
  MEETING_APP: 'com.tencent.wework',
  STUDY_APP: 'com.chaoxing.mobile',
  SMART_HOME: 'com.xiaomi.smarthome',
  CALENDAR: 'com.android.calendar',
  OTHER: null,
};

async function resolvePackageByCategory(category: AppCategory): Promise<string | null> {
  const intent = APP_CATEGORY_INTENT[category];

  try {
    if (!appDiscoveryEngine.isInitialized()) {
      await appDiscoveryEngine.initialize();
    }
    if (intent) {
      const resolved = appDiscoveryEngine.resolveIntent(intent);
      if (resolved) return resolved;
    }
  } catch (error) {
    console.warn('[useUserTriggeredAnalysis] App discovery resolve failed:', error);
  }

  return APP_CATEGORY_FALLBACK_PACKAGE[category] ?? null;
}

async function launchAppByCategory(category: AppCategory): Promise<boolean> {
  const packageName = await resolvePackageByCategory(category);
  if (!packageName) return false;

  const isInstalled = await sceneBridge.isAppInstalled(packageName);
  if (!isInstalled) return false;

  return sceneBridge.openAppWithDeepLink(packageName, undefined);
}

function resolveVolumeParams(params: Record<string, any> | undefined): { streamType: VolumeStreamType; levelPercent: number } {
  const rawLevel = typeof params?.level === 'number' ? params.level : 50;
  const levelPercent = rawLevel <= 1 ? Math.round(rawLevel * 100) : Math.round(rawLevel);
  const rawStream = typeof params?.streamType === 'string' ? params.streamType.toLowerCase() : 'media';
  const streamType: VolumeStreamType = ['media', 'ring', 'notification', 'alarm', 'system'].includes(rawStream)
    ? (rawStream as VolumeStreamType)
    : 'media';

  return {
    streamType,
    levelPercent: Math.max(0, Math.min(100, levelPercent)),
  };
}

/**
 * 格式化智能建议消息
 */
function formatSmartSuggestionMessage(suggestion: SmartSuggestion, confidence: number): string {
  const parts: string[] = [];
  
  // 添加副标题
  parts.push(suggestion.subtext);
  
  // 添加推荐操作（最多显示3个）
  if (suggestion.actions.length > 0) {
    parts.push('');
    parts.push('📋 推荐操作:');
    for (const action of suggestion.actions.slice(0, 3)) {
      const reason = action.reason ? ` - ${action.reason}` : '';
      parts.push(`  • ${action.label}${reason}`);
    }
  }
  
  // 添加置信度
  parts.push('');
  parts.push(`置信度: ${(confidence * 100).toFixed(0)}%`);
  
  return parts.join('\n');
}

/**
 * 执行单个 SmartAction
 */
async function executeSmartAction(action: SmartAction): Promise<{ success: boolean; error?: string }> {
  try {
    if (action.type === 'system' && action.action) {
      console.log(`[useUserTriggeredAnalysis] 执行系统动作: ${action.action}`, action.params);
      
      if (action.action === 'setDoNotDisturb') {
        const { enabled, mode } = resolveDoNotDisturbSettings(action.params);
        const success = await SystemSettingsController.setDoNotDisturb(enabled, mode);
        if (!success) {
          return { success: false, error: `鍕挎壈妯″紡璁剧疆澶辫触: enabled=${enabled}, mode=${mode}` };
        }
        console.log(`[useUserTriggeredAnalysis] 勿扰模式已${enabled ? '开启' : '关闭'} (${mode})`);
        return { success: true };
      }

      if (action.action === 'setBrightness') {
        const level = action.params?.level ?? 0.5;
        const success = await SystemSettingsController.setBrightness(level);
        if (!success) {
          return { success: false, error: `浜害璁剧疆澶辫触: ${level}` };
        }
        console.log(`[useUserTriggeredAnalysis] 亮度已调整为 ${level}`);
        return { success: true };
      }

      switch (action.action) {
        case 'setDoNotDisturb':
          return { success: false, error: 'unreachable_legacy_do_not_disturb' };
          console.log(`[useUserTriggeredAnalysis] ✓ 勿扰模式已${action.params?.enable ? '开启' : '关闭'}`);
          break;
          
        case 'setBrightness':
          return { success: false, error: 'unreachable_legacy_brightness' };
          console.log(`[useUserTriggeredAnalysis] ✓ 亮度已调整为 ${action.params?.level ?? 0.5}`);
          break;
          
        case 'setWakeLock':
          await sceneBridge.setWakeLock(
            action.params?.enable ?? false,
            action.params?.timeout ?? 300000
          );
          console.log(`[useUserTriggeredAnalysis] ✓ 唤醒锁已${action.params?.enable ? '开启' : '关闭'}`);
          break;
          
        case 'setVolume':
          {
            const { streamType, levelPercent } = resolveVolumeParams(action.params);
            const success = await SystemSettingsController.setVolume(streamType, levelPercent);
            if (!success) {
              return { success: false, error: `音量设置失败: ${streamType}=${levelPercent}%` };
            }
            console.log(`[useUserTriggeredAnalysis] 音量已设置: ${streamType}=${levelPercent}%`);
          }
          break;
          
        default:
          console.warn(`[useUserTriggeredAnalysis] ⚠ 未知的系统动作: ${action.action}`);
          return { success: false, error: `未知的系统动作: ${action.action}` };
      }
      
      return { success: true };
    } else if (action.type === 'app' && action.appCategory) {
      const success = await launchAppByCategory(action.appCategory);
      if (!success) {
        return { success: false, error: `无法打开应用类别: ${action.appCategory}` };
      }
      return { success: true };
    }
    
    return { success: false, error: '动作不可执行' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[useUserTriggeredAnalysis] ✗ 执行动作失败: ${action.action}`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 执行 SmartSuggestion 中的所有动作
 */
async function executeSmartSuggestionActions(
  suggestion: SmartSuggestion,
  sceneType?: SceneType
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ action: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ action: string; success: boolean; error?: string }> = [];
  
  // 只执行 executable 为 true 的动作
  const executableActions = suggestion.actions.filter(a => a.executable);
  
  console.log(`[useUserTriggeredAnalysis] 开始执行 ${executableActions.length} 个动作`);
  
  for (const action of executableActions) {
    const result = await executeSmartAction(action);
    if (sceneType && action.id) {
      await personalizationManager.recordActionOutcome(sceneType, action.id, result.success);
    }
    results.push({
      action: action.label,
      success: result.success,
      error: result.error,
    });
  }
  
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`[useUserTriggeredAnalysis] 执行完成: ${succeeded}/${results.length} 成功`);
  
  return {
    total: results.length,
    succeeded,
    failed,
    results,
  };
}

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

  // ML 统计记录
  const recordMLInference = useMLStatsStore(state => state.recordInference);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triggeredResult, setTriggeredResult] = useState<TriggeredContext | null>(null);
  const [unifiedResult, setUnifiedResult] = useState<UnifiedAnalysisResult | null>(null);
  const [volumeKeyEnabled, setVolumeKeyEnabled] = useState(false);
  const [shortcutEnabled, setShortcutEnabled] = useState(false);

  // 记录推理统计
  const recordInferenceStats = useCallback((predictions: any[]) => {
    const startTime = Date.now();
    
    predictions.forEach(pred => {
      const isImage = pred.label.startsWith('image:');
      const isAudio = pred.label.startsWith('audio:');
      
      if (isImage || isAudio) {
        const durationMs = Math.max(1, Date.now() - startTime);
        recordMLInference({
          type: isImage ? 'image' : 'audio',
          duration: durationMs,
          success: true,
          topLabel: pred.label.replace(/^(image:|audio:)/, ''),
          topScore: pred.score,
        });
      }
    });
  }, [recordMLInference]);

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
          
          // 优先使用智能建议引擎的结果
          let alertTitle: string;
          let alertMessage: string;
          
          if (unified.smartSuggestion) {
            alertTitle = `🎯 ${unified.smartSuggestion.headline}`;
            alertMessage = formatSmartSuggestionMessage(unified.smartSuggestion, unified.confidence);
          } else {
            // 回退到旧版 personalizedNotes
            const notes = unified.personalizedNotes.join('\n');
            alertTitle = `🎯 场景识别: ${sceneName}`;
            alertMessage = `${notes}\n\n综合置信度: ${(unified.confidence * 100).toFixed(0)}%`;
          }
          
          Alert.alert(
            alertTitle,
            alertMessage,
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

      // � 记录 ML 推理统计
      recordInferenceStats(result.predictions);

      // �🚀 使用统一场景分析器整合多源信号
      const unified = await unifiedSceneAnalyzer.analyze(result.predictions);
      setUnifiedResult(unified);
      
      // 同步更新全局上下文状态
      const silentContext = unifiedSceneAnalyzer.convertToSilentContext(unified);
      setCurrentContext(silentContext);

      const sceneName = SCENE_DISPLAY_NAMES[unified.sceneType];
      
      // 优先使用智能建议引擎的结果
      let alertTitle: string;
      let alertMessage: string;
      
      if (unified.smartSuggestion) {
        alertTitle = `🎯 ${unified.smartSuggestion.headline}`;
        alertMessage = formatSmartSuggestionMessage(unified.smartSuggestion, unified.confidence);
      } else {
        // 回退到旧版 personalizedNotes
        const notes = unified.personalizedNotes.join('\n');
        alertTitle = `🎯 场景识别: ${sceneName}`;
        alertMessage = `${notes}\n\n综合置信度: ${(unified.confidence * 100).toFixed(0)}%`;
      }

      Alert.alert(
        alertTitle,
        alertMessage,
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

  const handleFeedback = useCallback(async (result: TriggeredContext | UnifiedAnalysisResult, action: 'accept' | 'ignore' | 'cancel') => {
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

      // 获取 SmartSuggestion 并执行动作
      const unifiedResult = result as UnifiedAnalysisResult;
      if (isUnified && unifiedResult.smartSuggestion) {
        try {
          console.log('[useUserTriggeredAnalysis] 开始执行 SmartSuggestion 动作...');
          
          const execResult = await executeSmartSuggestionActions(unifiedResult.smartSuggestion, sceneType);
          
          if (execResult.succeeded > 0) {
            const successActions = execResult.results
              .filter(r => r.success)
              .map(r => r.action)
              .join('、');
            
            Alert.alert(
              '✅ 执行成功',
              `已完成以下操作:\n${successActions}\n\n场景: ${sceneName}`,
              [{ text: '确定' }]
            );
          } else if (execResult.failed > 0) {
            const failedActions = execResult.results
              .filter(r => !r.success)
              .map(r => `${r.action}: ${r.error}`)
              .join('\n');
            
            Alert.alert(
              '⚠️ 部分执行失败',
              `以下操作执行失败:\n${failedActions}\n\n请检查权限设置`,
              [{ text: '确定' }]
            );
          } else {
            Alert.alert(
              '已接受',
              `已记录您的偏好: ${sceneName}`,
              [{ text: '确定' }]
            );
          }
        } catch (error) {
          console.error('[useUserTriggeredAnalysis] 执行 SmartSuggestion 动作失败:', error);
          Alert.alert(
            '执行失败',
            `执行建议时出错: ${(error as Error).message}`,
            [{ text: '确定' }]
          );
        }
      } else {
        Alert.alert(
          '已接受',
          `已记录您的偏好: ${sceneName}`,
          [{ text: '确定' }]
        );
      }
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
