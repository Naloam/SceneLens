/**
 * Mock for react-native-fast-tflite
 * Used in Jest tests since the actual library requires React Native runtime
 */

export interface TensorflowModel {
  delegate: 'default' | 'metal' | 'core-ml' | 'nnapi' | 'android-gpu';
  run(input: Float32Array[]): Promise<Float32Array[]>;
  runSync(input: Float32Array[]): Float32Array[];
  inputs: Array<{
    name: string;
    dataType: string;
    shape: number[];
  }>;
  outputs: Array<{
    name: string;
    dataType: string;
    shape: number[];
  }>;
}

export const loadTensorflowModel = jest.fn().mockImplementation(
  async (source: any, delegate: string = 'default'): Promise<TensorflowModel> => {
    // Mock model with realistic structure
    const mockModel: TensorflowModel = {
      delegate: delegate as any,
      inputs: [
        {
          name: 'input',
          dataType: 'float32',
          shape: [1, 224, 224, 3]
        }
      ],
      outputs: [
        {
          name: 'output',
          dataType: 'float32',
          shape: [1, 10]
        }
      ],
      run: jest.fn().mockImplementation(async (inputs: Float32Array[]) => {
        // Return mock output with realistic shape
        const outputSize = 10; // Based on our model config
        const output = new Float32Array(outputSize);
        
        // Generate normalized random probabilities
        let sum = 0;
        for (let i = 0; i < outputSize; i++) {
          output[i] = Math.random();
          sum += output[i];
        }
        
        // Normalize to sum to 1 (like softmax)
        for (let i = 0; i < outputSize; i++) {
          output[i] /= sum;
        }
        
        return [output];
      }),
      runSync: jest.fn().mockImplementation((inputs: Float32Array[]) => {
        // Same as run but synchronous
        const outputSize = 10;
        const output = new Float32Array(outputSize);
        
        let sum = 0;
        for (let i = 0; i < outputSize; i++) {
          output[i] = Math.random();
          sum += output[i];
        }
        
        for (let i = 0; i < outputSize; i++) {
          output[i] /= sum;
        }
        
        return [output];
      })
    };
    
    return mockModel;
  }
);

export const useTensorflowModel = jest.fn().mockReturnValue({
  model: null,
  state: 'loading'
});