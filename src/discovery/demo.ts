/**
 * AppDiscoveryEngine Demo
 * 演示应用发现引擎的功能
 */

import { appDiscoveryEngine } from './AppDiscoveryEngine';
import type { AppCategory } from '../types';

/**
 * 演示应用发现引擎
 */
export async function demoAppDiscovery() {
  console.log('=== AppDiscoveryEngine Demo ===\n');

  try {
    // 1. 初始化引擎
    console.log('1. Initializing AppDiscoveryEngine...');
    await appDiscoveryEngine.initialize();
    console.log('✓ Initialization complete\n');

    // 2. 获取所有应用
    const allApps = appDiscoveryEngine.getAllApps();
    console.log(`2. Total apps found: ${allApps.length}`);
    console.log('Sample apps:');
    allApps.slice(0, 5).forEach(app => {
      console.log(`  - ${app.appName} (${app.packageName})`);
      console.log(`    Category: ${app.category}`);
    });
    console.log();

    // 3. 按类别统计
    console.log('3. Apps by category:');
    const categories: AppCategory[] = [
      'MUSIC_PLAYER',
      'TRANSIT_APP',
      'PAYMENT_APP',
      'MEETING_APP',
      'STUDY_APP',
      'SMART_HOME',
      'CALENDAR',
    ];

    for (const category of categories) {
      const apps = appDiscoveryEngine.getAppsByCategory(category);
      if (apps.length > 0) {
        console.log(`  ${category}: ${apps.length} apps`);
        apps.slice(0, 3).forEach(app => {
          console.log(`    - ${app.appName}`);
        });
      }
    }
    console.log();

    // 4. 获取偏好设置
    console.log('4. App preferences (Top apps by category):');
    const preferences = appDiscoveryEngine.getAllPreferences();
    for (const [category, pref] of preferences) {
      if (pref.topApps.length > 0 && category !== 'OTHER') {
        console.log(`  ${category}:`);
        pref.topApps.forEach((packageName, index) => {
          const app = allApps.find(a => a.packageName === packageName);
          if (app) {
            console.log(`    ${index + 1}. ${app.appName} (${packageName})`);
          }
        });
      }
    }
    console.log();

    // 5. 测试意图解析
    console.log('5. Testing intent resolution:');
    const testIntents = [
      'MUSIC_PLAYER_TOP1',
      'TRANSIT_APP_TOP1',
      'MEETING_APP_TOP1',
    ];

    for (const intent of testIntents) {
      const packageName = appDiscoveryEngine.resolveIntent(intent);
      if (packageName) {
        const app = allApps.find(a => a.packageName === packageName);
        console.log(`  ${intent} → ${app?.appName || packageName}`);
      } else {
        console.log(`  ${intent} → (not found)`);
      }
    }
    console.log();

    console.log('=== Demo Complete ===');
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

/**
 * 验证应用发现引擎功能
 */
export async function verifyAppDiscovery(): Promise<boolean> {
  console.log('=== Verifying AppDiscoveryEngine ===\n');

  try {
    // 初始化
    await appDiscoveryEngine.initialize();

    // 检查 1: 是否已初始化
    if (!appDiscoveryEngine.isInitialized()) {
      console.error('✗ Engine not initialized');
      return false;
    }
    console.log('✓ Engine initialized');

    // 检查 2: 是否找到应用
    const allApps = appDiscoveryEngine.getAllApps();
    if (allApps.length === 0) {
      console.error('✗ No apps found');
      return false;
    }
    console.log(`✓ Found ${allApps.length} apps`);

    // 检查 3: 应用是否被正确分类
    const categorizedCount = allApps.filter(app => app.category !== 'OTHER').length;
    console.log(`✓ ${categorizedCount} apps categorized (${allApps.length - categorizedCount} in OTHER)`);

    // 检查 4: 偏好设置是否生成
    const preferences = appDiscoveryEngine.getAllPreferences();
    if (preferences.size === 0) {
      console.error('✗ No preferences generated');
      return false;
    }
    console.log(`✓ Generated preferences for ${preferences.size} categories`);

    // 检查 5: 意图解析是否工作
    let intentResolved = false;
    for (const [category] of preferences) {
      if (category !== 'OTHER') {
        const intent = `${category}_TOP1`;
        const packageName = appDiscoveryEngine.resolveIntent(intent);
        if (packageName) {
          intentResolved = true;
          console.log(`✓ Intent resolution works: ${intent} → ${packageName}`);
          break;
        }
      }
    }

    if (!intentResolved) {
      console.warn('⚠ No intents could be resolved (might be normal if no apps in categories)');
    }

    console.log('\n=== Verification Complete ===');
    return true;
  } catch (error) {
    console.error('✗ Verification failed:', error);
    return false;
  }
}
