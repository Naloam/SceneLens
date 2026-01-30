/**
 * useDiagnostics - 诊断工具自定义 Hook
 * 
 * 负责：
 * - 执行系统诊断
 * - 格式化诊断报告
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { runDiagnostics as runDiagnosticsUtil, formatDiagnosticsReport } from '../utils/diagnostics';

export interface UseDiagnosticsReturn {
  diagnosing: boolean;
  runDiagnostics: () => Promise<void>;
}

export function useDiagnostics(): UseDiagnosticsReturn {
  const [diagnosing, setDiagnosing] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setDiagnosing(true);
    try {
      const report = await runDiagnosticsUtil();
      const message = formatDiagnosticsReport(report);
      Alert.alert('诊断报告', message, [{ text: '确定' }]);
    } catch (error) {
      Alert.alert('诊断失败', `运行诊断时出错: ${(error as Error).message}`);
    } finally {
      setDiagnosing(false);
    }
  }, []);

  return {
    diagnosing,
    runDiagnostics,
  };
}

export default useDiagnostics;
