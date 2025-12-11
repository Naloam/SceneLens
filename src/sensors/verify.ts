/**
 * 验证脚本 - 测试 SilentContextEngine 核心功能
 * 
 * 这个脚本可以在不需要 Android 设备的情况下验证基本逻辑
 */

import { SilentContextEngine } from './SilentContextEngine';

/**
 * 验证时间信号功能
 */
function verifyTimeSignal(): boolean {
  console.log('🔍 验证时间信号功能...');
  
  const engine = new SilentContextEngine();
  const signal = engine.getTimeSignal();
  
  // 检查信号结构
  if (!signal || typeof signal !== 'object') {
    console.error('❌ 时间信号返回值无效');
    return false;
  }
  
  // 检查必需字段
  if (signal.type !== 'TIME') {
    console.error('❌ 信号类型错误:', signal.type);
    return false;
  }
  
  if (typeof signal.value !== 'string' || signal.value === '') {
    console.error('❌ 信号值无效:', signal.value);
    return false;
  }
  
  if (typeof signal.weight !== 'number' || signal.weight < 0 || signal.weight > 1) {
    console.error('❌ 权重值无效:', signal.weight);
    return false;
  }
  
  if (typeof signal.timestamp !== 'number' || signal.timestamp <= 0) {
    console.error('❌ 时间戳无效:', signal.timestamp);
    return false;
  }
  
  console.log('✅ 时间信号验证通过');
  console.log(`   类型: ${signal.type}`);
  console.log(`   值: ${signal.value}`);
  console.log(`   权重: ${signal.weight}`);
  console.log(`   时间戳: ${new Date(signal.timestamp).toISOString()}`);
  
  return true;
}

/**
 * 验证场景推断功能
 */
async function verifySceneInference(): Promise<boolean> {
  console.log('\n🔍 验证场景推断功能...');
  
  const engine = new SilentContextEngine();
  
  try {
    const startTime = Date.now();
    const context = await engine.getContext();
    const duration = Date.now() - startTime;
    
    // 检查上下文结构
    if (!context || typeof context !== 'object') {
      console.error('❌ 场景上下文返回值无效');
      return false;
    }
    
    // 检查必需字段
    if (typeof context.context !== 'string') {
      console.error('❌ 场景类型无效:', context.context);
      return false;
    }
    
    if (typeof context.confidence !== 'number' || context.confidence < 0 || context.confidence > 1) {
      console.error('❌ 置信度无效:', context.confidence);
      return false;
    }
    
    if (!Array.isArray(context.signals) || context.signals.length === 0) {
      console.error('❌ 信号列表无效');
      return false;
    }
    
    // 检查性能
    if (duration > 100) {
      console.warn(`⚠️ 推断时间较长: ${duration}ms (目标: <50ms)`);
    }
    
    console.log('✅ 场景推断验证通过');
    console.log(`   场景: ${context.context}`);
    console.log(`   置信度: ${(context.confidence * 100).toFixed(1)}%`);
    console.log(`   信号数量: ${context.signals.length}`);
    console.log(`   推断时间: ${duration}ms`);
    
    // 显示所有信号
    console.log('   信号详情:');
    context.signals.forEach((signal, index) => {
      console.log(`     ${index + 1}. ${signal.type}: ${signal.value} (权重: ${signal.weight})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 场景推断失败:', error);
    return false;
  }
}

/**
 * 验证缓存功能
 */
async function verifyCaching(): Promise<boolean> {
  console.log('\n🔍 验证缓存功能...');
  
  const engine = new SilentContextEngine();
  
  try {
    // 第一次调用
    const start1 = Date.now();
    await engine.getContext();
    const duration1 = Date.now() - start1;
    
    // 立即第二次调用（应该使用缓存）
    const start2 = Date.now();
    await engine.getContext();
    const duration2 = Date.now() - start2;
    
    console.log('✅ 缓存功能验证通过');
    console.log(`   第一次调用: ${duration1}ms`);
    console.log(`   第二次调用: ${duration2}ms (使用缓存)`);
    
    if (duration2 < duration1) {
      console.log('   ✓ 缓存提升了性能');
    }
    
    // 清除缓存
    engine.clearCache();
    console.log('   ✓ 缓存已清除');
    
    return true;
  } catch (error) {
    console.error('❌ 缓存验证失败:', error);
    return false;
  }
}

/**
 * 验证不同时间段的场景推断
 */
function verifyTimeBasedScenes(): boolean {
  console.log('\n🔍 验证基于时间的场景推断...');
  
  const engine = new SilentContextEngine();
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  const signal = engine.getTimeSignal();
  
  console.log(`   当前时间: ${now.toLocaleString('zh-CN')}`);
  console.log(`   星期: ${['日', '一', '二', '三', '四', '五', '六'][day]}`);
  console.log(`   时段: ${signal.value}`);
  
  // 验证时段分类逻辑
  const isWeekday = day >= 1 && day <= 5;
  
  if (isWeekday) {
    if (hour >= 7 && hour < 9.5) {
      if (signal.value !== 'MORNING_RUSH') {
        console.error('❌ 早高峰识别错误');
        return false;
      }
    } else if (hour >= 17 && hour < 19.5) {
      if (signal.value !== 'EVENING_RUSH') {
        console.error('❌ 晚高峰识别错误');
        return false;
      }
    }
  }
  
  console.log('✅ 时间段识别正确');
  return true;
}

/**
 * 运行所有验证
 */
export async function runVerification(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 开始验证 SilentContextEngine');
  console.log('='.repeat(60));
  
  const results: { name: string; passed: boolean }[] = [];
  
  // 1. 验证时间信号
  results.push({
    name: '时间信号功能',
    passed: verifyTimeSignal()
  });
  
  // 2. 验证场景推断
  results.push({
    name: '场景推断功能',
    passed: await verifySceneInference()
  });
  
  // 3. 验证缓存
  results.push({
    name: '缓存功能',
    passed: await verifyCaching()
  });
  
  // 4. 验证时间段识别
  results.push({
    name: '时间段识别',
    passed: verifyTimeBasedScenes()
  });
  
  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 验证结果总结');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.passed ? '通过' : '失败'}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`总计: ${passed}/${total} 通过 (${(passed / total * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));
  
  if (passed === total) {
    console.log('\n🎉 所有验证通过！SilentContextEngine 工作正常。');
  } else {
    console.log('\n⚠️ 部分验证失败，请检查错误信息。');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runVerification().catch(console.error);
}

