/**
 * SceneBridge Camera Functionality Tests
 */

import { sceneBridge } from '../SceneBridge';

describe('SceneBridge Camera Functionality', () => {
  describe('Camera Permissions', () => {
    it('should check camera permission', async () => {
      const hasPermission = await sceneBridge.hasCameraPermission();
      expect(typeof hasPermission).toBe('boolean');
    });

    it('should request camera permission', async () => {
      const result = await sceneBridge.requestCameraPermission();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Image Capture', () => {
    it('should capture image and return ImageData', async () => {
      // Mock the camera permission to be granted
      jest.spyOn(sceneBridge, 'hasCameraPermission').mockResolvedValue(true);
      
      const imageData = await sceneBridge.captureImage();
      
      expect(imageData).toBeDefined();
      expect(imageData.base64).toBeDefined();
      expect(typeof imageData.base64).toBe('string');
      expect(imageData.width).toBe(224);
      expect(imageData.height).toBe(224);
      expect(imageData.format).toBe('JPEG');
      expect(typeof imageData.timestamp).toBe('number');
    });

    it('should reject when camera permission is not granted', async () => {
      // Mock the camera permission to be denied
      jest.spyOn(sceneBridge, 'hasCameraPermission').mockResolvedValue(false);
      
      await expect(sceneBridge.captureImage()).rejects.toThrow('Camera permission not granted');
    });
  });

  describe('ImageData Structure', () => {
    it('should return ImageData with correct structure', async () => {
      jest.spyOn(sceneBridge, 'hasCameraPermission').mockResolvedValue(true);
      
      const imageData = await sceneBridge.captureImage();
      
      // Check all required properties exist
      expect(imageData).toHaveProperty('base64');
      expect(imageData).toHaveProperty('width');
      expect(imageData).toHaveProperty('height');
      expect(imageData).toHaveProperty('format');
      expect(imageData).toHaveProperty('timestamp');
      
      // Check property types
      expect(typeof imageData.base64).toBe('string');
      expect(typeof imageData.width).toBe('number');
      expect(typeof imageData.height).toBe('number');
      expect(typeof imageData.format).toBe('string');
      expect(typeof imageData.timestamp).toBe('number');
      
      // Check reasonable values
      expect(imageData.width).toBeGreaterThan(0);
      expect(imageData.height).toBeGreaterThan(0);
      expect(imageData.timestamp).toBeGreaterThan(0);
    });
  });
});