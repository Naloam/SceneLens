/**
 * UserTriggeredAnalyzer 测试
 */

import { UserTriggeredAnalyzer } from '../UserTriggeredAnalyzer';
import { sceneBridge } from '../SceneBridge';
import { ModelRunner } from '../../ml/ModelRunner';
import { ErrorCode } from '../../types';

// Mock dependencies
jest.mock('../SceneBridge');
jest.mock('../../ml/ModelRunner');

const mockSceneBridge = sceneBridge as jest.Mocked<typeof sceneBridge>;
const MockModelRunner = ModelRunner as jest.MockedClass<typeof ModelRunner>;

describe('UserTriggeredAnalyzer', () => {
  let analyzer: UserTriggeredAnalyzer;
  let mockModelRunner: jest.Mocked<ModelRunner>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup ModelRunner mock
    mockModelRunner = {
      loadImageModel: jest.fn(),
      loadAudioModel: jest.fn(),
      runImageClassification: jest.fn(),
      runAudioClassification: jest.fn(),
      getModelInfo: jest.fn(),
      unloadModels: jest.fn(),
    } as any;
    
    MockModelRunner.mockImplementation(() => mockModelRunner);
    
    analyzer = new UserTriggeredAnalyzer();
  });

  afterEach(() => {
    analyzer.cleanup();
  });

  describe('analyze', () => {
    it('should successfully analyze with both camera and microphone permissions', async () => {
      // Setup permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      // Setup sampling data
      const mockImageData = {
        base64: 'mock-image-data',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };
      
      const mockAudioData = {
        base64: 'mock-audio-data',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };
      
      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);
      
      // Setup model predictions
      const mockImagePredictions = [
        { label: 'office', score: 0.8, index: 0 },
        { label: 'indoor', score: 0.6, index: 1 },
      ];
      
      const mockAudioPredictions = [
        { label: 'speech', score: 0.7, index: 0 },
        { label: 'quiet', score: 0.5, index: 1 },
      ];
      
      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);
      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);
      
      // Execute analysis
      const result = await analyzer.analyze();
      
      // Verify results
      expect(result).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.predictions).toHaveLength(4); // 2 image + 2 audio
      expect(result.confidence).toBe(0.8); // Highest score
      
      // Verify the predictions are properly tagged and sorted
      expect(result.predictions[0].label).toBe('image:office');
      expect(result.predictions[0].score).toBe(0.8);
      expect(result.predictions[1].label).toBe('audio:speech');
      expect(result.predictions[1].score).toBe(0.7);
      
      // Verify method calls
      expect(mockSceneBridge.hasCameraPermission).toHaveBeenCalled();
      expect(mockSceneBridge.hasMicrophonePermission).toHaveBeenCalled();
      expect(mockSceneBridge.captureImage).toHaveBeenCalled();
      expect(mockSceneBridge.recordAudio).toHaveBeenCalledWith(1000);
      expect(mockModelRunner.runImageClassification).toHaveBeenCalled();
      expect(mockModelRunner.runAudioClassification).toHaveBeenCalled();
    });

    it('should work with only camera permission', async () => {
      // Setup permissions - only camera
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);
      
      // Setup image data
      const mockImageData = {
        base64: 'mock-image-data',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };
      
      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      
      // Setup model predictions
      const mockImagePredictions = [
        { label: 'office', score: 0.8, index: 0 },
      ];
      
      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);
      
      // Execute analysis
      const result = await analyzer.analyze();
      
      // Verify results
      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].label).toBe('image:office');
      expect(result.confidence).toBe(0.8);
      
      // Verify audio methods were not called
      expect(mockSceneBridge.recordAudio).not.toHaveBeenCalled();
      expect(mockModelRunner.runAudioClassification).not.toHaveBeenCalled();
    });

    it('should work with only microphone permission', async () => {
      // Setup permissions - only microphone
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      // Setup audio data
      const mockAudioData = {
        base64: 'mock-audio-data',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };
      
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);
      
      // Setup model predictions
      const mockAudioPredictions = [
        { label: 'speech', score: 0.7, index: 0 },
      ];
      
      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);
      
      // Execute analysis
      const result = await analyzer.analyze();
      
      // Verify results
      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].label).toBe('audio:speech');
      expect(result.confidence).toBe(0.7);
      
      // Verify camera methods were not called
      expect(mockSceneBridge.captureImage).not.toHaveBeenCalled();
      expect(mockModelRunner.runImageClassification).not.toHaveBeenCalled();
    });

    it('should throw error when no permissions are granted', async () => {
      // Setup no permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);
      
      // Execute and expect error
      await expect(analyzer.analyze()).rejects.toThrow('需要相机或麦克风权限才能进行场景识别');
    });

    it('should handle sampling failures gracefully', async () => {
      // Setup permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      // Setup sampling failures
      mockSceneBridge.captureImage.mockRejectedValue(new Error('Camera failed'));
      mockSceneBridge.recordAudio.mockRejectedValue(new Error('Microphone failed'));
      
      // Execute and expect error (no data available) - disable retries
      await expect(analyzer.analyze({ maxRetries: 0 })).rejects.toThrow('没有可用的输入数据进行推理');
    });

    it('should handle model inference failures', async () => {
      // Setup permissions and data
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);
      
      const mockImageData = {
        base64: 'mock-image-data',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };
      
      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      
      // Setup model failure
      mockModelRunner.runImageClassification.mockRejectedValue(new Error('Model failed'));
      
      // Execute and expect error - disable retries
      await expect(analyzer.analyze({ maxRetries: 0 })).rejects.toThrow('模型推理未产生任何预测结果');
    });

    it('should prevent concurrent analysis', async () => {
      // Setup permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);
      
      // Make the first call hang
      mockSceneBridge.captureImage.mockImplementation(() => new Promise(() => {}));
      
      // Start first analysis
      const firstAnalysis = analyzer.analyze();
      
      // Try to start second analysis immediately
      await expect(analyzer.analyze()).rejects.toThrow('分析正在进行中，请稍后再试');
      
      // Cleanup
      firstAnalysis.catch(() => {}); // Prevent unhandled rejection
    });

    it('should use custom options', async () => {
      // Setup permissions
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      
      const mockAudioData = {
        base64: 'mock-audio-data',
        duration: 2000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };
      
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);
      mockModelRunner.runAudioClassification.mockResolvedValue([
        { label: 'speech', score: 0.7, index: 0 },
      ]);
      
      // Execute with custom options
      await analyzer.analyze({
        audioDurationMs: 2000,
        autoCleanup: false,
        maxRetries: 0,
      });
      
      // Verify custom duration was used
      expect(mockSceneBridge.recordAudio).toHaveBeenCalledWith(2000);
    });
  });

  describe('utility methods', () => {
    it('should report analyzing status correctly', () => {
      expect(analyzer.isAnalyzing()).toBe(false);
    });

    it('should preload models', async () => {
      mockModelRunner.loadImageModel.mockResolvedValue();
      mockModelRunner.loadAudioModel.mockResolvedValue();
      
      await analyzer.preloadModels();
      
      expect(mockModelRunner.loadImageModel).toHaveBeenCalled();
      expect(mockModelRunner.loadAudioModel).toHaveBeenCalled();
    });

    it('should handle preload failures gracefully', async () => {
      mockModelRunner.loadImageModel.mockRejectedValue(new Error('Load failed'));
      mockModelRunner.loadAudioModel.mockRejectedValue(new Error('Load failed'));
      
      // Should not throw
      await expect(analyzer.preloadModels()).resolves.toBeUndefined();
    });

    it('should get model info', () => {
      const mockInfo = { image: { inputs: [], outputs: [] } };
      mockModelRunner.getModelInfo.mockReturnValue(mockInfo);
      
      const info = analyzer.getModelInfo();
      expect(info).toBe(mockInfo);
    });

    it('should cleanup resources', () => {
      analyzer.cleanup();
      
      expect(mockModelRunner.unloadModels).toHaveBeenCalled();
      expect(analyzer.isAnalyzing()).toBe(false);
    });
  });
});