/**
 * Demo: Using ModelRunner for scene classification
 */
import { ModelRunner, ImageData, AudioData } from './ModelRunner';
import { TFLiteTest } from './TFLiteTest';

/**
 * Demo: Image classification
 */
export async function demoImageClassification() {
  console.log('=== Image Classification Demo ===');
  
  const modelRunner = new ModelRunner();
  
  // Mock image data (in real app, this would come from camera)
  const imageData: ImageData = {
    uri: 'file://camera-snapshot.jpg',
    width: 1920,
    height: 1080
  };
  
  try {
    // Run classification
    const predictions = await modelRunner.runImageClassification(imageData);
    
    // Get top 5 predictions
    const topPredictions = modelRunner.getTopPredictions(predictions, 5);
    
    console.log('Top 5 predictions:');
    topPredictions.forEach((pred, index) => {
      console.log(`${index + 1}. ${pred.label}: ${(pred.score * 100).toFixed(2)}%`);
    });
    
    // Use the top prediction for scene inference
    const topScene = topPredictions[0];
    console.log(`\nDetected scene: ${topScene.label} (confidence: ${(topScene.score * 100).toFixed(2)}%)`);
    
    return topPredictions;
  } catch (error) {
    console.error('Image classification failed:', error);
    throw error;
  } finally {
    // Clean up
    modelRunner.unloadModels();
  }
}

/**
 * Demo: Audio classification
 */
export async function demoAudioClassification() {
  console.log('\n=== Audio Classification Demo ===');
  
  const modelRunner = new ModelRunner();
  
  // Mock audio data (in real app, this would come from microphone)
  const audioData: AudioData = {
    samples: new Float32Array(16000), // 1 second at 16kHz
    sampleRate: 16000,
    duration: 1.0
  };
  
  try {
    // Run classification
    const predictions = await modelRunner.runAudioClassification(audioData);
    
    // Get top 5 predictions
    const topPredictions = modelRunner.getTopPredictions(predictions, 5);
    
    console.log('Top 5 audio predictions:');
    topPredictions.forEach((pred, index) => {
      console.log(`${index + 1}. ${pred.label}: ${(pred.score * 100).toFixed(2)}%`);
    });
    
    // Use the top prediction for scene inference
    const topAudioScene = topPredictions[0];
    console.log(`\nDetected audio environment: ${topAudioScene.label} (confidence: ${(topAudioScene.score * 100).toFixed(2)}%)`);
    
    return topPredictions;
  } catch (error) {
    console.error('Audio classification failed:', error);
    throw error;
  } finally {
    // Clean up
    modelRunner.unloadModels();
  }
}

/**
 * Demo: Combined image and audio classification
 */
export async function demoCombinedClassification() {
  console.log('\n=== Combined Classification Demo ===');
  
  const modelRunner = new ModelRunner();
  
  const imageData: ImageData = {
    uri: 'file://camera-snapshot.jpg',
    width: 1920,
    height: 1080
  };
  
  const audioData: AudioData = {
    samples: new Float32Array(16000),
    sampleRate: 16000,
    duration: 1.0
  };
  
  try {
    // Run both classifications in parallel
    const [imagePredictions, audioPredictions] = await Promise.all([
      modelRunner.runImageClassification(imageData),
      modelRunner.runAudioClassification(audioData)
    ]);
    
    // Get top predictions from each
    const topImage = modelRunner.getTopPredictions(imagePredictions, 3);
    const topAudio = modelRunner.getTopPredictions(audioPredictions, 3);
    
    console.log('Top 3 visual predictions:');
    topImage.forEach((pred, index) => {
      console.log(`${index + 1}. ${pred.label}: ${(pred.score * 100).toFixed(2)}%`);
    });
    
    console.log('\nTop 3 audio predictions:');
    topAudio.forEach((pred, index) => {
      console.log(`${index + 1}. ${pred.label}: ${(pred.score * 100).toFixed(2)}%`);
    });
    
    // Combine predictions for final scene inference
    const combinedConfidence = (topImage[0].score + topAudio[0].score) / 2;
    console.log(`\nCombined scene inference:`);
    console.log(`Visual: ${topImage[0].label} (${(topImage[0].score * 100).toFixed(2)}%)`);
    console.log(`Audio: ${topAudio[0].label} (${(topAudio[0].score * 100).toFixed(2)}%)`);
    console.log(`Combined confidence: ${(combinedConfidence * 100).toFixed(2)}%`);
    
    return {
      image: topImage,
      audio: topAudio,
      combinedConfidence
    };
  } catch (error) {
    console.error('Combined classification failed:', error);
    throw error;
  } finally {
    // Clean up
    modelRunner.unloadModels();
  }
}

/**
 * Demo: TFLite integration test
 */
export async function demoTFLiteIntegration() {
  console.log('\n=== TFLite Integration Test ===');
  
  try {
    const testResults = await TFLiteTest.runAllTests();
    
    console.log('TFLite Basic Integration:', testResults.basic ? 'PASS' : 'FAIL');
    console.log('TFLite Model Loading:', testResults.modelLoading ? 'PASS' : 'FAIL');
    
    if (testResults.basic && testResults.modelLoading) {
      console.log('✅ TFLite integration is working correctly!');
      return true;
    } else {
      console.log('❌ TFLite integration has issues');
      return false;
    }
  } catch (error) {
    console.error('TFLite integration test failed:', error);
    return false;
  }
}

/**
 * Run all demos
 */
export async function runAllDemos() {
  try {
    // First test TFLite integration
    const tfliteWorking = await demoTFLiteIntegration();
    
    if (!tfliteWorking) {
      console.log('Skipping other demos due to TFLite integration issues');
      return;
    }
    
    await demoImageClassification();
    await demoAudioClassification();
    await demoCombinedClassification();
    
    console.log('\n=== All demos completed successfully ===');
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Uncomment to run demos
// runAllDemos();