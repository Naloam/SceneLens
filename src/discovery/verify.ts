/**
 * AppDiscoveryEngine 验证脚本
 * 用于验证应用发现引擎的核心功能
 */

import { appDiscoveryEngine } from './AppDiscoveryEngine';
import sceneBridge from '../core/SceneBridge';

/**
 * 验证应用发现引擎的所有功能
 */
export async function verifyAppDiscoveryEngine(): Promise<void> {
  console.log('\n========================================');
  console.log('应用发现引擎验证');
  console.log('========================================\n');

  let allTestsPassed = true;

  // 测试 1: 原生模块连接
  console.log('测试 1: 验证原生模块连接...');
  try {
    const pingResult = await sceneBridge.ping();
    console.log('✓ 原生模块连接成功:', pingResult.message);
  } catch (error) {
    console.error('✗ 原生模块连接失败:', error);
    allTestsPassed = false;
  }

  // 测试 2: 获取已安装应用
  console.log('\n测试 2: 获取已安装应用列表...');
  try {
    const apps = await sceneBridge.getInstalledApps();
    console.log(`✓ 成功获取 ${apps.length} 个已安装应用`);
    
    if (apps.length > 0) {
      console.log('  示例应用:');
      apps.slice(0, 3).forEach(app => {
        console.log(`    - ${app.appName} (${app.packageName})`);
      });
    }
  } catch (error) {
    console.error('✗ 获取应用列表失败:', error);
    allTestsPassed = false;
  }

  // 测试 3: 检查使用统计权限
  console.log('\n测试 3: 检查使用统计权限...');
  try {
    const hasPermission = await sceneBridge.checkUsageStatsPermission();
    if (hasPermission) {
      console.log('✓ 已授予使用统计权限');
    } else {
      console.log('⚠ 未授予使用统计权限（这是正常的，需要用户手动授予）');
      console.log('  可以调用 sceneBridge.openUsageStatsSettings() 引导用户授权');
    }
  } catch (error) {
    console.error('✗ 检查权限失败:', error);
    allTestsPassed = false;
  }

  // 测试 4: 获取使用统计（可能失败）
  console.log('\n测试 4: 获取应用使用统计...');
  try {
    const usageStats = await sceneBridge.getUsageStats(7);
    console.log(`✓ 成功获取 ${usageStats.length} 个应用的使用统计`);
    
    if (usageStats.length > 0) {
      console.log('  使用最多的应用:');
      const sorted = usageStats
        .sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground)
        .slice(0, 3);
      
      sorted.forEach(stat => {
        const hours = (stat.totalTimeInForeground / (1000 * 60 * 60)).toFixed(1);
        console.log(`    - ${stat.packageName}: ${hours}小时, ${stat.launchCount}次启动`);
      });
    }
  } catch (error: any) {
    if (error.code === 'PERMISSION_DENIED') {
      console.log('⚠ 未授予使用统计权限（预期行为）');
    } else {
      console.error('✗ 获取使用统计失败:', error);
      allTestsPassed = false;
    }
  }

  // 测试 5: 初始化应用发现引擎
  console.log('\n测试 5: 初始化应用发现引擎...');
  try {
    await appDiscoveryEngine.initialize();
    console.log('✓ 应用发现引擎初始化成功');
  } catch (error) {
    console.error('✗ 初始化失败:', error);
    allTestsPassed = false;
    return; // 如果初始化失败，后续测试无法进行
  }

  // 测试 6: 验证应用分类
  console.log('\n测试 6: 验证应用分类...');
  try {
    const allApps = appDiscoveryEngine.getAllApps();
    const categoryCounts = new Map<string, number>();
    
    allApps.forEach(app => {
      const count = categoryCounts.get(app.category) || 0;
      categoryCounts.set(app.category, count + 1);
    });

    console.log('✓ 应用分类统计:');
    for (const [category, count] of categoryCounts) {
      if (count > 0) {
        console.log(`    ${category}: ${count} 个应用`);
      }
    }
  } catch (error) {
    console.error('✗ 应用分类验证失败:', error);
    allTestsPassed = false;
  }

  // 测试 7: 验证应用偏好
  console.log('\n测试 7: 验证应用偏好计算...');
  try {
    const preferences = appDiscoveryEngine.getAllPreferences();
    console.log(`✓ 生成了 ${preferences.size} 个类别的偏好设置`);
    
    let hasTopApps = false;
    for (const [category, pref] of preferences) {
      if (pref.topApps.length > 0 && category !== 'OTHER') {
        hasTopApps = true;
        console.log(`  ${category} 首选应用:`);
        pref.topApps.slice(0, 2).forEach((packageName, index) => {
          const app = appDiscoveryEngine.getAllApps().find(a => a.packageName === packageName);
          console.log(`    ${index + 1}. ${app?.appName || packageName}`);
        });
      }
    }

    if (!hasTopApps) {
      console.log('  ⚠ 没有找到分类应用（可能设备上没有相关应用）');
    }
  } catch (error) {
    console.error('✗ 偏好计算验证失败:', error);
    allTestsPassed = false;
  }

  // 测试 8: 验证意图解析
  console.log('\n测试 8: 验证意图解析...');
  try {
    const testIntents = [
      'MUSIC_PLAYER_TOP1',
      'TRANSIT_APP_TOP1',
      'MEETING_APP_TOP1',
      'PAYMENT_APP_TOP1',
    ];

    let resolvedCount = 0;
    for (const intent of testIntents) {
      const packageName = appDiscoveryEngine.resolveIntent(intent);
      if (packageName) {
        const app = appDiscoveryEngine.getAllApps().find(a => a.packageName === packageName);
        console.log(`  ✓ ${intent} → ${app?.appName || packageName}`);
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      console.log(`✓ 成功解析 ${resolvedCount} 个意图`);
    } else {
      console.log('⚠ 没有可解析的意图（可能设备上没有相关应用）');
    }
  } catch (error) {
    console.error('✗ 意图解析验证失败:', error);
    allTestsPassed = false;
  }

  // 测试 9: 验证手动设置偏好
  console.log('\n测试 9: 验证手动设置偏好...');
  try {
    const testPackages = ['com.test.app1', 'com.test.app2'];
    appDiscoveryEngine.setPreference('MUSIC_PLAYER', testPackages);
    
    const pref = appDiscoveryEngine.getPreference('MUSIC_PLAYER');
    if (pref && pref.topApps[0] === testPackages[0]) {
      console.log('✓ 手动设置偏好成功');
    } else {
      console.error('✗ 手动设置偏好失败');
      allTestsPassed = false;
    }
  } catch (error) {
    console.error('✗ 手动设置偏好验证失败:', error);
    allTestsPassed = false;
  }

  // 总结
  console.log('\n========================================');
  if (allTestsPassed) {
    console.log('✓ 所有测试通过！');
  } else {
    console.log('✗ 部分测试失败，请检查错误信息');
  }
  console.log('========================================\n');
}

/**
 * 快速验证 - 仅检查核心功能
 */
export async function quickVerify(): Promise<boolean> {
  try {
    console.log('快速验证应用发现引擎...');
    
    // 1. 测试原生模块
    await sceneBridge.ping();
    console.log('✓ 原生模块正常');
    
    // 2. 测试获取应用
    const apps = await sceneBridge.getInstalledApps();
    console.log(`✓ 获取到 ${apps.length} 个应用`);
    
    // 3. 测试初始化
    await appDiscoveryEngine.initialize();
    console.log('✓ 引擎初始化成功');
    
    // 4. 测试基本功能
    const allApps = appDiscoveryEngine.getAllApps();
    const preferences = appDiscoveryEngine.getAllPreferences();
    console.log(`✓ 分类了 ${allApps.length} 个应用，生成 ${preferences.size} 个偏好`);
    
    console.log('✓ 快速验证通过！\n');
    return true;
  } catch (error) {
    console.error('✗ 快速验证失败:', error);
    return false;
  }
}
