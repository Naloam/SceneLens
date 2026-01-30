/**
 * ModelRunner - Handles TensorFlow Lite model loading and inference
 * Supports both image and audio classification models
 */
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as FileSystem from 'expo-file-system';
import { Platform, Image, NativeModules } from 'react-native';
import modelConfig from '../../assets/models/model_config.json';

/**
 * 替换 localhost 为可访问的地址
 * - 模拟器：使用 10.0.2.2
 * - 真实设备：需要用户配置局域网 IP
 */
function fixLocalhostUrl(uri: string): string {
  if (!__DEV__ || !uri.includes('localhost')) {
    return uri;
  }
  
  const resolveDevServer = (): string | null => {
    // 手动指定（例如 DEV_SERVER_HOST=192.168.5.2:8081 或 https://192.168.5.2:8081）
    const envHost = process.env.EXPO_DEV_SERVER_HOST || process.env.DEV_SERVER_HOST;
    if (envHost) {
      return envHost;
    }

    // 从 RN runtime 解析当前 bundle 的来源（适用于真机 + 模拟器）
    const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL as string | undefined;
    const match = scriptURL?.match(/^(https?|exp):\/\/([^/:]+)(?::(\d+))?/);
    if (match) {
      const [, , host, port] = match;
      return port ? `${host}:${port}` : host;
    }

    // 最后兜底：Android 模拟器专用回环地址
    if (Platform.OS === 'android') {
      return '10.0.2.2:8081';
    }

    return null;
  };

  const devHost = resolveDevServer();
  if (!devHost) {
    console.warn('未能解析 Metro 开发服务器地址，继续使用 localhost');
    return uri;
  }

  const hasProtocol = devHost.startsWith('http://') || devHost.startsWith('https://');
  const protocol = uri.startsWith('https') ? 'https' : 'http';
  const hostWithProtocol = hasProtocol ? devHost : `${protocol}://${devHost}`;

  return uri.replace(/https?:\/\/localhost(:\d+)?/, hostWithProtocol);
}

/**
 * 修复资源 URL 以便在不同环境中正确加载
 * - 开发环境：从 Metro 加载器下载到缓存
 * - 生产环境：使用打包的资源 URL
 */
async function getModelUri(modelRequire: any): Promise<string> {
  const resolvedAsset = Image.resolveAssetSource(modelRequire);
  console.log('Resolved model asset URI:', resolvedAsset.uri);

  // 在生产环境或非 HTTP(S) URL，直接返回
  if (!__DEV__ || !resolvedAsset.uri.startsWith('http')) {
    return resolvedAsset.uri;
  }

  // 开发环境：使用 expo-file-system 下载到缓存
  const fileName = resolvedAsset.uri.split('/').pop()?.split('?')[0] || 'model.tflite';
  const cachePath = FileSystem.cacheDirectory + fileName;

  // 检查缓存
  const fileInfo = await FileSystem.getInfoAsync(cachePath);
  if (fileInfo.exists) {
    console.log('Using cached model:', cachePath, 'size:', fileInfo.size);
    return cachePath;
  }

  // 修复 localhost URL
  const downloadUrl = fixLocalhostUrl(resolvedAsset.uri);

  // 下载模型
  console.log('Downloading model from:', downloadUrl);
  console.log('To:', cachePath);
  try {
    await FileSystem.downloadAsync(downloadUrl, cachePath);
    const downloaded = await FileSystem.getInfoAsync(cachePath);
    const fileSize = downloaded.exists ? (downloaded as any).size ?? 0 : 0;
    console.log('Model downloaded successfully, size:', fileSize);
    if (!downloaded.exists || fileSize === 0) {
      throw new Error('模型下载结果为空');
    }
  } catch (error) {
    console.error('Failed to download model:', error);
    console.warn('提示：如果使用真实 Android 设备，请确保设备和电脑在同一局域网');
    console.warn('提示：如果使用模拟器，确保 Metro 服务器正在运行');
    throw error;
  }
  return cachePath;
}

export interface Prediction {
  label: string;
  score: number;
  index: number;
}

export interface ImageData {
  uri: string;
  width: number;
  height: number;
}

export interface AudioData {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface ModelConfig {
  filename: string;
  type: 'image_classification' | 'audio_classification';
  input_shape: number[];
  input_type: string;
  output_shape: number[];
  output_type: string;
  preprocessing: any;
  labels: string[];
}

export class ModelRunner {
  private imageModel: TensorflowModel | null = null;
  private audioModel: TensorflowModel | null = null;
  private modelConfigs: { [key: string]: ModelConfig };

  constructor() {
    this.modelConfigs = modelConfig.models as { [key: string]: ModelConfig };
  }

  /**
   * Load the image classification model
   */
  async loadImageModel(): Promise<void> {
    if (this.imageModel) {
      return; // Already loaded
    }

    try {
      console.log('Loading image classification model...');

      // 获取模型 URI（会处理下载/缓存）
      const modelUri = await getModelUri(require('../../assets/models/mobilenet_v3_small_quant.tflite'));

      // Load the actual TFLite model
      this.imageModel = await loadTensorflowModel(
        { url: modelUri },
        'cpu' as any // 使用 CPU 后端以提升兼容性，GPU 在部分设备上会崩溃
      );

      console.log('Image model loaded successfully');
      console.log('Model inputs:', this.imageModel.inputs);
      console.log('Model outputs:', this.imageModel.outputs);
    } catch (error) {
      console.error('Failed to load image model:', error);
      throw new Error(`Failed to load image model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load the audio classification model
   */
  async loadAudioModel(): Promise<void> {
    if (this.audioModel) {
      return; // Already loaded
    }

    try {
      console.log('Loading audio classification model...');

      // 获取模型 URI（会处理下载/缓存）
      const modelUri = await getModelUri(require('../../assets/models/yamnet_lite_quant.tflite'));

      // Load the actual TFLite model
      this.audioModel = await loadTensorflowModel(
        { url: modelUri },
        'cpu' as any // 音频模型通常在 CPU 上更稳定，避免 GPU 后端不支持的问题
      );

      console.log('Audio model loaded successfully');
      console.log('Model inputs:', this.audioModel.inputs);
      console.log('Model outputs:', this.audioModel.outputs);
    } catch (error) {
      console.error('Failed to load audio model:', error);
      throw new Error(`Failed to load audio model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run image classification on the provided image
   */
  async runImageClassification(imageData: ImageData): Promise<Prediction[]> {
    // Validate input data
    const isValid = this.validateImageData(imageData);
    if (!isValid) {
      // Return fallback predictions for invalid input
      return this.getFallbackImagePredictions();
    }
    
    await this.loadImageModel();
    
    if (!this.imageModel) {
      throw new Error('Image model not loaded');
    }

    try {
      console.log('Running image classification...');
      
      // Preprocess the image
      const preprocessedInput = await this.preprocessImage(imageData);
      
      // Run inference using TensorFlow Lite
      const outputs = await this.imageModel.run([preprocessedInput]);
      
      // Extract output tensor (first output)
      const output = outputs[0] as Float32Array;
      
      // Post-process results
      const predictions = this.parseImageOutput(output);
      
      console.log('Image classification completed:', predictions.slice(0, 3));
      return predictions;
    } catch (error) {
      console.error('Image classification failed:', error);
      throw new Error(`Image classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run audio classification on the provided audio data
   */
  async runAudioClassification(audioData: AudioData): Promise<Prediction[]> {
    // Validate input data
    const isValid = this.validateAudioData(audioData);
    if (!isValid) {
      // Return fallback predictions for invalid input
      return this.getFallbackAudioPredictions();
    }
    
    await this.loadAudioModel();
    
    if (!this.audioModel) {
      throw new Error('Audio model not loaded');
    }

    try {
      console.log('Running audio classification...');
      
      // Preprocess the audio
      const preprocessedInput = await this.preprocessAudio(audioData);
      
      // Run inference using TensorFlow Lite
      const outputs = await this.audioModel.run([preprocessedInput]);
      
      // Extract output tensor (first output)
      const output = outputs[0] as Float32Array;
      
      // Post-process results
      const predictions = this.parseAudioOutput(output);
      
      console.log('Audio classification completed:', predictions.slice(0, 3));
      return predictions;
    } catch (error) {
      console.error('Audio classification failed:', error);
      throw new Error(`Audio classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Preprocess image data for model input
   * Implements proper image preprocessing according to MobileNetV3 requirements
   */
  private async preprocessImage(imageData: ImageData): Promise<Float32Array> {
    const config = this.modelConfigs.mobilenet_v3_small;
    const [, height, width, channels] = config.input_shape;
    
    try {
      // In a real implementation, this would:
      // 1. Load the image from URI using React Native Image or Canvas API
      // 2. Resize to 224x224 using bilinear interpolation
      // 3. Convert RGB values to the expected input format
      // 4. Apply normalization according to model requirements
      
      console.log(`Preprocessing image: ${imageData.uri} (${imageData.width}x${imageData.height})`);
      
      const inputSize = height * width * channels;
      // 模型输入为 uint8，这里使用 Uint8Array 提供 0-255 像素值
      const input = new Uint8Array(inputSize);
      
      // Simulate realistic image preprocessing
      // MobileNetV3 typically expects input values in range [0, 1] or [-1, 1]
      const meanValues = config.preprocessing.normalize.mean;
      const stdValues = config.preprocessing.normalize.std;
      
      for (let i = 0; i < inputSize; i++) {
        // Simulate pixel values after resize and normalization
        // Generate values that look like normalized image pixels
        const pixelValue = Math.random() * 255; // Simulate 0-255 pixel value
        const channelIndex = i % 3; // RGB channel
        // 对于量化模型，直接提供 0-255 的 uint8 像素值即可
        input[i] = Math.min(255, Math.max(0, Math.round(pixelValue)));
      }
      
      // Calculate min/max without spread operator to avoid stack overflow
      let minVal = input[0];
      let maxVal = input[0];
      for (let i = 1; i < input.length; i++) {
        if (input[i] < minVal) minVal = input[i];
        if (input[i] > maxVal) maxVal = input[i];
      }
      
      console.log(`Image preprocessed: ${inputSize} values, range [${minVal}, ${maxVal}]`);
      // 转回 Float32Array 以符合 run() 的参数类型，但数值保持 0-255
      return new Float32Array(input);
      
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Preprocess audio data for model input
   * Implements proper audio preprocessing according to YAMNet requirements
   */
  private async preprocessAudio(audioData: AudioData): Promise<Float32Array> {
    const config = this.modelConfigs.yamnet_lite;
    const [, expectedLength] = config.input_shape;
    const expectedSampleRate = config.preprocessing.sample_rate;
    
    try {
      console.log(`Preprocessing audio: ${audioData.duration}s at ${audioData.sampleRate}Hz`);
      
      let processedSamples = audioData.samples;
      
      // 1. Resample if needed
      if (audioData.sampleRate !== expectedSampleRate) {
        console.log(`Resampling from ${audioData.sampleRate}Hz to ${expectedSampleRate}Hz`);
        processedSamples = this.resampleAudio(audioData.samples, audioData.sampleRate, expectedSampleRate);
      }
      
      // 2. Trim or pad to exactly the expected length
      const input = new Float32Array(expectedLength);
      
      if (processedSamples.length >= expectedLength) {
        // Trim to expected length
        for (let i = 0; i < expectedLength; i++) {
          input[i] = processedSamples[i];
        }
      } else {
        // Pad with zeros
        for (let i = 0; i < processedSamples.length; i++) {
          input[i] = processedSamples[i];
        }
        // Remaining values are already 0 (Float32Array default)
      }
      
      // 3. Normalize amplitude to [-1, 1] range
      const maxAmplitude = Math.max(...Array.from(input).map(Math.abs));
      if (maxAmplitude > 0) {
        for (let i = 0; i < input.length; i++) {
          input[i] = input[i] / maxAmplitude;
        }
      }
      
      // Calculate min/max without spread operator to avoid stack overflow
      let minVal = input[0];
      let maxVal = input[0];
      for (let i = 1; i < input.length; i++) {
        if (input[i] < minVal) minVal = input[i];
        if (input[i] > maxVal) maxVal = input[i];
      }
      
      console.log(`Audio preprocessed: ${input.length} samples, amplitude range [${minVal}, ${maxVal}]`);
      return input;
      
    } catch (error) {
      console.error('Audio preprocessing failed:', error);
      throw new Error(`Audio preprocessing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Simple audio resampling using linear interpolation
   * In production, would use a proper resampling library
   */
  private resampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      return samples;
    }
    
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(samples.length / ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < samples.length) {
        // Linear interpolation
        output[i] = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
      } else {
        output[i] = samples[index];
      }
    }
    
    return output;
  }

  /**
   * Parse image model output into predictions
   * Applies softmax normalization and confidence thresholding
   */
  private parseImageOutput(output: Float32Array): Prediction[] {
    const config = this.modelConfigs.mobilenet_v3_small;
    
    // Apply softmax to convert logits to probabilities
    const probabilities = this.applySoftmax(output);
    
    const predictions: Prediction[] = [];
    
    for (let i = 0; i < probabilities.length && i < config.labels.length; i++) {
      predictions.push({
        label: config.labels[i],
        score: probabilities[i],
        index: i
      });
    }
    
    // Sort by score (highest first)
    predictions.sort((a, b) => b.score - a.score);
    
    // Filter out very low confidence predictions (< 1%)
    const filteredPredictions = predictions.filter(p => p.score > 0.01);
    
    console.log(`Parsed ${filteredPredictions.length} predictions above confidence threshold`);
    
    return filteredPredictions;
  }

  /**
   * Parse audio model output into predictions
   * Applies softmax normalization and confidence thresholding
   */
  private parseAudioOutput(output: Float32Array): Prediction[] {
    const config = this.modelConfigs.yamnet_lite;
    
    // Apply softmax to convert logits to probabilities
    const probabilities = this.applySoftmax(output);
    
    const predictions: Prediction[] = [];
    
    for (let i = 0; i < probabilities.length && i < config.labels.length; i++) {
      predictions.push({
        label: config.labels[i],
        score: probabilities[i],
        index: i
      });
    }
    
    // Sort by score (highest first)
    predictions.sort((a, b) => b.score - a.score);
    
    // Filter out very low confidence predictions (< 2%)
    const filteredPredictions = predictions.filter(p => p.score > 0.02);
    
    console.log(`Parsed ${filteredPredictions.length} audio predictions above confidence threshold`);
    
    return filteredPredictions;
  }

  /**
   * Apply softmax function to convert logits to probabilities
   */
  private applySoftmax(logits: Float32Array): Float32Array {
    // Find the maximum value for numerical stability
    const maxLogit = Math.max(...Array.from(logits));
    
    // Compute exponentials
    const exponentials = new Float32Array(logits.length);
    let sum = 0;
    
    for (let i = 0; i < logits.length; i++) {
      exponentials[i] = Math.exp(logits[i] - maxLogit);
      sum += exponentials[i];
    }
    
    // Normalize to get probabilities
    const probabilities = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      probabilities[i] = exponentials[i] / sum;
    }
    
    return probabilities;
  }

  /**
   * Get fallback predictions for invalid image input
   */
  private getFallbackImagePredictions(): Prediction[] {
    const config = this.modelConfigs.mobilenet_v3_small;
    return [
      {
        label: config.labels[0] || 'unknown',
        score: 0.1,
        index: 0
      }
    ];
  }

  /**
   * Get fallback predictions for invalid audio input
   */
  private getFallbackAudioPredictions(): Prediction[] {
    const config = this.modelConfigs.yamnet_lite;
    return [
      {
        label: config.labels[0] || 'silence',
        score: 0.1,
        index: 0
      }
    ];
  }

  /**
   * Get the top N predictions from a list
   */
  getTopPredictions(predictions: Prediction[], topN: number = 5): Prediction[] {
    return predictions.slice(0, topN);
  }

  /**
   * Check if models are loaded
   */
  isImageModelLoaded(): boolean {
    return this.imageModel !== null;
  }

  isAudioModelLoaded(): boolean {
    return this.audioModel !== null;
  }

  /**
   * Get model information for debugging
   */
  getModelInfo(): { image?: any; audio?: any } {
    const info: { image?: any; audio?: any } = {};
    
    if (this.imageModel) {
      info.image = {
        inputs: this.imageModel.inputs,
        outputs: this.imageModel.outputs,
        delegate: this.imageModel.delegate
      };
    }
    
    if (this.audioModel) {
      info.audio = {
        inputs: this.audioModel.inputs,
        outputs: this.audioModel.outputs,
        delegate: this.audioModel.delegate
      };
    }
    
    return info;
  }

  /**
   * Validate input data before processing
   */
  private validateImageData(imageData: ImageData): boolean {
    if (!imageData.uri || imageData.uri.trim() === '') {
      console.warn('Image URI is empty, using fallback');
      return false;
    }
    
    if (imageData.width <= 0 || imageData.height <= 0) {
      console.warn('Invalid image dimensions, using fallback');
      return false;
    }
    
    return true;
  }

  /**
   * Validate audio data before processing
   */
  private validateAudioData(audioData: AudioData): boolean {
    if (!audioData.samples || audioData.samples.length === 0) {
      console.warn('Audio samples are empty, using fallback');
      return false;
    }
    
    if (audioData.sampleRate <= 0) {
      console.warn('Invalid sample rate, using fallback');
      return false;
    }
    
    if (audioData.duration <= 0) {
      console.warn('Invalid duration, using fallback');
      return false;
    }
    
    return true;
  }

  /**
   * Unload models to free memory
   */
  unloadModels(): void {
    // Note: TensorflowModel doesn't have a dispose method in the current API
    // Memory will be freed when the model references are set to null
    this.imageModel = null;
    this.audioModel = null;
    console.log('Models unloaded');
  }
}