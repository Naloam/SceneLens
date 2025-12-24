/**
 * 麦克风采样功能演示
 */

import sceneBridge from './SceneBridge';
import type { AudioData } from '../types';

/**
 * 测试麦克风权限
 */
export async function testMicrophonePermission(): Promise<boolean> {
  try {
    console.log('检查麦克风权限...');
    const hasPermission = await sceneBridge.hasMicrophonePermission();
    console.log('麦克风权限状态:', hasPermission);
    
    if (!hasPermission) {
      console.log('请求麦克风权限...');
      const granted = await sceneBridge.requestMicrophonePermission();
      console.log('权限请求结果:', granted);
      return granted;
    }
    
    return true;
  } catch (error) {
    console.error('麦克风权限检查失败:', error);
    return false;
  }
}

/**
 * 录制音频测试
 */
export async function testAudioRecording(durationMs: number = 1000): Promise<AudioData | null> {
  try {
    console.log(`开始录制音频，时长: ${durationMs}ms`);
    
    // 检查权限
    const hasPermission = await testMicrophonePermission();
    if (!hasPermission) {
      console.error('没有麦克风权限，无法录制音频');
      return null;
    }
    
    // 录制音频
    const startTime = Date.now();
    const audioData = await sceneBridge.recordAudio(durationMs);
    const endTime = Date.now();
    
    console.log('音频录制完成:', {
      duration: audioData.duration,
      sampleRate: audioData.sampleRate,
      format: audioData.format,
      dataSize: audioData.base64.length,
      actualDuration: endTime - startTime
    });
    
    return audioData;
  } catch (error) {
    console.error('音频录制失败:', error);
    return null;
  }
}

/**
 * 验证音频数据
 */
export function validateAudioData(audioData: AudioData): boolean {
  try {
    // 检查必需字段
    if (!audioData.base64 || audioData.base64.length === 0) {
      console.error('音频数据为空');
      return false;
    }
    
    if (audioData.duration <= 0) {
      console.error('音频时长无效:', audioData.duration);
      return false;
    }
    
    if (audioData.sampleRate <= 0) {
      console.error('采样率无效:', audioData.sampleRate);
      return false;
    }
    
    if (!audioData.format || audioData.format.length === 0) {
      console.error('音频格式无效:', audioData.format);
      return false;
    }
    
    if (audioData.timestamp <= 0) {
      console.error('时间戳无效:', audioData.timestamp);
      return false;
    }
    
    // 检查 Base64 格式
    try {
      atob(audioData.base64);
    } catch (e) {
      console.error('Base64 格式无效:', e);
      return false;
    }
    
    console.log('音频数据验证通过');
    return true;
  } catch (error) {
    console.error('音频数据验证失败:', error);
    return false;
  }
}

/**
 * 完整的麦克风功能测试
 */
export async function runMicrophoneTest(): Promise<boolean> {
  try {
    console.log('=== 开始麦克风功能测试 ===');
    
    // 1. 测试权限
    const hasPermission = await testMicrophonePermission();
    if (!hasPermission) {
      console.error('麦克风权限测试失败');
      return false;
    }
    
    // 2. 测试录制
    const audioData = await testAudioRecording(1000);
    if (!audioData) {
      console.error('音频录制测试失败');
      return false;
    }
    
    // 3. 验证数据
    const isValid = validateAudioData(audioData);
    if (!isValid) {
      console.error('音频数据验证失败');
      return false;
    }
    
    console.log('=== 麦克风功能测试通过 ===');
    return true;
  } catch (error) {
    console.error('麦克风功能测试失败:', error);
    return false;
  }
}

/**
 * 演示用户触发的音频采样
 */
export async function demoUserTriggeredAudioSampling(): Promise<void> {
  try {
    console.log('=== 用户触发音频采样演示 ===');
    
    // 模拟用户触发（双击音量键或点击快捷方式）
    console.log('用户触发识别...');
    
    // 快速音频采样（1秒）
    const audioData = await testAudioRecording(1000);
    if (!audioData) {
      console.error('音频采样失败');
      return;
    }
    
    console.log('音频采样成功，准备进行场景分析...');
    
    // 这里将来会调用 ModelRunner 进行音频分类
    // const predictions = await modelRunner.runAudioClassification(audioData);
    
    console.log('音频采样演示完成');
  } catch (error) {
    console.error('音频采样演示失败:', error);
  }
}