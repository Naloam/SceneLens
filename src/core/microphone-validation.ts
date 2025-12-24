/**
 * 麦克风功能验证
 */

import sceneBridge from './SceneBridge';
import type { AudioData } from '../types';

/**
 * 验证麦克风权限功能
 */
export async function validateMicrophonePermissions(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // 测试权限检查方法
    const hasPermission = await sceneBridge.hasMicrophonePermission();
    console.log('麦克风权限状态:', hasPermission);
    
    // 测试权限请求方法
    if (!hasPermission) {
      const requestResult = await sceneBridge.requestMicrophonePermission();
      console.log('权限请求结果:', requestResult);
      
      if (!requestResult) {
        errors.push('权限请求失败');
      }
    }
  } catch (error) {
    errors.push(`权限检查失败: ${error}`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * 验证音频录制功能
 */
export async function validateAudioRecording(): Promise<{
  success: boolean;
  errors: string[];
  audioData?: AudioData;
}> {
  const errors: string[] = [];
  let audioData: AudioData | undefined;
  
  try {
    // 检查权限
    const hasPermission = await sceneBridge.hasMicrophonePermission();
    if (!hasPermission) {
      errors.push('没有麦克风权限');
      return { success: false, errors };
    }
    
    // 测试短时间录制
    console.log('开始录制 1 秒音频...');
    const startTime = Date.now();
    audioData = await sceneBridge.recordAudio(1000);
    const endTime = Date.now();
    
    // 验证录制时间
    const actualDuration = endTime - startTime;
    if (actualDuration < 900 || actualDuration > 1500) {
      errors.push(`录制时间异常: ${actualDuration}ms (期望: ~1000ms)`);
    }
    
    // 验证音频数据结构
    if (!audioData) {
      errors.push('音频数据为空');
      return { success: false, errors };
    }
    
    // 验证必需字段
    if (!audioData.base64 || audioData.base64.length === 0) {
      errors.push('音频 base64 数据为空');
    }
    
    if (audioData.duration !== 1000) {
      errors.push(`音频时长不匹配: ${audioData.duration}ms (期望: 1000ms)`);
    }
    
    if (audioData.sampleRate !== 16000) {
      errors.push(`采样率不匹配: ${audioData.sampleRate}Hz (期望: 16000Hz)`);
    }
    
    if (audioData.format !== 'WAV') {
      errors.push(`音频格式不匹配: ${audioData.format} (期望: WAV)`);
    }
    
    if (audioData.timestamp <= 0) {
      errors.push('时间戳无效');
    }
    
    // 验证 Base64 格式
    try {
      const decoded = atob(audioData.base64);
      if (decoded.length === 0) {
        errors.push('Base64 解码后数据为空');
      }
      
      // 检查 WAV 文件头
      if (!decoded.startsWith('RIFF')) {
        errors.push('WAV 文件头不正确');
      }
    } catch (e) {
      errors.push(`Base64 解码失败: ${e}`);
    }
    
  } catch (error) {
    errors.push(`音频录制失败: ${error}`);
  }
  
  return {
    success: errors.length === 0,
    errors,
    audioData
  };
}

/**
 * 验证不同时长的录制
 */
export async function validateDifferentDurations(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const durations = [500, 1000, 2000]; // 0.5s, 1s, 2s
  
  try {
    for (const duration of durations) {
      console.log(`测试 ${duration}ms 录制...`);
      
      const startTime = Date.now();
      const audioData = await sceneBridge.recordAudio(duration);
      const endTime = Date.now();
      
      const actualDuration = endTime - startTime;
      const tolerance = duration * 0.2; // 20% 容差
      
      if (Math.abs(actualDuration - duration) > tolerance) {
        errors.push(`${duration}ms 录制时间异常: ${actualDuration}ms`);
      }
      
      if (audioData.duration !== duration) {
        errors.push(`${duration}ms 录制返回时长不匹配: ${audioData.duration}ms`);
      }
      
      if (!audioData.base64 || audioData.base64.length === 0) {
        errors.push(`${duration}ms 录制数据为空`);
      }
    }
  } catch (error) {
    errors.push(`不同时长录制测试失败: ${error}`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * 完整的麦克风功能验证
 */
export async function runFullMicrophoneValidation(): Promise<{
  success: boolean;
  results: {
    permissions: { success: boolean; errors: string[] };
    recording: { success: boolean; errors: string[]; audioData?: AudioData };
    durations: { success: boolean; errors: string[] };
  };
}> {
  console.log('=== 开始麦克风功能完整验证 ===');
  
  // 1. 验证权限功能
  console.log('1. 验证权限功能...');
  const permissionResults = await validateMicrophonePermissions();
  
  // 2. 验证录制功能
  console.log('2. 验证录制功能...');
  const recordingResults = await validateAudioRecording();
  
  // 3. 验证不同时长录制
  console.log('3. 验证不同时长录制...');
  const durationResults = await validateDifferentDurations();
  
  const allSuccess = permissionResults.success && recordingResults.success && durationResults.success;
  
  console.log('=== 麦克风功能验证完成 ===');
  console.log('权限功能:', permissionResults.success ? '✓' : '✗');
  console.log('录制功能:', recordingResults.success ? '✓' : '✗');
  console.log('时长测试:', durationResults.success ? '✓' : '✗');
  console.log('总体结果:', allSuccess ? '✓ 通过' : '✗ 失败');
  
  if (!allSuccess) {
    console.log('错误详情:');
    [...permissionResults.errors, ...recordingResults.errors, ...durationResults.errors]
      .forEach(error => console.log(`  - ${error}`));
  }
  
  return {
    success: allSuccess,
    results: {
      permissions: permissionResults,
      recording: recordingResults,
      durations: durationResults
    }
  };
}