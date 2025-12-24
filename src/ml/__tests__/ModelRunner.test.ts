/**
 * Tests for ModelRunner class
 */
import { ModelRunner, ImageData, AudioData } from '../ModelRunner';

describe('ModelRunner', () => {
  let modelRunner: ModelRunner;

  beforeEach(() => {
    modelRunner = new ModelRunner();
  });

  afterEach(() => {
    modelRunner.unloadModels();
  });

  describe('Image Classification', () => {
    it('should load image model successfully', async () => {
      await modelRunner.loadImageModel();
      expect(modelRunner.isImageModelLoaded()).toBe(true);
    });

    it('should run image classification and return predictions', async () => {
      const mockImageData: ImageData = {
        uri: 'file://test-image.jpg',
        width: 640,
        height: 480
      };

      const predictions = await modelRunner.runImageClassification(mockImageData);

      expect(predictions).toBeDefined();
      expect(Array.isArray(predictions)).toBe(true);
      expect(predictions.length).toBeGreaterThan(0);
      
      // Check prediction structure
      const firstPrediction = predictions[0];
      expect(firstPrediction).toHaveProperty('label');
      expect(firstPrediction).toHaveProperty('score');
      expect(firstPrediction).toHaveProperty('index');
      expect(typeof firstPrediction.label).toBe('string');
      expect(typeof firstPrediction.score).toBe('number');
      expect(firstPrediction.score).toBeGreaterThanOrEqual(0);
      expect(firstPrediction.score).toBeLessThanOrEqual(1);
    });

    it('should return predictions sorted by score', async () => {
      const mockImageData: ImageData = {
        uri: 'file://test-image.jpg',
        width: 640,
        height: 480
      };

      const predictions = await modelRunner.runImageClassification(mockImageData);

      // Verify predictions are sorted by score (descending)
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].score).toBeLessThanOrEqual(predictions[i - 1].score);
      }
    });
  });

  describe('Audio Classification', () => {
    it('should load audio model successfully', async () => {
      await modelRunner.loadAudioModel();
      expect(modelRunner.isAudioModelLoaded()).toBe(true);
    });

    it('should run audio classification and return predictions', async () => {
      const mockAudioData: AudioData = {
        samples: new Float32Array(16000), // 1 second at 16kHz
        sampleRate: 16000,
        duration: 1.0
      };

      const predictions = await modelRunner.runAudioClassification(mockAudioData);

      expect(predictions).toBeDefined();
      expect(Array.isArray(predictions)).toBe(true);
      expect(predictions.length).toBeGreaterThan(0);
      
      // Check prediction structure
      const firstPrediction = predictions[0];
      expect(firstPrediction).toHaveProperty('label');
      expect(firstPrediction).toHaveProperty('score');
      expect(firstPrediction).toHaveProperty('index');
      expect(typeof firstPrediction.label).toBe('string');
      expect(typeof firstPrediction.score).toBe('number');
      expect(firstPrediction.score).toBeGreaterThanOrEqual(0);
      expect(firstPrediction.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Utility Methods', () => {
    it('should get top N predictions', async () => {
      const mockImageData: ImageData = {
        uri: 'file://test-image.jpg',
        width: 640,
        height: 480
      };

      const allPredictions = await modelRunner.runImageClassification(mockImageData);
      const topPredictions = modelRunner.getTopPredictions(allPredictions, 3);

      expect(topPredictions.length).toBeLessThanOrEqual(3);
      expect(topPredictions.length).toBeLessThanOrEqual(allPredictions.length);
      
      // Verify these are indeed the top predictions
      for (let i = 0; i < topPredictions.length; i++) {
        expect(topPredictions[i]).toBe(allPredictions[i]);
      }
    });

    it('should unload models', async () => {
      await modelRunner.loadImageModel();
      await modelRunner.loadAudioModel();
      
      expect(modelRunner.isImageModelLoaded()).toBe(true);
      expect(modelRunner.isAudioModelLoaded()).toBe(true);
      
      modelRunner.unloadModels();
      
      expect(modelRunner.isImageModelLoaded()).toBe(false);
      expect(modelRunner.isAudioModelLoaded()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle image classification errors gracefully', async () => {
      // Test with invalid image data
      const invalidImageData: ImageData = {
        uri: '',
        width: 0,
        height: 0
      };

      // Should not throw, but handle gracefully
      await expect(modelRunner.runImageClassification(invalidImageData)).resolves.toBeDefined();
    });

    it('should handle audio classification errors gracefully', async () => {
      // Test with invalid audio data
      const invalidAudioData: AudioData = {
        samples: new Float32Array(0),
        sampleRate: 0,
        duration: 0
      };

      // Should not throw, but handle gracefully
      await expect(modelRunner.runAudioClassification(invalidAudioData)).resolves.toBeDefined();
    });
  });
});