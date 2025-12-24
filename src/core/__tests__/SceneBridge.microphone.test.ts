/**
 * SceneBridge 麦克风功能测试
 */

import sceneBridge from '../SceneBridge';
import type { AudioData } from '../../types';

// Mock the native module for testing
jest.mock('react-native', () => ({
  NativeModules: {
    SceneBridge: {
      hasMicrophonePermission: jest.fn(),
      requestMicrophonePermission: jest.fn(),
      recordAudio: jest.fn(),
    },
  },
}));

describe('SceneBridge Microphone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('权限管理', () => {
    it('应该能检查麦克风权限', async () => {
      const mockHasPermission = require('react-native').NativeModules.SceneBridge.hasMicrophonePermission;
      mockHasPermission.mockResolvedValue(true);

      const hasPermission = await sceneBridge.hasMicrophonePermission();
      
      expect(hasPermission).toBe(true);
      expect(mockHasPermission).toHaveBeenCalledTimes(1);
    });

    it('应该能请求麦克风权限', async () => {
      const mockRequestPermission = require('react-native').NativeModules.SceneBridge.requestMicrophonePermission;
      mockRequestPermission.mockResolvedValue(true);

      const granted = await sceneBridge.requestMicrophonePermission();
      
      expect(granted).toBe(true);
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });

    it('权限被拒绝时应该返回 false', async () => {
      const mockHasPermission = require('react-native').NativeModules.SceneBridge.hasMicrophonePermission;
      mockHasPermission.mockResolvedValue(false);

      const hasPermission = await sceneBridge.hasMicrophonePermission();
      
      expect(hasPermission).toBe(false);
    });
  });

  describe('音频录制', () => {
    const mockAudioData: AudioData = {
      base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', // 简单的 WAV 文件
      duration: 1000,
      sampleRate: 16000,
      format: 'WAV',
      timestamp: Date.now(),
    };

    it('应该能录制 1 秒音频', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      mockRecordAudio.mockResolvedValue(mockAudioData);

      const audioData = await sceneBridge.recordAudio(1000);
      
      expect(audioData).toEqual(mockAudioData);
      expect(mockRecordAudio).toHaveBeenCalledWith(1000);
    });

    it('应该能录制不同时长的音频', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      const durations = [500, 1000, 2000];

      for (const duration of durations) {
        const expectedData = { ...mockAudioData, duration };
        mockRecordAudio.mockResolvedValue(expectedData);

        const audioData = await sceneBridge.recordAudio(duration);
        
        expect(audioData.duration).toBe(duration);
        expect(mockRecordAudio).toHaveBeenCalledWith(duration);
      }
    });

    it('返回的音频数据应该包含所有必需字段', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      mockRecordAudio.mockResolvedValue(mockAudioData);

      const audioData = await sceneBridge.recordAudio(1000);
      
      expect(audioData).toHaveProperty('base64');
      expect(audioData).toHaveProperty('duration');
      expect(audioData).toHaveProperty('sampleRate');
      expect(audioData).toHaveProperty('format');
      expect(audioData).toHaveProperty('timestamp');
      
      expect(typeof audioData.base64).toBe('string');
      expect(typeof audioData.duration).toBe('number');
      expect(typeof audioData.sampleRate).toBe('number');
      expect(typeof audioData.format).toBe('string');
      expect(typeof audioData.timestamp).toBe('number');
    });

    it('音频数据应该符合预期格式', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      mockRecordAudio.mockResolvedValue(mockAudioData);

      const audioData = await sceneBridge.recordAudio(1000);
      
      expect(audioData.duration).toBe(1000);
      expect(audioData.sampleRate).toBe(16000);
      expect(audioData.format).toBe('WAV');
      expect(audioData.base64.length).toBeGreaterThan(0);
      expect(audioData.timestamp).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('权限检查失败时应该抛出错误', async () => {
      const mockHasPermission = require('react-native').NativeModules.SceneBridge.hasMicrophonePermission;
      mockHasPermission.mockRejectedValue(new Error('Permission check failed'));

      await expect(sceneBridge.hasMicrophonePermission()).rejects.toThrow('Permission check failed');
    });

    it('音频录制失败时应该抛出错误', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      mockRecordAudio.mockRejectedValue(new Error('Recording failed'));

      await expect(sceneBridge.recordAudio(1000)).rejects.toThrow('Recording failed');
    });

    it('无效参数时应该处理错误', async () => {
      const mockRecordAudio = require('react-native').NativeModules.SceneBridge.recordAudio;
      mockRecordAudio.mockRejectedValue(new Error('Invalid duration'));

      await expect(sceneBridge.recordAudio(-1)).rejects.toThrow('Invalid duration');
    });
  });

  describe('fallback 行为', () => {
    it('原生模块不可用时应该使用 fallback', async () => {
      // 重新导入模块以获取 fallback 行为
      jest.resetModules();
      
      // Mock NativeModules to return null
      jest.doMock('react-native', () => ({
        NativeModules: {
          SceneBridge: null,
        },
      }));
      
      const { sceneBridge: fallbackBridge } = require('../SceneBridge');

      const hasPermission = await fallbackBridge.hasMicrophonePermission();
      const audioData = await fallbackBridge.recordAudio(1000);

      expect(hasPermission).toBe(true); // fallback 返回 true
      expect(audioData).toEqual({
        base64: '',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: expect.any(Number),
      });
    });
  });
});