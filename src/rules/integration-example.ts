/**
 * 规则引擎集成示例
 * 
 * 展示如何将 SilentContextEngine、RuleEngine 和 SceneExecutor 集成在一起
 * 实现完整的场景感知和自动化流程
 */

import { SilentContextEngine } from '../core/SilentContextEngine';
import { RuleEngine } from './RuleEngine';
import { SceneExecutor } from '../executors/SceneExecutor';

/**
 * 场景感知和执行的完整流程
 */
export async function runSceneAwareFlow() {
  console.log('=== 场景感知和执行流程 ===\n');

  try {
    // 步骤 1: 采集场景信号
    console.log('步骤 1: 采集场景信号...');
    const contextEngine = new SilentContextEngine();
    const context = await contextEngine.getContext();
    
    console.log('场景上下文:', {
      scene: context.context,
      confidence: context.confidence.toFixed(2),
      signalCount: context.signals.length,
    });
    console.log('');

    // 步骤 2: 加载规则
    console.log('步骤 2: 加载规则...');
    const ruleEngine = new RuleEngine();
    await ruleEngine.loadRules();
    console.log(`已加载 ${ruleEngine.getRules().length} 条规则`);
    console.log('');

    // 步骤 3: 匹配规则
    console.log('步骤 3: 匹配规则...');
    const matches = await ruleEngine.matchRules(context);
    
    if (matches.length === 0) {
      console.log('没有匹配的规则');
      console.log('提示: 当前场景可能不符合任何规则的触发条件');
      return;
    }

    console.log(`匹配到 ${matches.length} 条规则:`);
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.rule.id}`);
      console.log(`     得分: ${match.score.toFixed(2)}`);
      console.log(`     模式: ${match.rule.mode}`);
    });
    console.log('');

    // 步骤 4: 选择最佳匹配
    const topMatch = matches[0];
    console.log('步骤 4: 选择最佳匹配规则');
    console.log(`规则: ${topMatch.rule.id}`);
    console.log(`得分: ${topMatch.score.toFixed(2)}`);
    console.log(`说明: ${topMatch.explanation}`);
    console.log('');

    // 步骤 5: 检查执行模式
    console.log('步骤 5: 检查执行模式');
    console.log(`模式: ${topMatch.rule.mode}`);
    
    let shouldExecute = false;
    switch (topMatch.rule.mode) {
      case 'AUTO':
        console.log('自动执行模式 - 直接执行');
        shouldExecute = true;
        break;
      
      case 'ONE_TAP':
        console.log('一键执行模式 - 需要用户确认');
        // 在实际应用中，这里会显示通知卡片
        // 用户点击后才执行
        console.log('（演示中自动执行）');
        shouldExecute = true;
        break;
      
      case 'SUGGEST_ONLY':
        console.log('仅建议模式 - 只显示通知，不执行');
        shouldExecute = false;
        break;
    }
    console.log('');

    if (!shouldExecute) {
      console.log('根据规则模式，不执行动作');
      return;
    }

    // 步骤 6: 执行动作
    console.log('步骤 6: 执行动作...');
    const executor = new SceneExecutor();
    const results = await executor.execute(topMatch.rule.actions);

    console.log(`执行了 ${results.length} 个动作:\n`);
    results.forEach((result, index) => {
      const action = result.action;
      console.log(`动作 ${index + 1}: ${action.target}.${action.action}`);
      console.log(`  状态: ${result.success ? '✓ 成功' : '✗ 失败'}`);
      console.log(`  耗时: ${result.duration}ms`);
      
      if (result.error) {
        console.log(`  错误: ${result.error}`);
      }
      
      if (action.intent) {
        console.log(`  意图: ${action.intent}`);
      }
      
      if (action.deepLink) {
        console.log(`  Deep Link: ${action.deepLink}`);
      }
      
      console.log('');
    });

    // 步骤 7: 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log('执行统计:');
    console.log(`  成功: ${successCount}`);
    console.log(`  失败: ${failCount}`);
    console.log(`  总耗时: ${totalTime}ms`);
    console.log('');

    // 步骤 8: 记录反馈（用于学习）
    console.log('步骤 8: 记录用户反馈');
    console.log('（在实际应用中，这里会记录用户的接受/忽略/取消操作）');
    console.log('');

    console.log('✓ 场景感知和执行流程完成！');

  } catch (error) {
    console.error('流程执行失败:', error);
    throw error;
  }
}

/**
 * 演示不同场景的处理
 */
export async function demonstrateScenarios() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  场景感知和执行集成演示                ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 场景 1: 通勤场景
  console.log('【场景 1: 通勤场景】');
  console.log('时间: 早上 8:00');
  console.log('位置: 地铁站');
  console.log('运动: 步行');
  console.log('');
  
  await runSceneAwareFlow();

  console.log('\n' + '='.repeat(50) + '\n');

  // 场景 2: 办公场景
  console.log('【场景 2: 办公场景】');
  console.log('时间: 上午 10:00');
  console.log('位置: 办公室');
  console.log('运动: 静止');
  console.log('');
  
  await runSceneAwareFlow();

  console.log('\n演示完成！\n');
}

/**
 * 测试规则引擎的各种边界情况
 */
export async function testEdgeCases() {
  console.log('\n=== 边界情况测试 ===\n');

  const ruleEngine = new RuleEngine();
  await ruleEngine.loadRules();

  // 测试 1: 空信号
  console.log('测试 1: 空信号');
  const emptyContext = {
    timestamp: Date.now(),
    context: 'UNKNOWN' as const,
    confidence: 0,
    signals: [],
  };
  const emptyMatches = await ruleEngine.matchRules(emptyContext);
  console.log(`结果: 匹配到 ${emptyMatches.length} 条规则`);
  console.log('');

  // 测试 2: 低置信度
  console.log('测试 2: 低置信度场景');
  const lowConfidenceContext = {
    timestamp: Date.now(),
    context: 'COMMUTE' as const,
    confidence: 0.4,
    signals: [
      {
        type: 'TIME' as const,
        value: 'MORNING_RUSH',
        weight: 0.5,
        timestamp: Date.now(),
      },
    ],
  };
  const lowConfidenceMatches = await ruleEngine.matchRules(lowConfidenceContext);
  console.log(`结果: 匹配到 ${lowConfidenceMatches.length} 条规则`);
  if (lowConfidenceMatches.length > 0) {
    console.log(`最高得分: ${lowConfidenceMatches[0].score.toFixed(2)}`);
  }
  console.log('');

  // 测试 3: 禁用的规则
  console.log('测试 3: 禁用规则');
  const rule = ruleEngine.getRuleById('RULE_COMMUTE');
  if (rule) {
    ruleEngine.setRuleEnabled('RULE_COMMUTE', false);
    const disabledMatches = await ruleEngine.matchRules(lowConfidenceContext);
    console.log(`结果: 匹配到 ${disabledMatches.length} 条规则（规则已禁用）`);
    
    // 恢复规则
    ruleEngine.setRuleEnabled('RULE_COMMUTE', true);
  }
  console.log('');

  console.log('边界情况测试完成！\n');
}

// 如果直接运行此文件
if (require.main === module) {
  demonstrateScenarios()
    .then(() => testEdgeCases())
    .catch(error => {
      console.error('演示失败:', error);
      process.exit(1);
    });
}
