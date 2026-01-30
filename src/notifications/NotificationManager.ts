import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type {
  SceneType,
  Action,
  SceneSuggestionPackage,
  OneTapAction,
} from '../types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface SceneSuggestionNotification {
  sceneType: SceneType;
  title: string;
  body: string;
  actions: Action[];
  confidence: number;
}

export interface AutoModeUpgradePrompt {
  sceneType: SceneType;
  title: string;
  body: string;
  acceptCount: number;
}

export interface NotificationAction {
  identifier: string;
  buttonTitle: string;
  options?: {
    opensAppToForeground?: boolean;
  };
}

export interface DailySummaryNotification {
  title: string;
  body: string;
  stats: {
    commuteDuration?: number;
    commuteCount?: number;
    meetingCount?: number;
    studyHours?: number;
    steps?: number;
  };
}

/**
 * 基于场景执行建议包的通知
 */
export interface SceneSuggestionPackageNotification {
  scenePackage: SceneSuggestionPackage;
  confidence: number;
  /**
   * 自定义标题（可选，默认使用场景 displayName）
   */
  customTitle?: string;
  /**
   * 自定义正文（可选，默认使用检测要点）
   */
  customBody?: string;
  /**
   * 要显示的操作（可选，默认显示所有 primary 操作）
   */
  actions?: OneTapAction[];
}

class NotificationManagerClass {
  private initialized = false;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Initialize notification manager and request permissions
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted');
        return false;
      }

      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupNotificationChannels();
      }

      // Set up listeners
      this.setupListeners();

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * Set up Android notification channels
   */
  private async setupNotificationChannels(): Promise<void> {
    // Auto mode upgrade channel (high priority)
    await Notifications.setNotificationChannelAsync('auto_mode_upgrade', {
      name: '自动模式升级',
      description: '场景自动模式升级建议',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Scene suggestions channel (high priority)
    await Notifications.setNotificationChannelAsync('scene_suggestions', {
      name: '场景建议',
      description: '场景识别后的操作建议',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Scene execution channel (default priority)
    await Notifications.setNotificationChannelAsync('scene_execution', {
      name: '场景执行',
      description: '场景执行结果通知',
      importance: Notifications.AndroidImportance.DEFAULT,
      enableVibrate: false,
      showBadge: false,
    });

    // System notifications channel (low priority)
    await Notifications.setNotificationChannelAsync('system', {
      name: '系统通知',
      description: '系统状态和错误通知',
      importance: Notifications.AndroidImportance.LOW,
      enableVibrate: false,
      showBadge: false,
    });
  }

  /**
   * Set up notification listeners
   */
  private setupListeners(): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listener for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Handle user response to notification
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification, actionIdentifier } = response;
    const data = notification.request.content.data;

    console.log('User action:', actionIdentifier);
    console.log('Notification data:', data);

    // Handle different action types
    if (actionIdentifier === 'execute') {
      // User clicked "一键执行" button
      this.handleExecuteAction(data);
    } else if (actionIdentifier === 'dismiss') {
      // User dismissed the notification
      this.handleDismissAction(data);
    } else if (actionIdentifier === 'accept_auto_mode') {
      // User accepted auto mode upgrade
      this.handleAutoModeUpgradeResponse(data, true);
    } else if (actionIdentifier === 'reject_auto_mode') {
      // User rejected auto mode upgrade
      this.handleAutoModeUpgradeResponse(data, false);
    } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // User tapped the notification itself
      this.handleDefaultAction(data);
    }
  }

  /**
   * Handle execute action
   */
  private handleExecuteAction(data: any): void {
    // This will be handled by the scene executor
    // Emit event or call callback
    console.log('Execute scene actions:', data.sceneType);
  }

  /**
   * Handle dismiss action
   */
  private handleDismissAction(data: any): void {
    console.log('User dismissed scene suggestion:', data.sceneType);
    // Record user feedback
  }

  /**
   * Handle default action (tap on notification)
   */
  private handleDefaultAction(data: any): void {
    console.log('User tapped notification:', data.sceneType);
    // Open app to scene details
  }

  /**
   * Handle auto mode upgrade response
   */
  private async handleAutoModeUpgradeResponse(data: any, accepted: boolean): Promise<void> {
    console.log(`User ${accepted ? 'accepted' : 'rejected'} auto mode upgrade for:`, data.sceneType);
    
    try {
      // 动态导入 PredictiveTrigger 以避免循环依赖
      const { predictiveTrigger } = await import('../core/PredictiveTrigger');
      
      // 处理用户响应
      await predictiveTrigger.handleAutoModeUpgradeResponse(data.sceneType, accepted);
    } catch (error) {
      console.error('Failed to handle auto mode upgrade response:', error);
    }
  }

  /**
   * Show auto mode upgrade prompt notification
   */
  async showAutoModeUpgradePrompt(prompt: AutoModeUpgradePrompt): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: prompt.title,
          body: prompt.body,
          data: {
            type: 'auto_mode_upgrade',
            sceneType: prompt.sceneType,
            acceptCount: prompt.acceptCount,
            timestamp: Date.now(),
          },
          categoryIdentifier: 'auto_mode_upgrade',
          sound: true,
        },
        trigger: null, // Show immediately
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show auto mode upgrade prompt:', error);
      return null;
    }
  }
  async showSceneSuggestion(suggestion: SceneSuggestionNotification): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: suggestion.title,
          body: suggestion.body,
          data: {
            sceneType: suggestion.sceneType,
            actions: suggestion.actions,
            confidence: suggestion.confidence,
            timestamp: Date.now(),
          },
          categoryIdentifier: 'scene_suggestion',
          sound: true,
        },
        trigger: null, // Show immediately
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show scene suggestion:', error);
      return null;
    }
  }

  /**
   * Show scene execution result notification
   */
  async showExecutionResult(
    sceneType: SceneType,
    success: boolean,
    message: string
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: success ? '✅ 场景执行成功' : '❌ 场景执行失败',
          body: message,
          data: {
            sceneType,
            success,
            timestamp: Date.now(),
          },
          sound: false,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show execution result:', error);
      return null;
    }
  }

  /**
   * Show daily summary notification
   */
  async showDailySummary(summary: DailySummaryNotification): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Build summary body
      const summaryLines = [];
      if (summary.stats.commuteCount !== undefined) {
        summaryLines.push(`🚇 通勤 ${summary.stats.commuteCount} 次`);
      }
      if (summary.stats.commuteDuration !== undefined) {
        summaryLines.push(`⏱️ 通勤时长 ${Math.round(summary.stats.commuteDuration)} 分钟`);
      }
      if (summary.stats.meetingCount !== undefined) {
        summaryLines.push(`📅 会议 ${summary.stats.meetingCount} 场`);
      }
      if (summary.stats.studyHours !== undefined) {
        summaryLines.push(`📚 学习 ${Math.round(summary.stats.studyHours)} 小时`);
      }
      if (summary.stats.steps !== undefined) {
        summaryLines.push(`👣 步数 ${summary.stats.steps}`);
      }

      const body = summaryLines.length > 0
        ? `${summary.body}\n\n${summaryLines.join('\n')}`
        : summary.body;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: summary.title,
          body,
          data: {
            type: 'daily_summary',
            stats: summary.stats,
            timestamp: Date.now(),
          },
          categoryIdentifier: 'scene_suggestions',
          sound: true,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show daily summary:', error);
      return null;
    }
  }

  /**
   * Show system notification
   */
  async showSystemNotification(title: string, body: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'system',
            timestamp: Date.now(),
          },
          sound: false,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show system notification:', error);
      return null;
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.dismissNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Set up notification categories with actions
   */
  async setupNotificationCategories(): Promise<void> {
    if (Platform.OS === 'android') {
      // Android uses notification channels, not categories
      // Actions are defined per notification
      return;
    }

    // iOS notification categories
    await Notifications.setNotificationCategoryAsync('scene_suggestion', [
      {
        identifier: 'execute',
        buttonTitle: '一键执行',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: '忽略',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    // Auto mode upgrade category
    await Notifications.setNotificationCategoryAsync('auto_mode_upgrade', [
      {
        identifier: 'accept_auto_mode',
        buttonTitle: '升级为自动模式',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'reject_auto_mode',
        buttonTitle: '暂不升级',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    this.initialized = false;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * 显示基于场景执行建议包的通知
   * 这是新的推荐方式，使用场景建议包配置来生成通知
   */
  async showSceneSuggestionPackage(
    notification: SceneSuggestionPackageNotification
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { scenePackage, confidence, customTitle, customBody, actions } = notification;

      // 构建通知标题
      const title = customTitle ?? `${scenePackage.displayName}模式已准备`;

      // 构建通知正文
      let body = customBody;
      if (!body) {
        // 使用检测要点作为正文
        const highlights = scenePackage.detectionHighlights.slice(0, 2);
        body = highlights.length > 0
          ? `检测到：${highlights.join('、')}`
          : '已为您准备好相关操作';
      }

      // 构建操作按钮
      const actionsToShow = actions ?? scenePackage.oneTapActions.filter(a => a.type === 'primary');
      const primaryAction = actionsToShow[0];

      // 构建 Android 操作按钮
      const androidActions: Notifications.NotificationAction[] = [];

      if (primaryAction && Platform.OS === 'android') {
        androidActions.push({
          identifier: `suggestion_${scenePackage.sceneId}_${primaryAction.id}`,
          buttonTitle: primaryAction.label,
          // 注：新版 expo-notifications 使用 options 对象来配置
          options: {
            opensAppToForeground: true,
          },
        } as Notifications.NotificationAction);
      }

      const secondaryAction = actionsToShow[1];
      if (secondaryAction && Platform.OS === 'android') {
        androidActions.push({
          identifier: `suggestion_${scenePackage.sceneId}_${secondaryAction.id}`,
          buttonTitle: secondaryAction.label,
          options: {
            opensAppToForeground: false,
          },
        } as Notifications.NotificationAction);
      }

      const notificationContent: Notifications.NotificationContentInput = {
        title,
        body,
        data: {
          type: 'scene_suggestion_package',
          sceneId: scenePackage.sceneId,
          scenePackage: JSON.stringify(scenePackage),
          confidence,
          actions: actionsToShow.map(a => a.id),
          timestamp: Date.now(),
        },
        categoryIdentifier: 'scene_suggestion',
        sound: true,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null,
      });

      console.log(`[NotificationManager] 已显示场景建议包通知: ${scenePackage.sceneId} (${notificationId})`);
      return notificationId;
    } catch (error) {
      console.error('[NotificationManager] 显示场景建议包通知失败:', error);
      return null;
    }
  }

  /**
   * 显示场景建议包执行结果通知
   */
  async showSuggestionExecutionResult(
    scenePackage: SceneSuggestionPackage,
    success: boolean,
    executedCount: number,
    totalCount: number,
    skippedCount: number
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const title = success ? '✅ 场景执行成功' : '⚠️ 场景部分执行失败';

      let body = `${scenePackage.displayName}：`;
      if (success && skippedCount === 0) {
        body += `已完成 ${executedCount} 项操作`;
      } else if (success) {
        body += `已完成 ${executedCount} 项，跳过 ${skippedCount} 项`;
      } else {
        body += `${executedCount}/${totalCount} 项操作成功`;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'suggestion_execution_result',
            sceneId: scenePackage.sceneId,
            success,
            executedCount,
            totalCount,
            skippedCount,
            timestamp: Date.now(),
          },
          categoryIdentifier: 'scene_execution',
          sound: false,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('[NotificationManager] 显示执行结果通知失败:', error);
      return null;
    }
  }

  /**
   * 为场景执行建议包设置 Android 通知类别
   * 每个场景可以有自定义的操作按钮
   */
  async setupSceneSuggestionCategories(scenePackage: SceneSuggestionPackage): Promise<void> {
    if (Platform.OS === 'android') {
      // Android 使用动态定义的操作按钮，不需要预定义类别
      return;
    }

    // iOS 需要预定义通知类别
    const actions = scenePackage.oneTapActions.map(action => ({
      identifier: `suggestion_${scenePackage.sceneId}_${action.id}`,
      buttonTitle: action.label,
      options: {
        opensAppToForeground: action.action === 'execute_all',
      } as const,
    }));

    await Notifications.setNotificationCategoryAsync(
      `scene_suggestion_${scenePackage.sceneId}`,
      actions
    );
  }
}

// Export singleton instance
export const notificationManager = new NotificationManagerClass();
