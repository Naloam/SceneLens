/**
 * Volume Key Demo - 音量键双击功能演示
 * 
 * 演示如何使用音量键双击触发场景识别
 */

import { UserTriggeredAnalyzer } from './UserTriggeredAnalyzer';
import { VolumeKeyListener } from './VolumeKeyListener';

/**
 * 演示音量键双击基础功能
 */
export async function demoVolumeKeyBasic(): Promise<void> {
  console.log('=== 音量键双击基础功能演示 ===');

  const volumeKeyListener = new VolumeKeyListener();

  try {
    // 1. 启用音量键监听
    console.log('1. 启用音量键监听...');
    const enabled = await volumeKeyListener.enable((event) => {
      console.log('🎵 音量键双击事件:', {
        trigger: event.trigger,
        timestamp: new Date(event.timestamp).toISOString(),
      });
    });

    if (!enabled) {
      console.error('❌ 无法启用音量键监听');
      return;
    }

    console.log('✅ 音量键监听已启用');

    // 2. 检查状态
    console.log('2. 检查监听状态...');
    const isListening = volumeKeyListener.isListening();
    const nativeStatus = await volumeKeyListener.checkNativeStatus();
    
    console.log('📊 监听状态:', {
      isListening,
      nativeStatus,
    });

    // 3. 测试功能
    console.log('3. 测试音量键双击...');
    const testResult = await volumeKeyListener.test();
    console.log('🧪 测试结果:', testResult);

    // 4. 等待用户测试
    console.log('4. 请双击音量键进行测试...');
    console.log('   (演示将在 10 秒后自动结束)');

    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. 禁用监听
    console.log('5. 禁用音量键监听...');
    await volumeKeyListener.disable();
    console.log('✅ 音量键监听已禁用');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    volumeKeyListener.cleanup();
  }

  console.log('=== 音量键双击基础功能演示完成 ===\n');
}

/**
 * 演示音量键触发场景识别
 */
export async function demoVolumeKeyWithAnalysis(): Promise<void> {
  console.log('=== 音量键触发场景识别演示 ===');

  const analyzer = new UserTriggeredAnalyzer();

  try {
    // 1. 启用音量键触发
    console.log('1. 启用音量键触发场景识别...');
    const enabled = await analyzer.enableVolumeKeyTrigger(true); // 自动分析

    if (!enabled) {
      console.error('❌ 无法启用音量键触发');
      return;
    }

    console.log('✅ 音量键触发已启用');

    // 2. 检查状态
    console.log('2. 检查触发状态...');
    const isEnabled = analyzer.isVolumeKeyTriggerEnabled();
    console.log('📊 触发状态:', { isEnabled });

    // 3. 预加载模型
    console.log('3. 预加载模型...');
    await analyzer.preloadModels();

    // 4. 测试功能
    console.log('4. 测试音量键触发...');
    const testResult = await analyzer.testVolumeKeyTrigger();
    console.log('🧪 测试结果:', testResult);

    // 5. 等待用户测试
    console.log('5. 请双击音量键触发场景识别...');
    console.log('   (演示将在 15 秒后自动结束)');

    await new Promise(resolve => setTimeout(resolve, 15000));

    // 6. 禁用触发
    console.log('6. 禁用音量键触发...');
    await analyzer.disableVolumeKeyTrigger();
    console.log('✅ 音量键触发已禁用');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    analyzer.cleanup();
  }

  console.log('=== 音量键触发场景识别演示完成 ===\n');
}

/**
 * 演示手动场景识别（不使用音量键）
 */
export async function demoManualAnalysis(): Promise<void> {
  console.log('=== 手动场景识别演示 ===');

  const analyzer = new UserTriggeredAnalyzer();

  try {
    // 1. 预加载模型
    console.log('1. 预加载模型...');
    await analyzer.preloadModels();

    // 2. 手动触发分析
    console.log('2. 开始手动场景识别...');
    const startTime = Date.now();
    
    const result = await analyzer.analyze({
      audioDurationMs: 1000,
      autoCleanup: true,
      maxRetries: 2,
    });

    const duration = Date.now() - startTime;

    // 3. 显示结果
    console.log('3. 场景识别结果:');
    console.log('📊 分析结果:', {
      timestamp: new Date(result.timestamp).toISOString(),
      confidence: result.confidence,
      predictionsCount: result.predictions.length,
      duration: `${duration}ms`,
    });

    if (result.predictions.length > 0) {
      console.log('🏆 Top 3 预测:');
      result.predictions.slice(0, 3).forEach((pred, index) => {
        console.log(`   ${index + 1}. ${pred.label}: ${(pred.score * 100).toFixed(1)}%`);
      });
    }

  } catch (error) {
    console.error('❌ 手动分析失败:', error);
  } finally {
    analyzer.cleanup();
  }

  console.log('=== 手动场景识别演示完成 ===\n');
}

/**
 * 运行所有演示
 */
export async function runAllVolumeKeyDemos(): Promise<void> {
  console.log('🚀 开始音量键功能演示\n');

  try {
    await demoVolumeKeyBasic();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoVolumeKeyWithAnalysis();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoManualAnalysis();
    
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  }

  console.log('🎉 所有音量键功能演示完成');
}

// 导出默认演示函数
export default runAllVolumeKeyDemos;