import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SceneType, Action } from '../types';

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
}

// Export singleton instance
export const notificationManager = new NotificationManagerClass();
