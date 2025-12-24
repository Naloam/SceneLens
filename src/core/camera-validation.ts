/**
 * Camera Functionality Validation
 * 验证相机功能实现的完整性
 */

import { sceneBridge } from './SceneBridge';
import type { ImageData } from '../types';

interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * 验证相机接口是否正确实现
 */
export async function validateCameraInterface(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. 验证相机权限检查方法存在
  try {
    const hasPermission = await sceneBridge.hasCameraPermission();
    results.push({
      success: true,
      message: '✅ hasCameraPermission() 方法正常工作',
      details: { hasPermission }
    });
  } catch (error) {
    results.push({
      success: false,
      message: '❌ hasCameraPermission() 方法失败',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
  }

  // 2. 验证相机权限请求方法存在
  try {
    const requestResult = await sceneBridge.requestCameraPermission();
    results.push({
      success: true,
      message: '✅ requestCameraPermission() 方法正常工作',
      details: { requestResult }
    });
  } catch (error) {
    results.push({
      success: false,
      message: '❌ requestCameraPermission() 方法失败',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
  }

  // 3. 验证图像捕获方法存在并返回正确格式
  try {
    const imageData = await sceneBridge.captureImage();
    
    // 验证返回数据结构
    const isValidImageData = validateImageDataStructure(imageData);
    
    if (isValidImageData.success) {
      results.push({
        success: true,
        message: '✅ captureImage() 方法正常工作，返回数据格式正确',
        details: {
          width: imageData.width,
          height: imageData.height,
          format: imageData.format,
          base64Length: imageData.base64.length,
          timestamp: new Date(imageData.timestamp).toISOString()
        }
      });
    } else {
      results.push({
        success: false,
        message: '❌ captureImage() 返回数据格式不正确',
        details: isValidImageData.details
      });
    }
  } catch (error) {
    results.push({
      success: false,
      message: '❌ captureImage() 方法失败',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
  }

  return results;
}

/**
 * 验证 ImageData 结构是否正确
 */
function validateImageDataStructure(imageData: any): ValidationResult {
  const requiredFields = ['base64', 'width', 'height', 'format', 'timestamp'];
  const missingFields: string[] = [];
  const invalidTypes: string[] = [];

  // 检查必需字段
  for (const field of requiredFields) {
    if (!(field in imageData)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      success: false,
      message: '缺少必需字段',
      details: { missingFields }
    };
  }

  // 检查字段类型
  if (typeof imageData.base64 !== 'string') {
    invalidTypes.push('base64 应该是 string 类型');
  }
  if (typeof imageData.width !== 'number') {
    invalidTypes.push('width 应该是 number 类型');
  }
  if (typeof imageData.height !== 'number') {
    invalidTypes.push('height 应该是 number 类型');
  }
  if (typeof imageData.format !== 'string') {
    invalidTypes.push('format 应该是 string 类型');
  }
  if (typeof imageData.timestamp !== 'number') {
    invalidTypes.push('timestamp 应该是 number 类型');
  }

  if (invalidTypes.length > 0) {
    return {
      success: false,
      message: '字段类型不正确',
      details: { invalidTypes }
    };
  }

  // 检查合理的值
  if (imageData.width <= 0 || imageData.height <= 0) {
    return {
      success: false,
      message: '图像尺寸不合理',
      details: { width: imageData.width, height: imageData.height }
    };
  }

  if (imageData.timestamp <= 0) {
    return {
      success: false,
      message: '时间戳不合理',
      details: { timestamp: imageData.timestamp }
    };
  }

  return {
    success: true,
    message: 'ImageData 结构正确'
  };
}

/**
 * 打印验证结果
 */
export function printValidationResults(results: ValidationResult[]): void {
  console.log('\n📸 相机功能验证结果：');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let totalCount = results.length;
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.message}`);
    if (result.details) {
      console.log('   详情:', JSON.stringify(result.details, null, 2));
    }
    
    if (result.success) {
      successCount++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 总结: ${successCount}/${totalCount} 项测试通过`);
  
  if (successCount === totalCount) {
    console.log('🎉 所有相机功能验证通过！');
  } else {
    console.log('⚠️  部分功能需要修复');
  }
}

/**
 * 运行完整的相机功能验证
 */
export async function runCameraValidation(): Promise<boolean> {
  console.log('🔍 开始验证相机功能实现...');
  
  try {
    const results = await validateCameraInterface();
    printValidationResults(results);
    
    const allPassed = results.every(result => result.success);
    return allPassed;
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    return false;
  }
}

export default runCameraValidation;