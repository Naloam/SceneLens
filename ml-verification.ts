/**
 * AI 模型验证脚本
 * 验证模型文件是否存在且可访问
 */

import { ModelRunner } from './src/ml/ModelRunner';

console.log('========================================');
console.log('SceneLens AI 模型验证');
console.log('========================================\n');

async function verifyModels() {
  const modelRunner = new ModelRunner();

  // 验证 1: 检查模型文件是否存在
  console.log('1. 检查模型文件...');
  try {
    const imageModelPath = require('./assets/models/mobilenet_v3_small_quant.tflite');
    console.log('   ✓ mobilenet_v3_small_quant.tflite 可访问');
    console.log('   路径:', imageModelPath);
  } catch (error) {
    console.error('   ✗ mobilenet_v3_small_quant.tflite 无法访问:', error);
  }

  try {
    const audioModelPath = require('./assets/models/yamnet_lite_quant.tflite');
    console.log('   ✓ yamnet_lite_quant.tflite 可访问');
    console.log('   路径:', audioModelPath);
  } catch (error) {
    console.error('   ✗ yamnet_lite_quant.tflite 无法访问:', error);
  }

  // 验证 2: 加载图像分类模型
  console.log('\n2. 加载图像分类模型...');
  try {
    await modelRunner.loadImageModel();
    console.log('   ✓ 图像模型加载成功');
    console.log('   模型信息:', modelRunner.getModelInfo().image);
  } catch (error) {
    console.error('   ✗ 图像模型加载失败:', error);
  }

  // 验证 3: 加载音频分类模型
  console.log('\n3. 加载音频分类模型...');
  try {
    await modelRunner.loadAudioModel();
    console.log('   ✓ 音频模型加载成功');
    console.log('   模型信息:', modelRunner.getModelInfo().audio);
  } catch (error) {
    console.error('   ✗ 音频模型加载失败:', error);
  }

  // 验证 4: 测试图像推理（使用模拟数据）
  console.log('\n4. 测试图像推理...');
  try {
    const mockImageData = {
      uri: 'mock://test.jpg',
      width: 224,
      height: 224,
    };

    const predictions = await modelRunner.runImageClassification(mockImageData);
    console.log('   ✓ 图像推理成功');
    console.log('   Top 3 预测:');
    predictions.slice(0, 3).forEach((pred, i) => {
      console.log(`      ${i + 1}. ${pred.label}: ${(pred.score * 100).toFixed(1)}%`);
    });
  } catch (error) {
    console.error('   ✗ 图像推理失败:', error);
  }

  // 验证 5: 测试音频推理（使用模拟数据）
  console.log('\n5. 测试音频推理...');
  try {
    const mockAudioData = {
      samples: new Float32Array(16000).fill(0).map(() => Math.random() * 2 - 1),
      sampleRate: 16000,
      duration: 1.0,
    };

    const predictions = await modelRunner.runAudioClassification(mockAudioData);
    console.log('   ✓ 音频推理成功');
    console.log('   Top 3 预测:');
    predictions.slice(0, 3).forEach((pred, i) => {
      console.log(`      ${i + 1}. ${pred.label}: ${(pred.score * 100).toFixed(1)}%`);
    });
  } catch (error) {
    console.error('   ✗ 音频推理失败:', error);
  }

  console.log('\n========================================');
  console.log('验证完成');
  console.log('========================================');
}

// 运行验证
verifyModels().catch(console.error);
