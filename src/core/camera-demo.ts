/**
 * Camera Demo - Test camera functionality
 */

import { sceneBridge } from './SceneBridge';

export async function testCameraFunctionality() {
  console.log('🔍 Testing Camera Functionality...');
  
  try {
    // Test camera permission check
    console.log('1. Checking camera permission...');
    const hasPermission = await sceneBridge.hasCameraPermission();
    console.log(`   Camera permission: ${hasPermission}`);
    
    // Test camera permission request
    console.log('2. Requesting camera permission...');
    const permissionGranted = await sceneBridge.requestCameraPermission();
    console.log(`   Permission request result: ${permissionGranted}`);
    
    // Test image capture (only if permission is granted)
    if (permissionGranted) {
      console.log('3. Capturing image...');
      const imageData = await sceneBridge.captureImage();
      console.log('   Image captured successfully:');
      console.log(`   - Width: ${imageData.width}`);
      console.log(`   - Height: ${imageData.height}`);
      console.log(`   - Format: ${imageData.format}`);
      console.log(`   - Base64 length: ${imageData.base64.length}`);
      console.log(`   - Timestamp: ${new Date(imageData.timestamp).toISOString()}`);
    } else {
      console.log('3. Skipping image capture (permission not granted)');
    }
    
    console.log('✅ Camera functionality test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Camera functionality test failed:', error);
    return false;
  }
}

// Export for use in other modules
export default testCameraFunctionality;