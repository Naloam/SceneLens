import type { FeedbackType } from '../learning/FeedbackProcessor';
import type { OneTapActionKind, UserFeedback } from '../types';

export function mapOneTapActionKindToUserFeedback(
  actionKind: OneTapActionKind,
  success: boolean
): UserFeedback {
  switch (actionKind) {
    case 'execute_all':
      return success ? 'accept' : 'cancel';
    case 'snooze':
      return 'ignore';
    case 'dismiss':
    default:
      return 'cancel';
  }
}

export function mapOneTapActionKindToProcessorFeedback(
  actionKind: OneTapActionKind,
  success: boolean
): FeedbackType {
  switch (actionKind) {
    case 'execute_all':
      return success ? 'ACCEPT' : 'DISMISS';
    case 'snooze':
      return 'IGNORE';
    case 'dismiss':
    default:
      return 'DISMISS';
  }
}
