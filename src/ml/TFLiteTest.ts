/**
 * Basic test for react-native-fast-tflite integration
 */
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

export class TFLiteTest {
  static async testBasicIntegration(): Promise<boolean> {
    try {
      // Test if TFLite module is available
      console.log('Testing TFLite integration...');
      
      // Check if loadTensorflowModel function is available
      if (typeof loadTensorflowModel !== 'function') {
        console.error('loadTensorflowModel function not available');
        return false;
      }
      
      console.log('TFLite module loaded successfully');
      return true;
    } catch (error) {
      console.error('TFLite integration test failed:', error);
      return false;
    }
  }

  static async testModelLoading(): Promise<boolean> {
    try {
      console.log('Testing model loading...');
      
      // Try to load the MobileNet model
      const model = await loadTensorflowModel(
        require('../../assets/models/mobilenet_v3_small_quant.tflite'),
        'default' // Use default delegate for basic test
      );
      
      console.log('Model loaded successfully');
      console.log('Model delegate:', model.delegate);
      console.log('Model inputs:', model.inputs);
      console.log('Model outputs:', model.outputs);
      
      // Test basic inference with dummy data
      const inputSize = 224 * 224 * 3; // MobileNet input size
      const dummyInput = new Float32Array(inputSize);
      
      // Fill with normalized random values
      for (let i = 0; i < inputSize; i++) {
        dummyInput[i] = Math.random();
      }
      
      const outputs = await model.run([dummyInput]);
      
      console.log('Model inference completed successfully');
      console.log('Number of outputs:', outputs.length);
      console.log('Output 0 length:', outputs[0].length);
      
      return true;
    } catch (error) {
      console.error('Model loading test failed:', error);
      return false;
    }
  }

  static async runAllTests(): Promise<{ basic: boolean; modelLoading: boolean }> {
    const basic = await this.testBasicIntegration();
    const modelLoading = await this.testModelLoading();
    
    return { basic, modelLoading };
  }
}