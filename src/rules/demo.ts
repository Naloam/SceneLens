/**
 * 规则引擎和场景执行器演示
 * 
 * 这个脚本演示如何使用 RuleEngine 和 SceneExecutor
 * 来匹配场景规则并执行相应的动作
 */

import { RuleEngine } from './RuleEngine';
import { SceneExecutor } from '../executors/SceneExecutor';
import { SilentContext, ContextSignal } from '../types';

/**
 * 创建模拟的通勤场景上下文
 */
function createCommuteContext(): SilentContext {
  const signals: ContextSignal[] = [
    {
      type: 'TIME',
      value: 'MORNING_RUSH',
      weight: 0.8,
      timestamp: Date.now(),
    },
    {
      type: 'LOCATION',
      value: 'SUBWAY_STATION',
      weight: 0.9,
      timestamp: Date.now(),
    },
    {
      type: 'MOTION',
      value: 'WALKING',
      weight: 0.7,
      timestamp: Date.now(),
    },
  ];

  return {
    timestamp: Date.now(),
    context: 'COMMUTE',
    confidence: 0.85,
    signals,
  };
}

/**
 * 创建模拟的办公场景上下文
 */
function createOfficeContext(): SilentContext {
  const signals: ContextSignal[] = [
    {
      type: 'TIME',
      value: 'WORK_HOURS',
      weight: 0.7,
      timestamp: Date.now(),
    },
    {
      type: 'LOCATION',
      value: 'OFFICE',
      weight: 0.9,
      timestamp: Date.now(),
    },
    {
      type: 'MOTION',
      value: 'STILL',
      weight: 0.8,
      timestamp: Date.now(),
    },
  ];

  return {
    timestamp: Date.now(),
    context: 'OFFICE',
    confidence: 0.8,
    signals,
  };
}

/**
 * 演示规则匹配
 */
async function demoRuleMatching() {
  console.log('=== 规则匹配演示 ===\n');

  const ruleEngine = new RuleEngine();
  await ruleEngine.loadRules();

  console.log(`已加载 ${ruleEngine.getRules().length} 条规则\n`);

  // 测试通勤场景
  console.log('场景 1: 通勤场景');
  const commuteContext = createCommuteContext();
  console.log('上下文:', {
    scene: commuteContext.context,
    confidence: commuteContext.confidence,
    signals: commuteContext.signals.map(s => `${s.type}=${s.value}`),
  });

  const commuteMatches = await ruleEngine.matchRules(commuteContext);
  console.log(`\n匹配到 ${commuteMatches.length} 条规则:`);
  commuteMatches.forEach((match, index) => {
    console.log(`  ${index + 1}. ${match.rule.id}`);
    console.log(`     得分: ${match.score.toFixed(2)}`);
    console.log(`     优先级: ${match.rule.priority}`);
    console.log(`     模式: ${match.rule.mode}`);
    console.log(`     说明: ${match.explanation}`);
  });

  console.log('\n---\n');

  // 测试办公场景
  console.log('场景 2: 办公场景');
  const officeContext = createOfficeContext();
  console.log('上下文:', {
    scene: officeContext.context,
    confidence: officeContext.confidence,
    signals: officeContext.signals.map(s => `${s.type}=${s.value}`),
  });

  const officeMatches = await ruleEngine.matchRules(officeContext);
  console.log(`\n匹配到 ${officeMatches.length} 条规则`);
  if (officeMatches.length === 0) {
    console.log('  (没有匹配的规则 - 这是正常的，因为我们只定义了通勤规则)');
  }

  console.log('\n');
}

/**
 * 演示场景执行
 */
async function demoSceneExecution() {
  console.log('=== 场景执行演示 ===\n');

  const ruleEngine = new RuleEngine();
  await ruleEngine.loadRules();

  const executor = new SceneExecutor();

  // 获取通勤场景规则
  const commuteContext = createCommuteContext();
  const matches = await ruleEngine.matchRules(commuteContext);

  if (matches.length === 0) {
    console.log('没有匹配的规则可执行');
    return;
  }

  const topMatch = matches[0];
  console.log(`执行规则: ${topMatch.rule.id}`);
  console.log(`动作数量: ${topMatch.rule.actions.length}\n`);

  // 执行动作
  console.log('开始执行动作...\n');
  const results = await executor.execute(topMatch.rule.actions);

  // 显示结果
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

  // 统计
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`执行完成: ${successCount} 成功, ${failCount} 失败`);
}

/**
 * 演示规则评分
 */
async function demoRuleScoring() {
  console.log('=== 规则评分演示 ===\n');

  const ruleEngine = new RuleEngine();
  await ruleEngine.loadRules();

  const rule = ruleEngine.getRuleById('RULE_COMMUTE');
  if (!rule) {
    console.log('未找到通勤规则');
    return;
  }

  console.log(`规则: ${rule.id}`);
  console.log(`条件数量: ${rule.conditions.length}\n`);

  // 测试不同的上下文
  const testCases = [
    {
      name: '完全匹配',
      context: createCommuteContext(),
    },
    {
      name: '部分匹配',
      context: {
        timestamp: Date.now(),
        context: 'UNKNOWN' as const,
        confidence: 0.5,
        signals: [
          {
            type: 'TIME' as const,
            value: 'MORNING_RUSH',
            weight: 0.8,
            timestamp: Date.now(),
          },
        ],
      },
    },
    {
      name: '不匹配',
      context: {
        timestamp: Date.now(),
        context: 'UNKNOWN' as const,
        confidence: 0.3,
        signals: [
          {
            type: 'TIME' as const,
            value: 'MIDNIGHT',
            weight: 0.8,
            timestamp: Date.now(),
          },
        ],
      },
    },
  ];

  testCases.forEach(testCase => {
    const score = ruleEngine.calculateRuleScore(rule, testCase.context);
    console.log(`${testCase.name}:`);
    console.log(`  信号: ${testCase.context.signals.map(s => `${s.type}=${s.value}`).join(', ')}`);
    console.log(`  得分: ${score.toFixed(2)}`);
    console.log(`  是否触发: ${score > 0.6 ? '是' : '否'}`);
    console.log('');
  });
}

/**
 * 主函数
 */
export async function runRuleEngineDemo() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  SceneLens 规则引擎和执行器演示       ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await demoRuleMatching();
    await demoRuleScoring();
    await demoSceneExecution();

    console.log('\n演示完成！\n');
  } catch (error) {
    console.error('演示过程中发生错误:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runRuleEngineDemo();
}
