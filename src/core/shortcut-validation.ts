/**
 * 桌面快捷方式功能验证脚本
 * 
 * 验证桌面快捷方式的基本功能是否正常工作
 */

import { UserTriggeredAnalyzer } from './UserTriggeredAnalyzer';
import { ShortcutManager } from './ShortcutManager';

/**
 * 验证桌面快捷方式基本功能
 */
export async function validateShortcutBasics(): Promise<boolean> {
  console.log('🔍 验证桌面快捷方式基本功能...');
  
  const shortcutManager = new ShortcutManager();
  let success = true;
  
  try {
    // 1. 检查快捷方式支持
    console.log('\n1. 检查快捷方式支持...');
    const supported = await shortcutManager.isShortcutSupported();
    console.log(`   快捷方式支持: ${supported ? '✅ 是' : '⚠️ 否'}`);
    
    // 2. 创建桌面快捷方式
    console.log('\n2. 创建桌面快捷方式...');
    const created = await shortcutManager.createSceneAnalysisShortcut();
    console.log(`   创建结果: ${created ? '✅ 成功' : '❌ 失败'}`);
    if (!created) success = false;
    
    // 3. 获取快捷方式信息
    console.log('\n3. 获取快捷方式信息...');
    const info = await shortcutManager.getShortcutInfo();
    console.log(`   支持状态: ${info.supported ? '✅' : '❌'}`);
    console.log(`   监听状态: ${info.listenerEnabled ? '✅' : '❌'}`);
    
    // 4. 删除桌面快捷方式
    console.log('\n4. 删除桌面快捷方式...');
    const removed = await shortcutManager.removeSceneAnalysisShortcut();
    console.log(`   删除结果: ${removed ? '✅ 成功' : '❌ 失败'}`);
    if (!removed) success = false;
    
    console.log(`\n🎯 桌面快捷方式基本功能验证: ${success ? '✅ 通过' : '❌ 失败'}`);
    return success;
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    return false;
  } finally {
    shortcutManager.cleanup();
  }
}

/**
 * 验证桌面快捷方式事件监听
 */
export async function validateShortcutEventListener(): Promise<boolean> {
  console.log('🔍 验证桌面快捷方式事件监听...');
  
  const shortcutManager = new ShortcutManager();
  let eventReceived = false;
  
  try {
    // 启用事件监听
    console.log('\n1. 启用事件监听...');
    const enabled = shortcutManager.enableShortcutListener((event) => {
      console.log('📨 收到快捷方式事件:', {
        trigger: event.trigger,
        source: event.source,
        timestamp: new Date(event.timestamp).toLocaleString(),
      });
      eventReceived = true;
    });
    
    console.log(`   监听启用: ${enabled ? '✅ 成功' : '❌ 失败'}`);
    
    if (enabled) {
      console.log('\n2. 等待事件触发（5秒）...');
      console.log('   💡 请在桌面点击快捷方式来测试事件触发');
      
      // 等待5秒
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`\n3. 事件接收状态: ${eventReceived ? '✅ 已接收' : '⚠️ 未接收'}`);
    }
    
    const success = enabled;
    console.log(`\n🎯 桌面快捷方式事件监听验证: ${success ? '✅ 通过' : '❌ 失败'}`);
    return success;
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    return false;
  } finally {
    shortcutManager.cleanup();
  }
}

/**
 * 验证用户触发分析器的快捷方式集成
 */
export async function validateUserTriggeredAnalyzerIntegration(): Promise<boolean> {
  console.log('🔍 验证用户触发分析器的快捷方式集成...');
  
  const analyzer = new UserTriggeredAnalyzer();
  let success = true;
  
  try {
    // 1. 检查快捷方式支持
    console.log('\n1. 检查快捷方式支持...');
    const supported = await analyzer.isShortcutSupported();
    console.log(`   快捷方式支持: ${supported ? '✅ 是' : '⚠️ 否'}`);
    
    // 2. 创建桌面快捷方式
    console.log('\n2. 创建桌面快捷方式...');
    const created = await analyzer.createDesktopShortcut();
    console.log(`   创建结果: ${created ? '✅ 成功' : '❌ 失败'}`);
    if (!created) success = false;
    
    // 3. 启用快捷方式触发
    console.log('\n3. 启用快捷方式触发...');
    const enabled = await analyzer.enableShortcutTrigger(false); // 不自动分析
    console.log(`   触发启用: ${enabled ? '✅ 成功' : '❌ 失败'}`);
    if (!enabled) success = false;
    
    // 4. 检查状态
    console.log('\n4. 检查状态...');
    console.log(`   快捷方式触发: ${analyzer.isShortcutTriggerEnabled() ? '✅' : '❌'}`);
    console.log(`   音量键触发: ${analyzer.isVolumeKeyTriggerEnabled() ? '✅' : '❌'}`);
    console.log(`   分析状态: ${analyzer.isAnalyzing() ? '🔄 进行中' : '⏸️ 空闲'}`);
    
    // 5. 禁用快捷方式触发
    console.log('\n5. 禁用快捷方式触发...');
    const disabled = await analyzer.disableShortcutTrigger();
    console.log(`   禁用结果: ${disabled ? '✅ 成功' : '❌ 失败'}`);
    
    // 6. 删除桌面快捷方式
    console.log('\n6. 删除桌面快捷方式...');
    const removed = await analyzer.removeDesktopShortcut();
    console.log(`   删除结果: ${removed ? '✅ 成功' : '❌ 失败'}`);
    
    console.log(`\n🎯 用户触发分析器快捷方式集成验证: ${success ? '✅ 通过' : '❌ 失败'}`);
    return success;
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    return false;
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 运行所有验证测试
 */
export async function runAllValidations(): Promise<boolean> {
  console.log('🚀 开始桌面快捷方式功能验证');
  console.log('=' .repeat(50));
  
  const results: boolean[] = [];
  
  try {
    // 基本功能验证
    results.push(await validateShortcutBasics());
    console.log('\n' + '-'.repeat(50));
    
    // 事件监听验证
    results.push(await validateShortcutEventListener());
    console.log('\n' + '-'.repeat(50));
    
    // 集成验证
    results.push(await validateUserTriggeredAnalyzerIntegration());
    
    const allPassed = results.every(result => result);
    const passedCount = results.filter(result => result).length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 验证结果汇总:');
    console.log(`   总测试数: ${results.length}`);
    console.log(`   通过数: ${passedCount}`);
    console.log(`   失败数: ${results.length - passedCount}`);
    console.log(`   成功率: ${Math.round((passedCount / results.length) * 100)}%`);
    
    if (allPassed) {
      console.log('\n🎉 所有验证测试通过！桌面快捷方式功能正常工作。');
    } else {
      console.log('\n⚠️ 部分验证测试失败，请检查相关功能。');
    }
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ 验证过程中发生严重错误:', error);
    return false;
  }
}

// 导出验证函数
export default {
  validateShortcutBasics,
  validateShortcutEventListener,
  validateUserTriggeredAnalyzerIntegration,
  runAllValidations,
};