/**
 * PredictiveTrigger 演示
 * 
 * 展示如何使用预测触发器进行场景建议和用户反馈学习
 */

import { predictiveTrigger } from './PredictiveTrigger';
import { silentContextEngine } from './SilentContextEngine';
import type { SilentContext, SceneType, UserFeedback } from '../types';

/**
 * 演示预测触发器的基本使用
 */
export async function demonstratePredictiveTrigger(): Promise<void> {
  console.log('=== PredictiveTrigger 演示开始 ===');

  try {
    // 1. 获取当前场景上下文
    console.log('\n1. 获取当前场景上下文...');
    const context = await silentContextEngine.getContext();
    console.log('当前场景:', {
      scene: context.context,
      confidence: context.confidence.toFixed(2),
      signalCount: context.signals.length,
    });

    // 2. 检查是否应该触发建议
    console.log('\n2. 检查是否应该触发建议...');
    const decision = predictiveTrigger.shouldTrigger(context);
    console.log('触发决策:', decision);

    if (decision.suggest) {
      console.log(`✅ 建议触发 ${decision.sceneType} 场景`);
      
      // 模拟用户反馈
      await simulateUserFeedback(decision.sceneType!);
    } else {
      console.log(`❌ 不建议触发，原因: ${decision.reason}`);
    }

    // 3. 显示统计信息
    console.log('\n3. 显示统计信息...');
    const stats = predictiveTrigger.getStatistics();
    console.log('统计信息:', {
      totalScenes: stats.totalScenes,
      totalTriggers: stats.totalTriggers,
      acceptRate: (stats.averageAcceptRate * 100).toFixed(1) + '%',
    });

    // 4. 显示所有场景历史
    console.log('\n4. 显示所有场景历史...');
    const allHistory = predictiveTrigger.getAllHistory();
    allHistory.forEach(history => {
      console.log(`${history.sceneType}:`, {
        accepts: history.acceptCount,
        ignores: history.ignoreCount,
        cancels: history.cancelCount,
        lastTrigger: history.lastTriggerTime > 0 
          ? new Date(history.lastTriggerTime).toLocaleString()
          : '从未触发',
      });
    });

  } catch (error) {
    console.error('演示过程中发生错误:', error);
  }

  console.log('\n=== PredictiveTrigger 演示结束 ===');
}

/**
 * 模拟用户反馈
 */
async function simulateUserFeedback(sceneType: SceneType): Promise<void> {
  console.log(`\n模拟用户对 ${sceneType} 场景的反馈...`);

  // 随机选择用户反馈
  const feedbacks: UserFeedback[] = ['accept', 'ignore', 'cancel'];
  const randomFeedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];

  console.log(`用户选择: ${randomFeedback}`);
  
  // 记录反馈
  predictiveTrigger.recordFeedback(sceneType, randomFeedback);

  // 显示更新后的历史
  const history = predictiveTrigger.getHistory(sceneType);
  console.log('更新后的历史:', {
    accepts: history.acceptCount,
    ignores: history.ignoreCount,
    cancels: history.cancelCount,
  });
}

/**
 * 演示置信度阈值检查
 */
export function demonstrateConfidenceThreshold(): void {
  console.log('\n=== 置信度阈值检查演示 ===');

  const testConfidences = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8];
  
  testConfidences.forEach(confidence => {
    const mockContext: SilentContext = {
      timestamp: Date.now(),
      context: 'COMMUTE',
      confidence,
      signals: [],
    };

    const decision = predictiveTrigger.shouldTrigger(mockContext);
    const status = decision.suggest ? '✅ 触发' : '❌ 不触发';
    
    console.log(`置信度 ${confidence.toFixed(2)}: ${status} (${decision.reason || '满足条件'})`);
  });
}

/**
 * 演示冷却机制
 */
export function demonstrateCooldownMechanism(): void {
  console.log('\n=== 冷却机制演示 ===');

  const sceneType: SceneType = 'HOME';
  
  // 记录一次触发
  predictiveTrigger.recordFeedback(sceneType, 'accept');
  console.log('记录了一次 accept 反馈');

  // 立即检查是否可以再次触发
  const mockContext: SilentContext = {
    timestamp: Date.now(),
    context: sceneType,
    confidence: 0.7,
    signals: [],
  };

  const decision = predictiveTrigger.shouldTrigger(mockContext);
  console.log('立即再次检查:', decision.suggest ? '可以触发' : `不可触发 (${decision.reason})`);

  // 模拟时间过去（这里只是演示，实际需要等待）
  console.log('模拟 1 小时后...');
  console.log('(实际应用中需要等待冷却时间结束)');
}

/**
 * 演示高忽略率检查
 */
export function demonstrateHighIgnoreRate(): void {
  console.log('\n=== 高忽略率检查演示 ===');

  const sceneType: SceneType = 'STUDY';
  
  // 清除历史
  predictiveTrigger.clearHistory(sceneType);
  
  // 记录多次忽略
  console.log('记录多次忽略反馈...');
  predictiveTrigger.recordFeedback(sceneType, 'ignore');
  predictiveTrigger.recordFeedback(sceneType, 'ignore');
  predictiveTrigger.recordFeedback(sceneType, 'ignore');
  predictiveTrigger.recordFeedback(sceneType, 'accept');

  const history = predictiveTrigger.getHistory(sceneType);
  const ignoreRate = history.ignoreCount / (history.acceptCount + history.ignoreCount + history.cancelCount);
  console.log(`忽略率: ${(ignoreRate * 100).toFixed(1)}%`);

  // 模拟冷却时间过去后检查
  const mockContext: SilentContext = {
    timestamp: Date.now(),
    context: sceneType,
    confidence: 0.7,
    signals: [],
  };

  // 注意：这里需要模拟冷却时间过去，实际测试中可能仍会因为冷却而被拒绝
  console.log('由于高忽略率，即使冷却时间过去也不会触发');
}

/**
 * 演示自动模式升级建议
 */
export function demonstrateAutoModeUpgrade(): void {
  console.log('\n=== 自动模式升级建议演示 ===');

  const sceneType: SceneType = 'OFFICE';
  
  // 清除历史
  predictiveTrigger.clearHistory(sceneType);
  
  // 记录连续 5 次接受
  console.log('记录连续 5 次接受反馈...');
  for (let i = 0; i < 5; i++) {
    predictiveTrigger.recordFeedback(sceneType, 'accept');
    console.log(`第 ${i + 1} 次接受`);
  }

  console.log('应该会建议升级为自动模式（查看控制台日志）');
  
  const history = predictiveTrigger.getHistory(sceneType);
  console.log('最终历史:', {
    accepts: history.acceptCount,
    ignores: history.ignoreCount,
    cancels: history.cancelCount,
  });
}

/**
 * 运行所有演示
 */
export async function runAllDemos(): Promise<void> {
  console.log('🚀 开始运行所有 PredictiveTrigger 演示...\n');

  await demonstratePredictiveTrigger();
  demonstrateConfidenceThreshold();
  demonstrateCooldownMechanism();
  demonstrateHighIgnoreRate();
  demonstrateAutoModeUpgrade();

  console.log('\n✅ 所有演示完成！');
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  runAllDemos().catch(console.error);
}