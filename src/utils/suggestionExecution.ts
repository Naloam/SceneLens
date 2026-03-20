import type {
  SuggestionExecutedAction,
  SuggestionExecutionResult,
  SuggestionExecutionStatus,
  SuggestionExecutionSummary,
} from '../types';

export function summarizeSuggestionExecution(
  executedActions: SuggestionExecutedAction[],
  skippedCount: number
): SuggestionExecutionSummary {
  const summary: SuggestionExecutionSummary = {
    automatedCount: 0,
    needsUserInputCount: 0,
    openedAppHomeCount: 0,
    failedCount: 0,
    skippedCount,
  };

  for (const action of executedActions) {
    switch (action.completionStatus) {
      case 'automated':
        summary.automatedCount += 1;
        break;
      case 'needs_user_input':
        summary.needsUserInputCount += 1;
        break;
      case 'opened_app_home':
        summary.openedAppHomeCount += 1;
        break;
      case 'failed':
      default:
        summary.failedCount += 1;
        break;
    }
  }

  return summary;
}

export function deriveSuggestionExecutionStatus(
  summary: SuggestionExecutionSummary
): SuggestionExecutionStatus {
  const hasMeaningfulSuccess =
    summary.automatedCount > 0 || summary.needsUserInputCount > 0;

  if (!hasMeaningfulSuccess && summary.openedAppHomeCount === 0 && summary.failedCount > 0) {
    return 'failed';
  }

  if (!hasMeaningfulSuccess && summary.openedAppHomeCount > 0 && summary.failedCount === 0) {
    return 'opened_app_home';
  }

  if (summary.failedCount > 0 || summary.openedAppHomeCount > 0) {
    return 'partial';
  }

  if (summary.needsUserInputCount > 0) {
    return 'needs_user_input';
  }

  if (summary.automatedCount > 0) {
    return 'completed';
  }

  return 'failed';
}

function formatScenePrefix(sceneDisplayName: string): string {
  return sceneDisplayName ? `${sceneDisplayName}：` : '';
}

function formatSummaryParts(summary: SuggestionExecutionSummary): string {
  const parts: string[] = [];

  if (summary.automatedCount > 0) {
    parts.push(`自动完成 ${summary.automatedCount} 项`);
  }

  if (summary.needsUserInputCount > 0) {
    parts.push(`打开指定页面 ${summary.needsUserInputCount} 项`);
  }

  if (summary.openedAppHomeCount > 0) {
    parts.push(`仅打开应用首页 ${summary.openedAppHomeCount} 项`);
  }

  if (summary.failedCount > 0) {
    parts.push(`失败 ${summary.failedCount} 项`);
  }

  if (summary.skippedCount > 0) {
    parts.push(`跳过 ${summary.skippedCount} 项`);
  }

  return parts.join('，');
}

export function buildSuggestionExecutionFeedback(
  sceneDisplayName: string,
  result: Pick<SuggestionExecutionResult, 'status' | 'summary'>
): { title: string; body: string } {
  const prefix = formatScenePrefix(sceneDisplayName);
  const summaryText = formatSummaryParts(result.summary);

  switch (result.status) {
    case 'completed':
      return {
        title: '已自动完成',
        body: `${prefix}自动完成 ${result.summary.automatedCount} 项操作。`,
      };
    case 'needs_user_input':
      return {
        title: '已打开目标页面',
        body: `${prefix}${summaryText}，仍需你继续完成后续操作。`,
      };
    case 'opened_app_home':
      return {
        title: '仅打开应用',
        body: `${prefix}${summaryText}，当前还不支持自动完成对应动作。`,
      };
    case 'partial':
      return {
        title: '部分完成',
        body: `${prefix}${summaryText}。仅打开首页的动作不计为自动完成。`,
      };
    case 'dismissed':
      return {
        title: '已跳过',
        body: `${prefix}本次建议未执行。`,
      };
    case 'snoozed':
      return {
        title: '已稍后提醒',
        body: `${prefix}本次建议已延后。`,
      };
    case 'failed':
    default:
      return {
        title: '执行失败',
        body: `${prefix}${summaryText || '没有动作达到可用状态。'}`,
      };
  }
}
