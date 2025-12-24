/**
 * UserTriggeredAnalyzer 使用示例
 */

import { UserTriggeredAnalyzer } from './UserTriggeredAnalyzer';

/**
 * 基本使用示例
 */
export async function basicUsageDemo() {
  console.log('=== UserTriggeredAnalyzer 基本使用示例 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 执行用户触发的场景分析
    const result = await analyzer.analyze();
    
    console.log('分析结果:', {
      timestamp: new Date(result.timestamp).toLocaleString(),
      confidence: result.confidence,
      predictionsCount: result.predictions.length,
      topPredictions: result.predictions.slice(0, 3).map(p => ({
        label: p.label,
        score: Math.round(p.score * 100) / 100
      }))
    });
    
  } catch (error) {
    console.error('分析失败:', error instanceof Error ? error.message : String(error));
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 自定义选项示例
 */
export async function customOptionsDemo() {
  console.log('=== UserTriggeredAnalyzer 自定义选项示例 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 使用自定义选项
    const result = await analyzer.analyze({
      audioDurationMs: 2000,  // 录制2秒音频
      autoCleanup: false,     // 不自动清理数据
      maxRetries: 1,          // 最多重试1次
    });
    
    console.log('自定义选项分析结果:', {
      confidence: result.confidence,
      predictions: result.predictions.map(p => p.label)
    });
    
    // 手动清理敏感数据
    console.log('手动清理敏感数据...');
    
  } catch (error) {
    console.error('自定义选项分析失败:', error instanceof Error ? error.message : String(error));
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 预加载模型示例
 */
export async function preloadModelsDemo() {
  console.log('=== UserTriggeredAnalyzer 预加载模型示例 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 预加载模型以提高性能
    console.log('预加载模型中...');
    await analyzer.preloadModels();
    
    console.log('模型信息:', analyzer.getModelInfo());
    
    // 现在分析会更快
    const startTime = Date.now();
    const result = await analyzer.analyze();
    const duration = Date.now() - startTime;
    
    console.log('预加载后分析耗时:', `${duration}ms`);
    console.log('分析结果:', {
      confidence: result.confidence,
      topPrediction: result.predictions[0]?.label
    });
    
  } catch (error) {
    console.error('预加载示例失败:', error instanceof Error ? error.message : String(error));
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 错误处理示例
 */
export async function errorHandlingDemo() {
  console.log('=== UserTriggeredAnalyzer 错误处理示例 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 检查分析状态
    console.log('当前是否正在分析:', analyzer.isAnalyzing());
    
    // 尝试并发分析（会失败）
    const promise1 = analyzer.analyze();
    
    try {
      await analyzer.analyze(); // 这会失败
    } catch (concurrentError) {
      console.log('预期的并发错误:', concurrentError instanceof Error ? concurrentError.message : String(concurrentError));
    }
    
    // 等待第一个分析完成
    const result = await promise1;
    console.log('第一个分析完成:', result.confidence);
    
  } catch (error) {
    console.error('错误处理示例失败:', error instanceof Error ? error.message : String(error));
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 运行所有示例
 */
export async function runAllDemos() {
  console.log('开始运行 UserTriggeredAnalyzer 示例...\n');
  
  await basicUsageDemo();
  console.log('\n');
  
  await customOptionsDemo();
  console.log('\n');
  
  await preloadModelsDemo();
  console.log('\n');
  
  await errorHandlingDemo();
  console.log('\n');
  
  console.log('所有示例运行完成！');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllDemos().catch(console.error);
}