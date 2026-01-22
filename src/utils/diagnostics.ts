/**
 * 诊断工具 - 用于检查系统状态和权限
 */

import sceneBridge from '../core/SceneBridge';
import { Platform } from 'react-native';

export interface DiagnosticResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

export interface DiagnosticsReport {
  timestamp: number;
  platform: string;
  results: DiagnosticResult[];
}

/**
 * 运行完整的诊断（顺序执行，避免并发导致ANR）
 */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const results: DiagnosticResult[] = [];

  // 顺序执行每个诊断检查，避免并发导致ANR
  results.push(await testNativeConnection());
  await sleep(100);

  results.push(await checkLocationPermission());
  await sleep(100);

  results.push(await checkCalendarPermission());
  await sleep(100);

  results.push(await checkUsageStatsPermission());
  await sleep(100);

  results.push(await checkActivityRecognitionPermission());
  await sleep(100);

  results.push(await testAppScanning());
  await sleep(100);

  results.push(await testLocationFetch());
  await sleep(100);

  results.push(await testWiFiFetch());
  await sleep(100);

  results.push(await testMotionState());
  await sleep(100);

  results.push(await testForegroundApp());

  return {
    timestamp: Date.now(),
    platform: Platform.OS,
    results,
  };
}

/**
 * 简单的延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试原生模块连接
 */
async function testNativeConnection(): Promise<DiagnosticResult> {
  try {
    const result = await sceneBridge.ping();
    return {
      category: '原生模块',
      status: 'PASS',
      message: '原生模块连接正常',
      details: result,
    };
  } catch (error) {
    return {
      category: '原生模块',
      status: 'FAIL',
      message: '无法连接原生模块',
      details: error,
    };
  }
}

/**
 * 检查位置权限
 */
async function checkLocationPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasLocationPermission();
    if (granted) {
      return {
        category: '位置权限',
        status: 'PASS',
        message: '位置权限已授予',
      };
    } else {
      return {
        category: '位置权限',
        status: 'FAIL',
        message: '位置权限未授予',
      };
    }
  } catch (error) {
    return {
      category: '位置权限',
      status: 'FAIL',
      message: '检查位置权限失败',
      details: error,
    };
  }
}

/**
 * 检查日历权限
 */
async function checkCalendarPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasCalendarPermission();
    if (granted) {
      return {
        category: '日历权限',
        status: 'PASS',
        message: '日历权限已授予',
      };
    } else {
      return {
        category: '日历权限',
        status: 'FAIL',
        message: '日历权限未授予',
      };
    }
  } catch (error) {
    return {
      category: '日历权限',
      status: 'FAIL',
      message: '检查日历权限失败',
      details: error,
    };
  }
}

/**
 * 检查使用统计权限
 */
async function checkUsageStatsPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasUsageStatsPermission();
    if (granted) {
      return {
        category: '使用统计权限',
        status: 'PASS',
        message: '使用统计权限已授予',
      };
    } else {
      return {
        category: '使用统计权限',
        status: 'WARN',
        message: '使用统计权限未授予 - 前台应用检测可能不可用',
      };
    }
  } catch (error) {
    return {
      category: '使用统计权限',
      status: 'WARN',
      message: '检查使用统计权限失败',
      details: error,
    };
  }
}

/**
 * 检查活动识别权限
 */
async function checkActivityRecognitionPermission(): Promise<DiagnosticResult> {
  try {
    const granted = await sceneBridge.hasActivityRecognitionPermission();
    if (granted) {
      return {
        category: '活动识别权限',
        status: 'PASS',
        message: '活动识别权限已授予',
      };
    } else {
      return {
        category: '活动识别权限',
        status: 'WARN',
        message: '活动识别权限未授予 - 运动状态检测可能不可用',
      };
    }
  } catch (error) {
    return {
      category: '活动识别权限',
      status: 'WARN',
      message: '检查活动识别权限失败',
      details: error,
    };
  }
}

/**
 * 测试应用扫描
 */
async function testAppScanning(): Promise<DiagnosticResult> {
  try {
    const apps = await sceneBridge.getInstalledApps();
    return {
      category: '应用扫描',
      status: apps.length > 0 ? 'PASS' : 'WARN',
      message: `扫描到 ${apps.length} 个应用`,
      details: {
        count: apps.length,
        sampleApps: apps.slice(0, 5).map((app: any) => app.packageName),
      },
    };
  } catch (error) {
    return {
      category: '应用扫描',
      status: 'FAIL',
      message: '应用扫描失败',
      details: error,
    };
  }
}

/**
 * 测试位置获取
 */
async function testLocationFetch(): Promise<DiagnosticResult> {
  try {
    const location = await sceneBridge.getCurrentLocation();
    if (location) {
      return {
        category: '位置获取',
        status: 'PASS',
        message: `成功获取位置: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        details: location,
      };
    } else {
      return {
        category: '位置获取',
        status: 'WARN',
        message: '无法获取位置 - 可能需要先请求权限',
      };
    }
  } catch (error) {
    return {
      category: '位置获取',
      status: 'FAIL',
      message: '位置获取失败',
      details: error,
    };
  }
}

/**
 * 测试WiFi获取
 */
async function testWiFiFetch(): Promise<DiagnosticResult> {
  try {
    const wifi = await sceneBridge.getConnectedWiFi();
    if (wifi) {
      return {
        category: 'WiFi获取',
        status: 'PASS',
        message: `已连接WiFi: ${wifi.ssid}`,
        details: wifi,
      };
    } else {
      return {
        category: 'WiFi获取',
        status: 'WARN',
        message: '未连接WiFi或无法获取WiFi信息',
      };
    }
  } catch (error) {
    return {
      category: 'WiFi获取',
      status: 'FAIL',
      message: 'WiFi获取失败',
      details: error,
    };
  }
}

/**
 * 测试运动状态
 */
async function testMotionState(): Promise<DiagnosticResult> {
  try {
    const motion = await sceneBridge.getMotionState();
    return {
      category: '运动状态',
      status: motion ? 'PASS' : 'WARN',
      message: `当前运动状态: ${motion || '未知'}`,
      details: { motion },
    };
  } catch (error) {
    return {
      category: '运动状态',
      status: 'FAIL',
      message: '获取运动状态失败',
      details: error,
    };
  }
}

/**
 * 测试前台应用
 */
async function testForegroundApp(): Promise<DiagnosticResult> {
  try {
    const app = await sceneBridge.getForegroundApp();
    if (app) {
      return {
        category: '前台应用',
        status: 'PASS',
        message: `前台应用: ${app}`,
        details: { packageName: app },
      };
    } else {
      return {
        category: '前台应用',
        status: 'WARN',
        message: '无法获取前台应用 - 可能需要使用统计权限',
      };
    }
  } catch (error) {
    return {
      category: '前台应用',
      status: 'FAIL',
      message: '获取前台应用失败',
      details: error,
    };
  }
}

/**
 * 格式化诊断报告
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  let output = `=== SceneLens 诊断报告 ===\n`;
  output += `时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n`;
  output += `平台: ${report.platform}\n\n`;

  const grouped = report.results.reduce((acc, result) => {
    if (!acc[result.status]) {
      acc[result.status] = [];
    }
    acc[result.status].push(result);
    return acc;
  }, {} as Record<string, DiagnosticResult[]>);

  // 显示失败的项
  if (grouped.FAIL) {
    output += `❌ 失败的项目 (${grouped.FAIL.length}):\n`;
    grouped.FAIL.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
    });
    output += '\n';
  }

  // 显示警告的项
  if (grouped.WARN) {
    output += `⚠️  警告的项目 (${grouped.WARN.length}):\n`;
    grouped.WARN.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
    });
    output += '\n';
  }

  // 显示通过的项
  if (grouped.PASS) {
    output += `✅ 通过的项目 (${grouped.PASS.length}):\n`;
    grouped.PASS.forEach(r => {
      output += `  - ${r.category}: ${r.message}\n`;
      if (r.details && Object.keys(r.details).length > 0) {
        output += `    ${JSON.stringify(r.details, null, 2)}\n`;
      }
    });
  }

  return output;
}

export default {
  runDiagnostics,
  formatDiagnosticsReport,
};
