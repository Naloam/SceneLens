/**
 * 桌面快捷方式功能演示
 * 
 * 演示如何使用桌面快捷方式触发场景识别
 */

import { UserTriggeredAnalyzer } from './UserTriggeredAnalyzer';
import { ShortcutManager } from './ShortcutManager';

/**
 * 演示桌面快捷方式基本功能
 */
export async function demoShortcutBasics() {
  console.log('=== 桌面快捷方式基本功能演示 ===');
  
  const shortcutManager = new ShortcutManager();
  
  try {
    // 1. 检查快捷方式支持
    console.log('\n1. 检查快捷方式支持...');
    const supported = await shortcutManager.isShortcutSupported();
    console.log(`快捷方式支持: ${supported ? '是' : '否'}`);
    
    // 2. 创建桌面快捷方式
    console.log('\n2. 创建桌面快捷方式...');
    const created = await shortcutManager.createSceneAnalysisShortcut();
    console.log(`快捷方式创建: ${created ? '成功' : '失败'}`);
    
    if (created) {
      console.log('✅ 桌面快捷方式已创建，请在桌面查看');
      console.log('💡 点击快捷方式将触发场景识别');
    }
    
    // 3. 获取快捷方式信息
    console.log('\n3. 获取快捷方式信息...');
    const info = await shortcutManager.getShortcutInfo();
    console.log('快捷方式信息:', info);
    
  } catch (error) {
    console.error('桌面快捷方式演示失败:', error);
  } finally {
    shortcutManager.cleanup();
  }
}

/**
 * 演示桌面快捷方式事件监听
 */
export async function demoShortcutEventListener() {
  console.log('=== 桌面快捷方式事件监听演示 ===');
  
  const shortcutManager = new ShortcutManager();
  
  try {
    // 启用事件监听
    console.log('\n启用桌面快捷方式事件监听...');
    const enabled = shortcutManager.enableShortcutListener((event) => {
      console.log('🎯 桌面快捷方式触发事件:', {
        trigger: event.trigger,
        source: event.source,
        timestamp: new Date(event.timestamp).toLocaleString(),
      });
      
      console.log('💡 现在可以执行场景识别逻辑...');
    });
    
    if (enabled) {
      console.log('✅ 事件监听已启用');
      console.log('💡 请点击桌面快捷方式来测试事件触发');
      
      // 保持监听一段时间
      console.log('\n⏳ 等待快捷方式触发事件（30秒）...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    } else {
      console.error('❌ 事件监听启用失败');
    }
    
  } catch (error) {
    console.error('桌面快捷方式事件监听演示失败:', error);
  } finally {
    shortcutManager.cleanup();
  }
}

/**
 * 演示完整的桌面快捷方式触发场景识别流程
 */
export async function demoShortcutTriggeredAnalysis() {
  console.log('=== 桌面快捷方式触发场景识别演示 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 1. 创建桌面快捷方式
    console.log('\n1. 创建桌面快捷方式...');
    const created = await analyzer.createDesktopShortcut();
    console.log(`快捷方式创建: ${created ? '成功' : '失败'}`);
    
    // 2. 启用快捷方式触发
    console.log('\n2. 启用快捷方式触发...');
    const enabled = await analyzer.enableShortcutTrigger(true); // 自动分析
    console.log(`快捷方式触发: ${enabled ? '已启用' : '启用失败'}`);
    
    if (enabled) {
      console.log('✅ 桌面快捷方式触发已配置完成');
      console.log('💡 点击桌面快捷方式将自动开始场景识别');
      
      // 保持监听
      console.log('\n⏳ 等待快捷方式触发（60秒）...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    // 3. 检查状态
    console.log('\n3. 检查触发器状态...');
    console.log('快捷方式触发状态:', analyzer.isShortcutTriggerEnabled());
    console.log('音量键触发状态:', analyzer.isVolumeKeyTriggerEnabled());
    console.log('分析状态:', analyzer.isAnalyzing());
    
  } catch (error) {
    console.error('桌面快捷方式触发场景识别演示失败:', error);
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 演示快捷方式管理功能
 */
export async function demoShortcutManagement() {
  console.log('=== 桌面快捷方式管理演示 ===');
  
  const analyzer = new UserTriggeredAnalyzer();
  
  try {
    // 1. 检查支持
    console.log('\n1. 检查快捷方式支持...');
    const supported = await analyzer.isShortcutSupported();
    console.log(`快捷方式支持: ${supported ? '是' : '否'}`);
    
    // 2. 创建快捷方式
    console.log('\n2. 创建快捷方式...');
    const created = await analyzer.createDesktopShortcut();
    console.log(`创建结果: ${created ? '成功' : '失败'}`);
    
    // 3. 等待一段时间
    console.log('\n3. 等待 5 秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. 删除快捷方式
    console.log('\n4. 删除快捷方式...');
    const removed = await analyzer.removeDesktopShortcut();
    console.log(`删除结果: ${removed ? '成功' : '失败'}`);
    
    console.log('\n✅ 快捷方式管理演示完成');
    
  } catch (error) {
    console.error('桌面快捷方式管理演示失败:', error);
  } finally {
    analyzer.cleanup();
  }
}

/**
 * 运行所有桌面快捷方式演示
 */
export async function runAllShortcutDemos() {
  console.log('🚀 开始桌面快捷方式功能演示');
  
  try {
    await demoShortcutBasics();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoShortcutEventListener();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoShortcutTriggeredAnalysis();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoShortcutManagement();
    
    console.log('\n🎉 所有桌面快捷方式演示完成');
    
  } catch (error) {
    console.error('桌面快捷方式演示过程中发生错误:', error);
  }
}

// 导出演示函数
export default {
  demoShortcutBasics,
  demoShortcutEventListener,
  demoShortcutTriggeredAnalysis,
  demoShortcutManagement,
  runAllShortcutDemos,
};