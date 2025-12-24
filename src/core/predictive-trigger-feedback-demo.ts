/**
 * PredictiveTrigger 用户反馈学习功能演示
 * 
 * 演示需求 10.3 和 10.6 的实现：
 * - 记录用户的"接受/忽略/取消"操作
 * - 连续 3 次忽略降低触发频率
 * - 忽略率计算和触发频率调整
 * - 自动模式下的反馈记录和权重调整
 */

import { PredictiveTrigger } from './PredictiveTrigger';
import type { SilentContext, SceneType, UserFeedback } from '../types';

/**
 * 扩展的 PredictiveTrigger 类，用于演示
 */
class DemoPredictiveTrigger extends PredictiveTrigger {
  private sceneWeights: Map<SceneType, number> = new Map();

  constructor() {
    super();
    // 初始化场景权重
    this.initializeSceneWeights();
  }

  private initializeSceneWeights(): void {
    const scenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY', 'SLEEP', 'TRAVEL'];
    scenes.forEach(scene => {
      this.sceneWeights.set(scene, 1.0);
    });
  }

  /**
   * 重写连续忽略检测回调
   */
  protected onConsecutiveIgnoresDetected(sceneType: SceneType, history: any): void {
    console.log(`🚫 [需求 10.3] ${sceneType} 场景连续忽略 ${history.consecutiveIgnores} 次`);
    console.log(`   触发频率将降低到 ${(this.getTriggerFrequencyFactor(sceneType) * 100).toFixed(0)}%`);
    
    // 实际应用中，这里会通知 UI 或其他组件调整触发策略
    this.notifyTriggerFrequencyChange(sceneType, this.getTriggerFrequencyFactor(sceneType));
  }

  /**
   * 重写权重调整方法
   */
  protected adjustSceneWeight(
    sceneType: SceneType, 
    feedback: UserFeedback, 
    currentWeight: number = 1.0
  ): number {
    const adjustedWeight = super.adjustSceneWeight(sceneType, feedback, currentWeight);
    
    // 更新本地权重存储
    this.sceneWeights.set(sceneType, adjustedWeight);
    
    console.log(`⚖️  [需求 10.6] ${sceneType} 场景权重调整: ${currentWeight.toFixed(2)} → ${adjustedWeight.toFixed(2)}`);
    
    return adjustedWeight;
  }

  /**
   * 获取场景权重
   */
  getSceneWeight(sceneType: SceneType): number {
    return this.sceneWeights.get(sceneType) || 1.0;
  }

  /**
   * 模拟触发频率变化通知
   */
  private notifyTriggerFrequencyChange(sceneType: SceneType, factor: number): void {
    if (factor < 0.5) {
      console.log(`   📉 ${sceneType} 场景触发频率显著降低，建议用户重新配置偏好`);
    } else if (factor > 1.5) {
      console.log(`   📈 ${sceneType} 场景触发频率提高，用户偏好此场景`);
    }
  }

  /**
   * 演示自动模式下的反馈处理
   */
  recordAutoModeFeedback(sceneType: SceneType, feedback: UserFeedback): void {
    console.log(`🤖 [自动模式] 记录 ${sceneType} 场景反馈: ${feedback}`);
    
    const currentWeight = this.getSceneWeight(sceneType);
    const newWeight = this.adjustSceneWeight(sceneType, feedback, currentWeight);
    
    // 记录常规反馈
    this.recordFeedback(sceneType, feedback);
    
    // 自动模式特殊处理
    if (feedback === 'cancel') {
      console.log(`   ⚠️  用户在自动模式下取消了 ${sceneType} 场景`);
      console.log(`   建议降低该场景的自动执行优先级`);
    }
  }
}

/**
 * 创建模拟上下文
 */
function createMockContext(sceneType: SceneType, confidence: number): SilentContext {
  return {
    timestamp: Date.now(),
    context: sceneType,
    confidence,
    signals: [
      {
        type: 'TIME',
        value: 'MORNING_RUSH',
        weight: 0.7,
        timestamp: Date.now(),
      },
    ],
  };
}

/**
 * 演示用户反馈学习功能
 */
export async function demonstrateUserFeedbackLearning(): Promise<void> {
  console.log('🎯 PredictiveTrigger 用户反馈学习功能演示');
  console.log('=' .repeat(60));

  const trigger = new DemoPredictiveTrigger();

  // 演示 1: 正常反馈记录
  console.log('\n📝 演示 1: 基础反馈记录');
  console.log('-'.repeat(40));
  
  trigger.recordFeedback('COMMUTE', 'accept');
  trigger.recordFeedback('COMMUTE', 'accept');
  trigger.recordFeedback('HOME', 'ignore');
  
  let stats = trigger.getStatistics();
  console.log(`统计信息: 总场景 ${stats.totalScenes}, 总触发 ${stats.totalTriggers}, 接受率 ${(stats.averageAcceptRate * 100).toFixed(1)}%`);

  // 演示 2: 连续忽略检测（需求 10.3）
  console.log('\n🚫 演示 2: 连续忽略检测 (需求 10.3)');
  console.log('-'.repeat(40));
  
  console.log('模拟用户连续忽略 OFFICE 场景...');
  trigger.recordFeedback('OFFICE', 'ignore');
  trigger.recordFeedback('OFFICE', 'ignore');
  trigger.recordFeedback('OFFICE', 'ignore'); // 第3次忽略，触发阈值
  
  // 检查触发决策
  const context = createMockContext('OFFICE', 0.65);
  const decision = trigger.shouldTrigger(context);
  console.log(`触发决策: ${decision.suggest ? '建议触发' : '不建议触发'} (原因: ${decision.reason})`);

  // 演示 3: 触发频率调整
  console.log('\n📊 演示 3: 触发频率调整');
  console.log('-'.repeat(40));
  
  const scenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME', 'STUDY'];
  scenes.forEach(scene => {
    const factor = trigger.getTriggerFrequencyFactor(scene);
    console.log(`${scene}: 触发频率因子 ${factor.toFixed(2)} (${(factor * 100).toFixed(0)}%)`);
  });

  // 演示 4: 自动模式反馈（需求 10.6）
  console.log('\n🤖 演示 4: 自动模式反馈处理 (需求 10.6)');
  console.log('-'.repeat(40));
  
  trigger.recordAutoModeFeedback('STUDY', 'accept');
  trigger.recordAutoModeFeedback('STUDY', 'cancel'); // 用户取消自动执行
  trigger.recordAutoModeFeedback('TRAVEL', 'accept');

  // 演示 5: 反馈学习效果
  console.log('\n📈 演示 5: 学习效果统计');
  console.log('-'.repeat(40));
  
  stats = trigger.getStatistics();
  console.log(`学习统计:`);
  console.log(`  - 总场景数: ${stats.totalScenes}`);
  console.log(`  - 总触发次数: ${stats.totalTriggers}`);
  console.log(`  - 接受次数: ${stats.totalAccepts}`);
  console.log(`  - 忽略次数: ${stats.totalIgnores}`);
  console.log(`  - 取消次数: ${stats.totalCancels}`);
  console.log(`  - 平均接受率: ${(stats.averageAcceptRate * 100).toFixed(1)}%`);
  console.log(`  - 连续忽略场景数: ${stats.scenesWithConsecutiveIgnores}`);
  console.log(`  - 高忽略率场景数: ${stats.scenesWithHighIgnoreRate}`);

  // 演示 6: 场景权重展示
  console.log('\n⚖️  演示 6: 场景权重状态');
  console.log('-'.repeat(40));
  
  scenes.forEach(scene => {
    const weight = trigger.getSceneWeight(scene);
    const factor = trigger.getTriggerFrequencyFactor(scene);
    console.log(`${scene}: 权重 ${weight.toFixed(2)}, 触发频率 ${(factor * 100).toFixed(0)}%`);
  });

  // 演示 7: 重置功能
  console.log('\n🔄 演示 7: 重置连续忽略');
  console.log('-'.repeat(40));
  
  console.log('重置 OFFICE 场景的连续忽略计数...');
  trigger.resetConsecutiveIgnores('OFFICE');
  
  const newFactor = trigger.getTriggerFrequencyFactor('OFFICE');
  console.log(`OFFICE 场景触发频率恢复到: ${(newFactor * 100).toFixed(0)}%`);

  console.log('\n✅ 用户反馈学习功能演示完成!');
  console.log('=' .repeat(60));
}

/**
 * 演示实际使用场景
 */
export async function demonstrateRealWorldScenario(): Promise<void> {
  console.log('\n🌍 实际使用场景演示');
  console.log('=' .repeat(60));

  const trigger = new DemoPredictiveTrigger();

  // 模拟一周的用户行为
  console.log('\n📅 模拟一周的用户反馈...');
  
  // 周一到周三：用户对通勤场景很满意
  for (let day = 1; day <= 3; day++) {
    console.log(`第${day}天: 通勤场景`);
    trigger.recordFeedback('COMMUTE', 'accept');
    trigger.recordFeedback('COMMUTE', 'accept');
  }

  // 周四周五：用户开始对办公场景感到厌烦
  console.log('第4-5天: 办公场景开始被忽略');
  trigger.recordFeedback('OFFICE', 'ignore');
  trigger.recordFeedback('OFFICE', 'ignore');
  trigger.recordFeedback('OFFICE', 'ignore'); // 连续3次忽略

  // 周末：用户对家庭场景反应不一
  console.log('周末: 家庭场景混合反馈');
  trigger.recordFeedback('HOME', 'accept');
  trigger.recordFeedback('HOME', 'cancel');
  trigger.recordFeedback('HOME', 'accept');

  // 显示学习结果
  console.log('\n📊 一周学习结果:');
  const stats = trigger.getStatistics();
  console.log(`  接受率: ${(stats.averageAcceptRate * 100).toFixed(1)}%`);
  console.log(`  问题场景: ${stats.scenesWithConsecutiveIgnores} 个`);

  // 模拟下周的触发决策
  console.log('\n🎯 下周触发决策预测:');
  const scenes: SceneType[] = ['COMMUTE', 'OFFICE', 'HOME'];
  scenes.forEach(scene => {
    const context = createMockContext(scene, 0.65);
    const decision = trigger.shouldTrigger(context);
    const factor = trigger.getTriggerFrequencyFactor(scene);
    
    console.log(`  ${scene}: ${decision.suggest ? '✅ 建议触发' : '❌ 不建议触发'} (频率: ${(factor * 100).toFixed(0)}%)`);
  });

  console.log('\n💡 系统学习到的用户偏好:');
  console.log('  - 通勤场景: 用户非常满意，可考虑升级为自动模式');
  console.log('  - 办公场景: 用户连续忽略，已降低触发频率');
  console.log('  - 家庭场景: 用户反馈混合，保持当前策略');
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  demonstrateUserFeedbackLearning()
    .then(() => demonstrateRealWorldScenario())
    .catch(console.error);
}