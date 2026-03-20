/**
 * UserTriggeredAnalyzer - 用户触发的精确场景识别
 * 
 * 当用户主动触发时（双击音量键或桌面快捷方式），
 * 使用相机和麦克风进行精确场景识别
 */

import { DeviceEventEmitter } from 'react-native';
import { sceneBridge } from './SceneBridge';
import { ModelRunner } from '../ml/ModelRunner';
import type { ModelRunResult } from '../ml/ModelRunner';
import { VolumeKeyListener, VolumeKeyEvent } from './VolumeKeyListener';
import { ShortcutManager, ShortcutEvent } from './ShortcutManager';
import type {
  TriggeredContext,
  TriggeredDegradation,
  Prediction,
  ImageData,
  AudioData,
  SceneLensError,
} from '../types';
import { ErrorCode } from '../types';

export interface UserTriggeredOptions {
  /**
   * 音频录制时长（毫秒）
   * 默认 1000ms (1秒)
   */
  audioDurationMs?: number;
  
  /**
   * 是否在分析后自动清理敏感数据
   * 默认 true
   */
  autoCleanup?: boolean;
  
  /**
   * 最大重试次数
   * 默认 2
   */
  maxRetries?: number;
}

interface InferenceAggregationResult {
  predictions: Prediction[];
  degradedSources: TriggeredDegradation[];
}

export class UserTriggeredAnalyzer {
  private modelRunner: ModelRunner;
  private volumeKeyListener: VolumeKeyListener;
  private shortcutManager: ShortcutManager;
  private _isAnalyzing: boolean = false;
  private _isVolumeKeyEnabled: boolean = false;
  private _isShortcutEnabled: boolean = false;

  constructor() {
    this.modelRunner = new ModelRunner();
    this.volumeKeyListener = new VolumeKeyListener();
    this.shortcutManager = new ShortcutManager();
  }

  /**
   * 发送分析结果事件，供前端页面订阅（用于音量键/快捷方式背景触发时展示 UI）
   */
  private emitAnalysisResult(result: TriggeredContext) {
    DeviceEventEmitter.emit('UserTriggeredAnalysisResult', { ok: true, result });
  }

  private emitAnalysisError(error: Error) {
    DeviceEventEmitter.emit('UserTriggeredAnalysisResult', { ok: false, error: error.message });
  }

  /**
   * 执行用户触发的场景分析
   * 
   * @param options 分析选项
   * @returns 触发上下文结果
   */
  async analyze(options: UserTriggeredOptions = {}): Promise<TriggeredContext> {
    const {
      audioDurationMs = 1000,
      autoCleanup = true,
      maxRetries = 2,
    } = options;

    if (this._isAnalyzing) {
      throw new Error('分析正在进行中，请稍后再试');
    }

    this._isAnalyzing = true;

    try {
      console.log('开始用户触发的场景分析...');
      
      // 1. 请求权限
      const permissions = await this.requestPermissions();
      
      if (!permissions.hasCamera && !permissions.hasMicrophone) {
        throw this.createError(
          ErrorCode.PERMISSION_DENIED,
          '需要相机或麦克风权限才能进行场景识别'
        );
      }

      // 2. 快速采样
      const [imageData, audioData] = await this.performSampling(
        permissions,
        audioDurationMs
      );

      // 3. 模型推理
      const inference = await this.runModelInference(imageData, audioData);

      // 4. 清理敏感数据
      if (autoCleanup) {
        this.clearSensitiveData(imageData, audioData);
      }

      const result: TriggeredContext = {
        timestamp: Date.now(),
        predictions: inference.predictions,
        confidence: inference.predictions.length > 0 ? inference.predictions[0].score : 0,
        degradedSources: inference.degradedSources.length > 0 ? inference.degradedSources : undefined,
      };

      console.log('用户触发分析完成:', {
        predictionsCount: inference.predictions.length,
        confidence: result.confidence,
        topPrediction: inference.predictions[0]?.label,
        degradedSources: inference.degradedSources.length,
      });

      // 通知前端订阅者（例如 HomeScreen）
      this.emitAnalysisResult(result);

      return result;

    } catch (error) {
      console.error('用户触发分析失败:', error);
      
      // 重试逻辑
      if (maxRetries > 0 && this.shouldRetry(error)) {
        console.log(`分析失败，正在重试... (剩余 ${maxRetries} 次)`);
        // 允许下一次 analyze 正常开始
        this._isAnalyzing = false;
        return this.analyze({
          ...options,
          maxRetries: maxRetries - 1,
        });
      }
      
      this.emitAnalysisError(error as Error);
      throw error;
    } finally {
      this._isAnalyzing = false;
    }
  }

  /**
   * 请求必要的权限
   */
  private async requestPermissions(): Promise<{
    hasCamera: boolean;
    hasMicrophone: boolean;
  }> {
    console.log('检查和请求权限...');

    try {
      // 检查现有权限
      const [hasCameraPermission, hasMicPermission] = await Promise.all([
        sceneBridge.hasCameraPermission(),
        sceneBridge.hasMicrophonePermission(),
      ]);

      let hasCamera = hasCameraPermission;
      let hasMicrophone = hasMicPermission;

      // 请求缺失的权限
      if (!hasCamera) {
        console.log('请求相机权限...');
        hasCamera = await sceneBridge.requestCameraPermission();
      }

      if (!hasMicrophone) {
        console.log('请求麦克风权限...');
        hasMicrophone = await sceneBridge.requestMicrophonePermission();
      }

      console.log('权限状态:', { hasCamera, hasMicrophone });

      return { hasCamera, hasMicrophone };
    } catch (error) {
      console.error('权限请求失败:', error);
      throw this.createError(
        ErrorCode.PERMISSION_DENIED,
        '无法获取必要权限'
      );
    }
  }

  /**
   * 执行快速采样
   */
  private async performSampling(
    permissions: { hasCamera: boolean; hasMicrophone: boolean },
    audioDurationMs: number
  ): Promise<[ImageData | null, AudioData | null]> {
    console.log('开始快速采样...');

    const samplingPromises: [
      Promise<ImageData | null>,
      Promise<AudioData | null>
    ] = [
      // 相机采样
      permissions.hasCamera 
        ? this.captureImage()
        : Promise.resolve(null),
      
      // 麦克风采样
      permissions.hasMicrophone 
        ? this.recordAudio(audioDurationMs)
        : Promise.resolve(null),
    ];

    try {
      const [imageData, audioData] = await Promise.all(samplingPromises);
      
      console.log('采样完成:', {
        hasImage: !!imageData,
        hasAudio: !!audioData,
        imageSize: imageData ? `${imageData.width}x${imageData.height}` : 'N/A',
        audioDuration: audioData ? `${audioData.duration}ms` : 'N/A',
      });

      return [imageData, audioData];
    } catch (error) {
      console.error('采样失败:', error);
      throw this.createError(
        ErrorCode.SYSTEM_API_FAILED,
        '数据采样失败'
      );
    }
  }

  /**
   * 捕获图像
   */
  private async captureImage(): Promise<ImageData | null> {
    try {
      console.log('正在捕获图像...');
      const imageData = await sceneBridge.captureImage();
      
      if (!imageData || !imageData.base64) {
        console.warn('图像捕获返回空数据');
        return null;
      }

      console.log('图像捕获成功:', {
        format: imageData.format,
        size: `${imageData.width}x${imageData.height}`,
        dataLength: imageData.base64.length,
      });

      return imageData;
    } catch (error) {
      console.error('图像捕获失败:', error);
      // 不抛出错误，返回 null 让音频继续
      return null;
    }
  }

  /**
   * 录制音频
   */
  private async recordAudio(durationMs: number): Promise<AudioData | null> {
    try {
      console.log(`正在录制音频 ${durationMs}ms...`);
      const audioData = await sceneBridge.recordAudio(durationMs);
      
      if (!audioData || !audioData.base64) {
        console.warn('音频录制返回空数据');
        return null;
      }

      console.log('音频录制成功:', {
        format: audioData.format,
        duration: `${audioData.duration}ms`,
        sampleRate: `${audioData.sampleRate}Hz`,
        dataLength: audioData.base64.length,
      });

      return audioData;
    } catch (error) {
      console.error('音频录制失败:', error);
      // 不抛出错误，返回 null 让图像继续
      return null;
    }
  }

  /**
   * 运行模型推理
   */
  private async runModelInference(
    imageData: ImageData | null,
    audioData: AudioData | null
  ): Promise<InferenceAggregationResult> {
    if (!imageData && !audioData) {
      throw this.createError(
        ErrorCode.MODEL_INFERENCE_FAILED,
        '没有可用的输入数据进行推理'
      );
    }

    console.log('开始模型推理...');
    const allPredictions: Prediction[] = [];
    const degradedSources: TriggeredDegradation[] = [];

    try {
      // 图像分类
      if (imageData) {
        console.log('运行图像分类...');
        try {
          // 转换为 ModelRunner 期望的格式
          const modelImageData = this.convertToModelImageData(imageData);
          const imageResult = await this.runDetailedImageClassification(modelImageData);
          this.collectDegradedSource(degradedSources, imageResult);
          const imagePredictions = imageResult.predictions;
          
          // 为图像预测添加标识
          const taggedImagePredictions = imagePredictions.map(pred => ({
            ...pred,
            label: `image:${pred.label}`,
          }));
          
          allPredictions.push(...taggedImagePredictions);
          console.log(`图像分类完成，获得 ${imagePredictions.length} 个预测`);
        } catch (error) {
          console.error('图像分类失败:', error);
          // 继续处理音频，不中断整个流程
        }
      }

      // 音频分类
      if (audioData) {
        console.log('运行音频分类...');
        try {
          // 转换为 ModelRunner 期望的格式
          const modelAudioData = this.convertToModelAudioData(audioData);
          const audioResult = await this.runDetailedAudioClassification(modelAudioData);
          this.collectDegradedSource(degradedSources, audioResult);
          const audioPredictions = audioResult.predictions;
          
          // 为音频预测添加标识
          const taggedAudioPredictions = audioPredictions.map(pred => ({
            ...pred,
            label: `audio:${pred.label}`,
          }));
          
          allPredictions.push(...taggedAudioPredictions);
          console.log(`音频分类完成，获得 ${audioPredictions.length} 个预测`);
        } catch (error) {
          console.error('音频分类失败:', error);
          // 继续处理，不中断整个流程
        }
      }

      if (allPredictions.length === 0) {
        throw this.createError(
          ErrorCode.MODEL_INFERENCE_FAILED,
          '模型推理未产生任何预测结果'
        );
      }

      // 按置信度排序
      const sortedPredictions = allPredictions.sort((a, b) => b.score - a.score);
      
      console.log('模型推理完成:', {
        totalPredictions: sortedPredictions.length,
        topPrediction: sortedPredictions[0],
        degradedSources: degradedSources.length,
      });

      return {
        predictions: sortedPredictions,
        degradedSources,
      };

    } catch (error) {
      console.error('模型推理失败:', error);
      throw this.createError(
        ErrorCode.MODEL_INFERENCE_FAILED,
        `模型推理失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 转换 ImageData 为 ModelRunner 期望的格式
   */
  private convertToModelImageData(imageData: ImageData): { uri: string; width: number; height: number; rgbBase64?: string } {
    // 创建 data URI
    const uri = `data:image/${imageData.format.toLowerCase()};base64,${imageData.base64}`;
    
    return {
      uri,
      width: imageData.width,
      height: imageData.height,
      rgbBase64: (imageData as any).rgbBase64,
    };
  }

  /**
   * 转换 AudioData 为 ModelRunner 期望的格式
   */
  private convertToModelAudioData(audioData: AudioData): {
    samples: Float32Array;
    sampleRate: number;
    duration: number;
  } {
    const bytes = this.decodeBase64ToBytes(audioData.base64);
    const decoded = this.decodeWavPcm16(bytes);

    if (!decoded || decoded.samples.length === 0) {
      console.warn('Failed to decode WAV audio, returning degraded audio input');
      return {
        samples: new Float32Array(0),
        sampleRate: audioData.sampleRate,
        duration: 0,
      };
    }

    const durationSec = decoded.samples.length / decoded.sampleRate;
    return {
      samples: decoded.samples,
      sampleRate: decoded.sampleRate,
      duration: durationSec,
    };
  }

  private async runDetailedImageClassification(imageData: {
    uri: string;
    width: number;
    height: number;
    rgbBase64?: string;
  }): Promise<ModelRunResult> {
    const detailedRunner = this.modelRunner as ModelRunner & {
      runImageClassificationDetailed?: (input: {
        uri: string;
        width: number;
        height: number;
        rgbBase64?: string;
      }) => Promise<ModelRunResult>;
    };

    if (typeof detailedRunner.runImageClassificationDetailed === 'function') {
      return detailedRunner.runImageClassificationDetailed(imageData);
    }

    const predictions = await this.modelRunner.runImageClassification(imageData);
    return {
      modality: 'image',
      status: predictions.length > 0 ? 'ok' : 'degraded_empty_output',
      predictions,
      reason: predictions.length > 0 ? undefined : 'Legacy image runner returned no predictions',
    };
  }

  private async runDetailedAudioClassification(audioData: {
    samples: Float32Array;
    sampleRate: number;
    duration: number;
  }): Promise<ModelRunResult> {
    const detailedRunner = this.modelRunner as ModelRunner & {
      runAudioClassificationDetailed?: (input: {
        samples: Float32Array;
        sampleRate: number;
        duration: number;
      }) => Promise<ModelRunResult>;
    };

    if (typeof detailedRunner.runAudioClassificationDetailed === 'function') {
      return detailedRunner.runAudioClassificationDetailed(audioData);
    }

    const predictions = await this.modelRunner.runAudioClassification(audioData);
    return {
      modality: 'audio',
      status: predictions.length > 0 ? 'ok' : 'degraded_empty_output',
      predictions,
      reason: predictions.length > 0 ? undefined : 'Legacy audio runner returned no predictions',
    };
  }

  private collectDegradedSource(
    degradedSources: TriggeredDegradation[],
    result: ModelRunResult
  ): void {
    if (result.status === 'ok') {
      return;
    }

    degradedSources.push({
      source: result.modality,
      reason: result.status,
      message: result.reason || `${result.modality} inference degraded`,
    });
  }

  private decodeBase64ToBytes(base64: string): Uint8Array {
    const clean = base64.replace(/[\r\n\s]/g, '');
    if (!clean) return new Uint8Array(0);

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Int16Array(256);
    lookup.fill(-1);
    for (let i = 0; i < alphabet.length; i++) {
      lookup[alphabet.charCodeAt(i)] = i;
    }

    let padding = 0;
    if (clean.endsWith('==')) padding = 2;
    else if (clean.endsWith('=')) padding = 1;

    const outputLength = Math.floor((clean.length * 3) / 4) - padding;
    const out = new Uint8Array(Math.max(0, outputLength));

    let outIndex = 0;
    for (let i = 0; i < clean.length; i += 4) {
      const c1 = lookup[clean.charCodeAt(i)] ?? -1;
      const c2 = lookup[clean.charCodeAt(i + 1)] ?? -1;
      const ch3 = clean.charCodeAt(i + 2);
      const ch4 = clean.charCodeAt(i + 3);
      const c3 = ch3 === 61 ? 0 : (lookup[ch3] ?? -1);
      const c4 = ch4 === 61 ? 0 : (lookup[ch4] ?? -1);

      if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
        continue;
      }

      const value = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
      if (outIndex < out.length) out[outIndex++] = (value >> 16) & 0xff;
      if (ch3 !== 61 && outIndex < out.length) out[outIndex++] = (value >> 8) & 0xff;
      if (ch4 !== 61 && outIndex < out.length) out[outIndex++] = value & 0xff;
    }

    return out;
  }

  private decodeWavPcm16(
    bytes: Uint8Array
  ): { samples: Float32Array; sampleRate: number } | null {
    if (bytes.length < 44) return null;
    if (!this.matchesAscii(bytes, 0, 'RIFF') || !this.matchesAscii(bytes, 8, 'WAVE')) {
      return null;
    }

    let offset = 12;
    let sampleRate = 16000;
    let channels = 1;
    let bitsPerSample = 16;
    let dataOffset = -1;
    let dataSize = 0;

    while (offset + 8 <= bytes.length) {
      const chunkId = this.readAscii(bytes, offset, 4);
      const chunkSize = this.readUint32LE(bytes, offset + 4);
      const chunkDataOffset = offset + 8;

      if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataOffset + 16 <= bytes.length) {
        const audioFormat = this.readUint16LE(bytes, chunkDataOffset);
        channels = this.readUint16LE(bytes, chunkDataOffset + 2);
        sampleRate = this.readUint32LE(bytes, chunkDataOffset + 4);
        bitsPerSample = this.readUint16LE(bytes, chunkDataOffset + 14);
        if (audioFormat !== 1) return null; // PCM only
      } else if (chunkId === 'data') {
        dataOffset = chunkDataOffset;
        dataSize = chunkSize;
        break;
      }

      offset = chunkDataOffset + chunkSize + (chunkSize % 2);
    }

    if (dataOffset < 0 || dataOffset + dataSize > bytes.length) return null;
    if (bitsPerSample !== 16 || channels < 1) return null;

    const frameCount = Math.floor(dataSize / (2 * channels));
    const samples = new Float32Array(frameCount);

    for (let frame = 0; frame < frameCount; frame++) {
      const frameStart = dataOffset + frame * channels * 2;
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        const sampleOffset = frameStart + ch * 2;
        const int16 = this.readInt16LE(bytes, sampleOffset);
        sum += int16 / 32768;
      }
      samples[frame] = sum / channels;
    }

    return { samples, sampleRate };
  }

  private readAscii(bytes: Uint8Array, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length && offset + i < bytes.length; i++) {
      result += String.fromCharCode(bytes[offset + i]);
    }
    return result;
  }

  private matchesAscii(bytes: Uint8Array, offset: number, expected: string): boolean {
    if (offset + expected.length > bytes.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (bytes[offset + i] !== expected.charCodeAt(i)) return false;
    }
    return true;
  }

  private readUint16LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  private readUint32LE(bytes: Uint8Array, offset: number): number {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  private readInt16LE(bytes: Uint8Array, offset: number): number {
    const value = this.readUint16LE(bytes, offset);
    return value > 0x7fff ? value - 0x10000 : value;
  }

  /**
   * 清理敏感数据
   */
  private clearSensitiveData(
    imageData: ImageData | null,
    audioData: AudioData | null
  ): void {
    console.log('清理敏感数据...');
    
    // 清理图像数据
    if (imageData) {
      // 在 JavaScript 中，我们无法真正"清零"字符串内存
      // 但可以移除引用，让垃圾回收器处理
      (imageData as any).base64 = '';
    }
    
    // 清理音频数据
    if (audioData) {
      (audioData as any).base64 = '';
    }
    
    console.log('敏感数据已清理');
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any): boolean {
    if (error instanceof Error && 'code' in error) {
      const errorCode = (error as any).code;
      
      // 这些错误类型可以重试
      const retryableErrors = [
        ErrorCode.SYSTEM_API_FAILED,
        ErrorCode.MODEL_INFERENCE_FAILED,
        ErrorCode.NETWORK_UNAVAILABLE,
      ];
      
      return retryableErrors.includes(errorCode);
    }
    
    return false;
  }

  /**
   * 创建标准化错误
   */
  private createError(code: ErrorCode, message: string): SceneLensError {
    const error = new Error(message) as SceneLensError;
    error.code = code;
    error.name = 'SceneLensError';
    error.recoverable = true;
    return error;
  }

  /**
   * 启用音量键双击触发
   * 
   * @param autoAnalyze 是否在双击时自动开始分析，默认 true
   */
  async enableVolumeKeyTrigger(autoAnalyze: boolean = true): Promise<boolean> {
    try {
      console.log('启用音量键双击触发...');
      
      const enabled = await this.volumeKeyListener.enable((event: VolumeKeyEvent) => {
        console.log('音量键双击触发场景识别:', event);
        
        if (autoAnalyze && !this._isAnalyzing) {
          // 自动开始分析
          this.analyze().catch(error => {
            console.error('音量键触发的分析失败:', error);
          });
        }
      });

      this._isVolumeKeyEnabled = enabled;
      
      if (enabled) {
        console.log('音量键双击触发已启用');
      } else {
        console.error('音量键双击触发启用失败');
      }

      return enabled;
    } catch (error) {
      console.error('启用音量键触发失败:', error);
      return false;
    }
  }

  /**
   * 禁用音量键双击触发
   */
  async disableVolumeKeyTrigger(): Promise<boolean> {
    try {
      console.log('禁用音量键双击触发...');
      
      const disabled = await this.volumeKeyListener.disable();
      this._isVolumeKeyEnabled = false;
      
      if (disabled) {
        console.log('音量键双击触发已禁用');
      } else {
        console.error('音量键双击触发禁用失败');
      }

      return disabled;
    } catch (error) {
      console.error('禁用音量键触发失败:', error);
      return false;
    }
  }

  /**
   * 启用桌面快捷方式触发
   * 
   * @param autoAnalyze 是否在快捷方式触发时自动开始分析，默认 true
   */
  async enableShortcutTrigger(autoAnalyze: boolean = true): Promise<boolean> {
    try {
      console.log('启用桌面快捷方式触发...');
      
      const enabled = this.shortcutManager.enableShortcutListener((event: ShortcutEvent) => {
        console.log('桌面快捷方式触发场景识别:', event);
        
        if (autoAnalyze && !this._isAnalyzing) {
          // 自动开始分析
          this.analyze().catch(error => {
            console.error('快捷方式触发的分析失败:', error);
          });
        }
      });

      this._isShortcutEnabled = enabled;
      
      if (enabled) {
        console.log('桌面快捷方式触发已启用');
      } else {
        console.error('桌面快捷方式触发启用失败');
      }

      return enabled;
    } catch (error) {
      console.error('启用桌面快捷方式触发失败:', error);
      return false;
    }
  }

  /**
   * 禁用桌面快捷方式触发
   */
  async disableShortcutTrigger(): Promise<boolean> {
    try {
      console.log('禁用桌面快捷方式触发...');
      
      const disabled = this.shortcutManager.disableShortcutListener();
      this._isShortcutEnabled = false;
      
      if (disabled) {
        console.log('桌面快捷方式触发已禁用');
      } else {
        console.error('桌面快捷方式触发禁用失败');
      }

      return disabled;
    } catch (error) {
      console.error('禁用桌面快捷方式触发失败:', error);
      return false;
    }
  }

  /**
   * 检查桌面快捷方式触发是否已启用
   */
  isShortcutTriggerEnabled(): boolean {
    return this._isShortcutEnabled;
  }

  /**
   * 检查音量键触发是否已启用
   */
  isVolumeKeyTriggerEnabled(): boolean {
    return this._isVolumeKeyEnabled;
  }

  /**
   * 创建桌面快捷方式
   */
  async createDesktopShortcut(): Promise<boolean> {
    try {
      return await this.shortcutManager.createSceneAnalysisShortcut();
    } catch (error) {
      console.error('创建桌面快捷方式失败:', error);
      return false;
    }
  }

  /**
   * 删除桌面快捷方式
   */
  async removeDesktopShortcut(): Promise<boolean> {
    try {
      return await this.shortcutManager.removeSceneAnalysisShortcut();
    } catch (error) {
      console.error('删除桌面快捷方式失败:', error);
      return false;
    }
  }

  /**
   * 检查是否支持桌面快捷方式
   */
  async isShortcutSupported(): Promise<boolean> {
    try {
      return await this.shortcutManager.isShortcutSupported();
    } catch (error) {
      console.error('检查快捷方式支持失败:', error);
      return false;
    }
  }

  /**
   * 测试音量键双击功能
   */
  async testVolumeKeyTrigger(): Promise<boolean> {
    try {
      return await this.volumeKeyListener.test();
    } catch (error) {
      console.error('测试音量键触发失败:', error);
      return false;
    }
  }

  /**
   * 检查是否正在分析
   */
  isAnalyzing(): boolean {
    return this._isAnalyzing;
  }

  /**
   * 获取模型信息（用于调试）
   */
  getModelInfo(): any {
    return this.modelRunner.getModelInfo();
  }

  /**
   * 预加载模型（可选的性能优化）
   */
  async preloadModels(): Promise<void> {
    console.log('预加载模型...');
    
    try {
      await Promise.all([
        this.modelRunner.loadImageModel(),
        this.modelRunner.loadAudioModel(),
      ]);
      
      console.log('模型预加载完成');
    } catch (error) {
      console.error('模型预加载失败:', error);
      // 不抛出错误，预加载失败不应该阻止后续使用
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    console.log('清理 UserTriggeredAnalyzer 资源...');
    this.modelRunner.unloadModels();
    this.volumeKeyListener.cleanup();
    this.shortcutManager.cleanup();
    this._isAnalyzing = false;
    this._isVolumeKeyEnabled = false;
    this._isShortcutEnabled = false;
  }
}

export default UserTriggeredAnalyzer;
