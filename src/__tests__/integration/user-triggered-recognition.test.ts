/**
 * 用户触发识别集成测试
 * 
 * 测试需求：
 * - 双击音量键触发识别
 * - 验证相机和麦克风采样
 * - 验证模型推理结果
 * - 验证场景融合
 * 
 * Requirements: 需求 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { UserTriggeredAnalyzer } from '../../core/UserTriggeredAnalyzer';
import { VolumeKeyListener } from '../../core/VolumeKeyListener';
import { ShortcutManager } from '../../core/ShortcutManager';
import { sceneBridge } from '../../core/SceneBridge';
import { ModelRunner, type Prediction as ModelPrediction } from '../../ml/ModelRunner';
import type { TriggeredContext, ImageData, AudioData, Prediction } from '../../types';

// Mock dependencies
jest.mock('../../core/SceneBridge');
jest.mock('../../ml/ModelRunner');
jest.mock('../../core/VolumeKeyListener');
jest.mock('../../core/ShortcutManager');

const mockSceneBridge = sceneBridge as jest.Mocked<typeof sceneBridge>;
const MockModelRunner = ModelRunner as jest.MockedClass<typeof ModelRunner>;
const MockVolumeKeyListener = VolumeKeyListener as jest.MockedClass<typeof VolumeKeyListener>;
const MockShortcutManager = ShortcutManager as jest.MockedClass<typeof ShortcutManager>;

describe('用户触发识别集成测试', () => {
  let analyzer: UserTriggeredAnalyzer;
  let mockModelRunner: jest.Mocked<ModelRunner>;
  let mockVolumeKeyListener: jest.Mocked<VolumeKeyListener>;
  let mockShortcutManager: jest.Mocked<ShortcutManager>;

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

    // Setup VolumeKeyListener mock
    mockVolumeKeyListener = {
      enable: jest.fn(),
      disable: jest.fn(),
      isListening: jest.fn(),
      checkNativeStatus: jest.fn(),
      test: jest.fn(),
      cleanup: jest.fn(),
    } as any;
    MockVolumeKeyListener.mockImplementation(() => mockVolumeKeyListener);

    // Setup ShortcutManager mock
    mockShortcutManager = {
      enableShortcutListener: jest.fn(),
      disableShortcutListener: jest.fn(),
      createSceneAnalysisShortcut: jest.fn(),
      removeSceneAnalysisShortcut: jest.fn(),
      isShortcutSupported: jest.fn(),
      cleanup: jest.fn(),
    } as any;
    MockShortcutManager.mockImplementation(() => mockShortcutManager);

    analyzer = new UserTriggeredAnalyzer();
  });

  afterEach(() => {
    analyzer.cleanup();
  });

  describe('双击音量键触发识别 (需求 8.1)', () => {
    it('应该成功启用音量键双击触发', async () => {
      // Setup
      mockVolumeKeyListener.enable.mockResolvedValue(true);

      // Execute
      const result = await analyzer.enableVolumeKeyTrigger(false); // 不自动分析，便于测试

      // Verify
      expect(result).toBe(true);
      expect(mockVolumeKeyListener.enable).toHaveBeenCalledWith(expect.any(Function));
      expect(analyzer.isVolumeKeyTriggerEnabled()).toBe(true);
    });

    it('应该在音量键双击时触发场景识别', async () => {
      // Setup permissions and data
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      const mockImageData: ImageData = {
        base64: 'mock-image-data',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };
      
      const mockAudioData: AudioData = {
        base64: 'mock-audio-data',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      // Setup model predictions
      const mockImagePredictions: ModelPrediction[] = [
        { label: 'office', score: 0.85, index: 0 },
        { label: 'indoor', score: 0.65, index: 1 },
      ];
      
      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'speech', score: 0.75, index: 0 },
        { label: 'quiet', score: 0.55, index: 1 },
      ];

      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);
      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      let volumeKeyCallback: any = null;
      mockVolumeKeyListener.enable.mockImplementation((callback) => {
        volumeKeyCallback = callback;
        return Promise.resolve(true);
      });

      // Enable volume key trigger with auto-analyze
      await analyzer.enableVolumeKeyTrigger(true);

      // Simulate volume key double tap
      expect(volumeKeyCallback).toBeDefined();
      
      // Create a promise to wait for the analysis to complete
      const analysisPromise = new Promise<TriggeredContext>((resolve) => {
        // Mock the analyze method to capture the result
        const originalAnalyze = analyzer.analyze.bind(analyzer);
        jest.spyOn(analyzer, 'analyze').mockImplementation(async (options) => {
          const result = await originalAnalyze(options);
          resolve(result);
          return result;
        });
      });

      // Trigger the callback
      volumeKeyCallback({
        trigger: 'volume_key_double_tap',
        timestamp: Date.now(),
      });

      // Wait for analysis to complete
      const result = await analysisPromise;

      // Verify the analysis was triggered and completed
      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(4); // 2 image + 2 audio
      expect(result.confidence).toBe(0.85); // Highest score
      expect(result.predictions[0].label).toBe('image:office');
    });

    it('应该处理音量键启用失败的情况', async () => {
      // Setup
      mockVolumeKeyListener.enable.mockResolvedValue(false);

      // Execute
      const result = await analyzer.enableVolumeKeyTrigger();

      // Verify
      expect(result).toBe(false);
      expect(analyzer.isVolumeKeyTriggerEnabled()).toBe(false);
    });

    it('应该成功禁用音量键触发', async () => {
      // Setup - first enable
      mockVolumeKeyListener.enable.mockResolvedValue(true);
      mockVolumeKeyListener.disable.mockResolvedValue(true);
      
      await analyzer.enableVolumeKeyTrigger();

      // Execute
      const result = await analyzer.disableVolumeKeyTrigger();

      // Verify
      expect(result).toBe(true);
      expect(mockVolumeKeyListener.disable).toHaveBeenCalled();
      expect(analyzer.isVolumeKeyTriggerEnabled()).toBe(false);
    });

    it('应该成功测试音量键功能', async () => {
      // Setup
      mockVolumeKeyListener.test.mockResolvedValue(true);

      // Execute
      const result = await analyzer.testVolumeKeyTrigger();

      // Verify
      expect(result).toBe(true);
      expect(mockVolumeKeyListener.test).toHaveBeenCalled();
    });
  });

  describe('桌面快捷方式触发识别 (需求 8.1)', () => {
    it('应该成功启用桌面快捷方式触发', async () => {
      // Setup
      mockShortcutManager.enableShortcutListener.mockReturnValue(true);

      // Execute
      const result = await analyzer.enableShortcutTrigger(false); // 不自动分析

      // Verify
      expect(result).toBe(true);
      expect(mockShortcutManager.enableShortcutListener).toHaveBeenCalledWith(expect.any(Function));
      expect(analyzer.isShortcutTriggerEnabled()).toBe(true);
    });

    it('应该在快捷方式触发时进行场景识别', async () => {
      // Setup permissions and data
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      const mockAudioData: AudioData = {
        base64: 'mock-audio-data',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'traffic', score: 0.80, index: 0 },
        { label: 'outdoor', score: 0.60, index: 1 },
      ];

      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      let shortcutCallback: any = null;
      mockShortcutManager.enableShortcutListener.mockImplementation((callback) => {
        shortcutCallback = callback;
        return true;
      });

      // Enable shortcut trigger with auto-analyze
      await analyzer.enableShortcutTrigger(true);

      // Create a promise to wait for the analysis to complete
      const analysisPromise = new Promise<TriggeredContext>((resolve) => {
        const originalAnalyze = analyzer.analyze.bind(analyzer);
        jest.spyOn(analyzer, 'analyze').mockImplementation(async (options) => {
          const result = await originalAnalyze(options);
          resolve(result);
          return result;
        });
      });

      // Simulate shortcut trigger
      expect(shortcutCallback).toBeDefined();
      shortcutCallback({
        shortcutId: 'scene_analysis',
        timestamp: Date.now(),
      });

      // Wait for analysis to complete
      const result = await analysisPromise;

      // Verify the analysis was triggered and completed
      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(2); // Only audio predictions
      expect(result.confidence).toBe(0.80);
      expect(result.predictions[0].label).toBe('audio:traffic');
    });

    it('应该成功创建桌面快捷方式', async () => {
      // Setup
      mockShortcutManager.createSceneAnalysisShortcut.mockResolvedValue(true);

      // Execute
      const result = await analyzer.createDesktopShortcut();

      // Verify
      expect(result).toBe(true);
      expect(mockShortcutManager.createSceneAnalysisShortcut).toHaveBeenCalled();
    });

    it('应该检查快捷方式支持状态', async () => {
      // Setup
      mockShortcutManager.isShortcutSupported.mockResolvedValue(true);

      // Execute
      const result = await analyzer.isShortcutSupported();

      // Verify
      expect(result).toBe(true);
      expect(mockShortcutManager.isShortcutSupported).toHaveBeenCalled();
    });
  });

  describe('相机和麦克风采样 (需求 8.2, 8.3)', () => {
    it('应该成功进行相机采样', async () => {
      // Setup permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      const mockImageData: ImageData = {
        base64: 'mock-image-data-base64',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);

      const mockImagePredictions: ModelPrediction[] = [
        { label: 'kitchen', score: 0.90, index: 0 },
        { label: 'indoor', score: 0.70, index: 1 },
      ];

      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);

      // Execute
      const result = await analyzer.analyze();

      // Verify camera sampling
      expect(mockSceneBridge.hasCameraPermission).toHaveBeenCalled();
      expect(mockSceneBridge.captureImage).toHaveBeenCalled();
      expect(mockModelRunner.runImageClassification).toHaveBeenCalledWith({
        uri: 'data:image/jpeg;base64,mock-image-data-base64',
        width: 224,
        height: 224,
      });

      // Verify results
      expect(result.predictions).toHaveLength(2);
      expect(result.predictions[0].label).toBe('image:kitchen');
      expect(result.confidence).toBe(0.90);
    });

    it('应该成功进行麦克风采样', async () => {
      // Setup permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);

      const mockAudioData: AudioData = {
        base64: 'mock-audio-data-base64',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'music', score: 0.85, index: 0 },
        { label: 'indoor', score: 0.65, index: 1 },
      ];

      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      // Execute
      const result = await analyzer.analyze({ audioDurationMs: 1000 });

      // Verify microphone sampling
      expect(mockSceneBridge.hasMicrophonePermission).toHaveBeenCalled();
      expect(mockSceneBridge.recordAudio).toHaveBeenCalledWith(1000);
      expect(mockModelRunner.runAudioClassification).toHaveBeenCalledWith({
        samples: expect.any(Float32Array),
        sampleRate: 16000,
        duration: 1000,
      });

      // Verify results
      expect(result.predictions).toHaveLength(2);
      expect(result.predictions[0].label).toBe('audio:music');
      expect(result.confidence).toBe(0.85);
    });

    it('应该处理采样失败的情况', async () => {
      // Setup permissions but sampling fails
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);
      
      mockSceneBridge.captureImage.mockRejectedValue(new Error('Camera failed'));
      mockSceneBridge.recordAudio.mockRejectedValue(new Error('Microphone failed'));

      // Execute and expect error
      await expect(analyzer.analyze({ maxRetries: 0 })).rejects.toThrow('没有可用的输入数据进行推理');
    });

    it('应该处理权限被拒绝的情况', async () => {
      // Setup - no permissions granted
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      // Execute and expect error
      await expect(analyzer.analyze()).rejects.toThrow('需要相机或麦克风权限才能进行场景识别');
    });
  });

  describe('模型推理结果 (需求 8.4)', () => {
    it('应该正确处理图像分类结果', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);

      const mockImagePredictions: ModelPrediction[] = [
        { label: 'office', score: 0.92, index: 0 },
        { label: 'indoor', score: 0.78, index: 1 },
        { label: 'workspace', score: 0.65, index: 2 },
      ];

      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);

      // Execute
      const result = await analyzer.analyze();

      // Verify model inference
      expect(mockModelRunner.runImageClassification).toHaveBeenCalled();
      
      // Verify results are properly tagged and sorted
      expect(result.predictions).toHaveLength(3);
      expect(result.predictions[0].label).toBe('image:office');
      expect(result.predictions[0].score).toBe(0.92);
      expect(result.predictions[1].label).toBe('image:indoor');
      expect(result.predictions[1].score).toBe(0.78);
      expect(result.predictions[2].label).toBe('image:workspace');
      expect(result.predictions[2].score).toBe(0.65);
      
      // Verify confidence is the highest score
      expect(result.confidence).toBe(0.92);
    });

    it('应该正确处理音频分类结果', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(false);
      mockSceneBridge.requestCameraPermission.mockResolvedValue(false);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);

      const mockAudioData: AudioData = {
        base64: 'test-audio',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'speech', score: 0.88, index: 0 },
        { label: 'conversation', score: 0.72, index: 1 },
        { label: 'indoor', score: 0.58, index: 2 },
      ];

      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      // Execute
      const result = await analyzer.analyze();

      // Verify model inference
      expect(mockModelRunner.runAudioClassification).toHaveBeenCalled();
      
      // Verify results are properly tagged and sorted
      expect(result.predictions).toHaveLength(3);
      expect(result.predictions[0].label).toBe('audio:speech');
      expect(result.predictions[0].score).toBe(0.88);
      expect(result.predictions[1].label).toBe('audio:conversation');
      expect(result.predictions[1].score).toBe(0.72);
      expect(result.predictions[2].label).toBe('audio:indoor');
      expect(result.predictions[2].score).toBe(0.58);
      
      // Verify confidence is the highest score
      expect(result.confidence).toBe(0.88);
    });

    it('应该处理模型推理失败', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockModelRunner.runImageClassification.mockRejectedValue(new Error('Model inference failed'));

      // Execute and expect error
      await expect(analyzer.analyze({ maxRetries: 0 })).rejects.toThrow('模型推理未产生任何预测结果');
    });
  });

  describe('场景融合 (需求 8.5)', () => {
    it('应该正确融合图像和音频预测结果', async () => {
      // Setup both permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      const mockAudioData: AudioData = {
        base64: 'test-audio',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      // Different confidence scores to test fusion
      const mockImagePredictions: ModelPrediction[] = [
        { label: 'office', score: 0.85, index: 0 },
        { label: 'indoor', score: 0.70, index: 1 },
      ];

      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'keyboard_typing', score: 0.90, index: 0 }, // Higher than image
        { label: 'quiet', score: 0.60, index: 1 },
      ];

      mockModelRunner.runImageClassification.mockResolvedValue(mockImagePredictions);
      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      // Execute
      const result = await analyzer.analyze();

      // Verify fusion results
      expect(result.predictions).toHaveLength(4); // 2 image + 2 audio
      
      // Verify predictions are sorted by confidence across modalities
      expect(result.predictions[0].label).toBe('audio:keyboard_typing');
      expect(result.predictions[0].score).toBe(0.90);
      expect(result.predictions[1].label).toBe('image:office');
      expect(result.predictions[1].score).toBe(0.85);
      expect(result.predictions[2].label).toBe('image:indoor');
      expect(result.predictions[2].score).toBe(0.70);
      expect(result.predictions[3].label).toBe('audio:quiet');
      expect(result.predictions[3].score).toBe(0.60);

      // Verify overall confidence is the highest across all predictions
      expect(result.confidence).toBe(0.90);
    });

    it('应该在单一模态失败时继续处理', async () => {
      // Setup both permissions
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      const mockAudioData: AudioData = {
        base64: 'test-audio',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      // Image inference fails, but audio succeeds
      mockModelRunner.runImageClassification.mockRejectedValue(new Error('Image model failed'));
      
      const mockAudioPredictions: ModelPrediction[] = [
        { label: 'music', score: 0.80, index: 0 },
        { label: 'indoor', score: 0.60, index: 1 },
      ];
      mockModelRunner.runAudioClassification.mockResolvedValue(mockAudioPredictions);

      // Execute
      const result = await analyzer.analyze();

      // Verify only audio predictions are included
      expect(result.predictions).toHaveLength(2);
      expect(result.predictions[0].label).toBe('audio:music');
      expect(result.predictions[0].score).toBe(0.80);
      expect(result.predictions[1].label).toBe('audio:indoor');
      expect(result.predictions[1].score).toBe(0.60);
      expect(result.confidence).toBe(0.80);
    });

    it('应该正确处理空预测结果', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(true);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      const mockAudioData: AudioData = {
        base64: 'test-audio',
        duration: 1000,
        sampleRate: 16000,
        format: 'WAV',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockSceneBridge.recordAudio.mockResolvedValue(mockAudioData);

      // Both models return empty predictions
      mockModelRunner.runImageClassification.mockResolvedValue([]);
      mockModelRunner.runAudioClassification.mockResolvedValue([]);

      // Execute and expect error
      await expect(analyzer.analyze()).rejects.toThrow('模型推理未产生任何预测结果');
    });
  });

  describe('并发控制和资源管理', () => {
    it('应该防止并发分析', async () => {
      // Setup
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

    it('应该正确报告分析状态', () => {
      expect(analyzer.isAnalyzing()).toBe(false);
    });

    it('应该成功预加载模型', async () => {
      // Setup
      mockModelRunner.loadImageModel.mockResolvedValue();
      mockModelRunner.loadAudioModel.mockResolvedValue();

      // Execute
      await analyzer.preloadModels();

      // Verify
      expect(mockModelRunner.loadImageModel).toHaveBeenCalled();
      expect(mockModelRunner.loadAudioModel).toHaveBeenCalled();
    });

    it('应该正确清理资源', () => {
      // Execute
      analyzer.cleanup();

      // Verify
      expect(mockModelRunner.unloadModels).toHaveBeenCalled();
      expect(mockVolumeKeyListener.cleanup).toHaveBeenCalled();
      expect(mockShortcutManager.cleanup).toHaveBeenCalled();
      expect(analyzer.isAnalyzing()).toBe(false);
      expect(analyzer.isVolumeKeyTriggerEnabled()).toBe(false);
      expect(analyzer.isShortcutTriggerEnabled()).toBe(false);
    });
  });

  describe('错误处理和重试机制', () => {
    it('应该在可重试错误时进行重试', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);

      // First call fails, second succeeds
      mockModelRunner.runImageClassification
        .mockRejectedValueOnce(new Error('Temporary model failure'))
        .mockResolvedValueOnce([
          { label: 'office', score: 0.85, index: 0 },
        ]);

      // Execute
      const result = await analyzer.analyze({ maxRetries: 1 });

      // Verify retry occurred and succeeded
      expect(mockModelRunner.runImageClassification).toHaveBeenCalledTimes(2);
      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].label).toBe('image:office');
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      // Setup
      mockSceneBridge.hasCameraPermission.mockResolvedValue(true);
      mockSceneBridge.hasMicrophonePermission.mockResolvedValue(false);
      mockSceneBridge.requestMicrophonePermission.mockResolvedValue(false);

      const mockImageData: ImageData = {
        base64: 'test-image',
        width: 224,
        height: 224,
        format: 'JPEG',
        timestamp: Date.now(),
      };

      mockSceneBridge.captureImage.mockResolvedValue(mockImageData);
      mockModelRunner.runImageClassification.mockRejectedValue(new Error('Persistent model failure'));

      // Execute and expect error after retries
      await expect(analyzer.analyze({ maxRetries: 2 })).rejects.toThrow('模型推理未产生任何预测结果');

      // Verify retries occurred
      expect(mockModelRunner.runImageClassification).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});