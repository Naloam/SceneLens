/**
 * Tests for TFLite integration
 */
import { TFLiteTest } from '../TFLiteTest';

describe('TFLiteTest', () => {
  describe('Basic Integration', () => {
    it('should pass basic integration test', async () => {
      const result = await TFLiteTest.testBasicIntegration();
      expect(result).toBe(true);
    });

    it('should pass model loading test', async () => {
      const result = await TFLiteTest.testModelLoading();
      expect(result).toBe(true);
    });

    it('should pass all tests', async () => {
      const results = await TFLiteTest.runAllTests();
      expect(results.basic).toBe(true);
      expect(results.modelLoading).toBe(true);
    });
  });
});