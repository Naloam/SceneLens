/**
 * ProactiveReminder - 主动提醒引擎
 * 
 * 基于场景和时间的主动提醒：
 * - 离开提醒（离开某地时提醒携带物品等）
 * - 久坐提醒（长时间保持静止时提醒活动）
 * - 睡眠提醒（到达睡眠时间提醒休息）
 * - 自定义提醒模板
 * 
 * @module notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SceneType } from '../types';

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  REMINDER_SETTINGS: 'proactive_reminder_settings',
  REMINDER_HISTORY: 'proactive_reminder_history',
  ACTIVE_REMINDERS: 'active_reminders',
};

// ==================== 类型定义 ====================

/**
 * 提醒类型
 */
export type ReminderType = 
  | 'LEAVING'         // 离开提醒
  | 'SEDENTARY'       // 久坐提醒
  | 'SLEEP'           // 睡眠提醒
  | 'HYDRATION'       // 喝水提醒
  | 'BREAK'           // 休息提醒
  | 'COMMUTE_PREP'    // 通勤准备提醒
  | 'MEETING_PREP'    // 会议准备提醒
  | 'CUSTOM';         // 自定义提醒

/**
 * 提醒触发条件
 */
export interface ReminderTrigger {
  /** 触发类型 */
  type: 'SCENE_CHANGE' | 'TIME' | 'DURATION' | 'LOCATION';
  /** 场景变化触发：离开场景 */
  leaveScene?: SceneType;
  /** 场景变化触发：进入场景 */
  enterScene?: SceneType;
  /** 时间触发：具体时间 (HH:mm) */
  time?: string;
  /** 时长触发：持续时间（分钟） */
  duration?: number;
  /** 位置触发：位置 ID */
  locationId?: string;
}

/**
 * 提醒模板
 */
export interface ReminderTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 提醒类型 */
  type: ReminderType;
  /** 标题 */
  title: string;
  /** 内容 */
  body: string;
  /** 图标 */
  icon?: string;
  /** 触发条件 */
  trigger: ReminderTrigger;
  /** 启用状态 */
  enabled: boolean;
  /** 重复设置 */
  repeat?: {
    enabled: boolean;
    interval: number;  // 分钟
    maxTimes?: number;
  };
  /** 生效时间段 */
  activeHours?: {
    start: string;  // HH:mm
    end: string;    // HH:mm
  };
  /** 适用场景 */
  applicableScenes?: SceneType[];
}

/**
 * 提醒记录
 */
export interface ReminderRecord {
  /** 记录 ID */
  id: string;
  /** 模板 ID */
  templateId: string;
  /** 提醒类型 */
  type: ReminderType;
  /** 触发时间 */
  triggeredAt: number;
  /** 用户操作 */
  userAction?: 'VIEWED' | 'DISMISSED' | 'ACTED';
  /** 操作时间 */
  actionAt?: number;
}

/**
 * 提醒设置
 */
export interface ReminderSettings {
  /** 是否启用主动提醒 */
  enabled: boolean;
  /** 免打扰时间 */
  quietHours: {
    enabled: boolean;
    start: string;  // HH:mm
    end: string;    // HH:mm
  };
  /** 各类型提醒开关 */
  typeSettings: Partial<Record<ReminderType, boolean>>;
  /** 久坐提醒间隔（分钟） */
  sedentaryInterval: number;
  /** 睡眠提醒时间 */
  sleepReminderTime: string;
  /** 喝水提醒间隔（分钟） */
  hydrationInterval: number;
}

/**
 * 活动提醒
 */
interface ActiveReminder {
  id: string;
  templateId: string;
  scheduledAt: number;
  notificationId?: string;
}

// ==================== 默认配置 ====================

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  quietHours: {
    enabled: true,
    start: '23:00',
    end: '07:00',
  },
  typeSettings: {
    LEAVING: true,
    SEDENTARY: true,
    SLEEP: true,
    HYDRATION: false,
    BREAK: true,
    COMMUTE_PREP: true,
    MEETING_PREP: true,
    CUSTOM: true,
  },
  sedentaryInterval: 60,
  sleepReminderTime: '22:30',
  hydrationInterval: 90,
};

// ==================== 内置提醒模板 ====================

const BUILTIN_TEMPLATES: ReminderTemplate[] = [
  // 离开办公室提醒
  {
    id: 'leaving_office',
    name: '离开办公室提醒',
    type: 'LEAVING',
    title: '📤 即将离开办公室',
    body: '请检查：钥匙、钱包、手机、工牌',
    icon: 'briefcase',
    trigger: {
      type: 'SCENE_CHANGE',
      leaveScene: 'OFFICE',
    },
    enabled: true,
    activeHours: {
      start: '17:00',
      end: '23:00',
    },
  },
  // 离开家提醒
  {
    id: 'leaving_home',
    name: '离开家提醒',
    type: 'LEAVING',
    title: '🏠 即将出门',
    body: '请检查：手机、钥匙、钱包、口罩',
    icon: 'home',
    trigger: {
      type: 'SCENE_CHANGE',
      leaveScene: 'HOME',
    },
    enabled: true,
    activeHours: {
      start: '06:00',
      end: '22:00',
    },
  },
  // 久坐提醒
  {
    id: 'sedentary_office',
    name: '办公久坐提醒',
    type: 'SEDENTARY',
    title: '🧘 该活动一下了',
    body: '您已经坐了一个小时，起来走动走动吧！',
    icon: 'activity',
    trigger: {
      type: 'DURATION',
      duration: 60,
    },
    enabled: true,
    repeat: {
      enabled: true,
      interval: 60,
    },
    applicableScenes: ['OFFICE', 'STUDY'],
  },
  // 学习久坐提醒
  {
    id: 'sedentary_study',
    name: '学习休息提醒',
    type: 'BREAK',
    title: '📚 学习休息时间',
    body: '您已专注学习45分钟，休息5-10分钟效果更好！',
    icon: 'book',
    trigger: {
      type: 'DURATION',
      duration: 45,
    },
    enabled: true,
    repeat: {
      enabled: true,
      interval: 50,
    },
    applicableScenes: ['STUDY'],
  },
  // 睡眠提醒
  {
    id: 'sleep_reminder',
    name: '睡眠提醒',
    type: 'SLEEP',
    title: '🌙 该休息了',
    body: '已经22:30了，准备休息保证充足睡眠吧！',
    icon: 'moon',
    trigger: {
      type: 'TIME',
      time: '22:30',
    },
    enabled: true,
  },
  // 周末睡眠提醒（稍晚）
  {
    id: 'sleep_reminder_weekend',
    name: '周末睡眠提醒',
    type: 'SLEEP',
    title: '🌙 周末也要早点休息',
    body: '已经23:00了，虽然是周末也要注意休息哦！',
    icon: 'moon',
    trigger: {
      type: 'TIME',
      time: '23:00',
    },
    enabled: true,
  },
  // 通勤准备提醒
  {
    id: 'commute_prep_morning',
    name: '早晨出门提醒',
    type: 'COMMUTE_PREP',
    title: '⏰ 准备出门',
    body: '再过15分钟就该出发了，准备好了吗？',
    icon: 'clock',
    trigger: {
      type: 'TIME',
      time: '08:00',
    },
    enabled: false,  // 需要用户手动启用并设置时间
  },
  // 喝水提醒
  {
    id: 'hydration_reminder',
    name: '喝水提醒',
    type: 'HYDRATION',
    title: '💧 该喝水了',
    body: '保持水分摄入，喝杯水吧！',
    icon: 'droplet',
    trigger: {
      type: 'DURATION',
      duration: 90,
    },
    enabled: false,  // 默认关闭
    repeat: {
      enabled: true,
      interval: 90,
      maxTimes: 8,
    },
    activeHours: {
      start: '08:00',
      end: '22:00',
    },
  },
];

// ==================== ProactiveReminder 类 ====================

export class ProactiveReminder {
  private settings: ReminderSettings = { ...DEFAULT_SETTINGS };
  private templates: Map<string, ReminderTemplate> = new Map();
  private activeReminders: Map<string, ActiveReminder> = new Map();
  private history: ReminderRecord[] = [];
  private initialized: boolean = false;
  private currentScene: SceneType = 'UNKNOWN';
  private sceneStartTime: number = Date.now();
  private durationCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 加载内置模板
    for (const template of BUILTIN_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * 初始化提醒引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadSettings();
      await this.loadActiveReminders();
      await this.setupNotificationChannel();
      this.startDurationCheck();
      this.initialized = true;
      console.log('[ProactiveReminder] Initialized');
    } catch (error) {
      console.error('[ProactiveReminder] Failed to initialize:', error);
    }
  }

  /**
   * 设置通知频道（Android）
   */
  private async setupNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('proactive_reminders', {
        name: '主动提醒',
        description: '场景相关的主动提醒',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        showBadge: true,
      });
    }
  }

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.REMINDER_SETTINGS);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[ProactiveReminder] Failed to load settings:', error);
    }
  }

  /**
   * 保存设置
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.REMINDER_SETTINGS,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('[ProactiveReminder] Failed to save settings:', error);
    }
  }

  /**
   * 加载活动提醒
   */
  private async loadActiveReminders(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_REMINDERS);
      if (stored) {
        const reminders: ActiveReminder[] = JSON.parse(stored);
        for (const reminder of reminders) {
          this.activeReminders.set(reminder.id, reminder);
        }
      }
    } catch (error) {
      console.error('[ProactiveReminder] Failed to load active reminders:', error);
    }
  }

  /**
   * 保存活动提醒
   */
  private async saveActiveReminders(): Promise<void> {
    try {
      const reminders = Array.from(this.activeReminders.values());
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_REMINDERS,
        JSON.stringify(reminders)
      );
    } catch (error) {
      console.error('[ProactiveReminder] Failed to save active reminders:', error);
    }
  }

  /**
   * 启动时长检查
   */
  private startDurationCheck(): void {
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
    }

    // 每分钟检查一次
    this.durationCheckInterval = setInterval(() => {
      this.checkDurationTriggers();
    }, 60 * 1000);
  }

  /**
   * 检查时长触发器
   */
  private checkDurationTriggers(): void {
    if (!this.settings.enabled || this.isInQuietHours()) return;

    const now = Date.now();
    const durationMinutes = Math.floor((now - this.sceneStartTime) / (60 * 1000));

    for (const [, template] of this.templates) {
      if (!template.enabled || template.trigger.type !== 'DURATION') continue;
      if (!this.settings.typeSettings[template.type]) continue;
      
      // 检查是否适用于当前场景
      if (template.applicableScenes && !template.applicableScenes.includes(this.currentScene)) {
        continue;
      }

      // 检查是否在生效时间段内
      if (template.activeHours && !this.isInActiveHours(template.activeHours)) {
        continue;
      }

      const triggerDuration = template.trigger.duration || 60;
      
      // 检查是否达到触发时长
      if (durationMinutes > 0 && durationMinutes % triggerDuration === 0) {
        this.triggerReminder(template);
      }
    }
  }

  /**
   * 检查是否在免打扰时间
   */
  private isInQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = this.settings.quietHours;
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * 检查是否在生效时间段
   */
  private isInActiveHours(hours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = hours;
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * 场景变化处理
   */
  async onSceneChange(oldScene: SceneType, newScene: SceneType): Promise<void> {
    await this.initialize();
    
    if (!this.settings.enabled || this.isInQuietHours()) return;

    // 更新当前场景和开始时间
    this.currentScene = newScene;
    this.sceneStartTime = Date.now();

    // 检查离开提醒
    for (const [, template] of this.templates) {
      if (!template.enabled) continue;
      if (!this.settings.typeSettings[template.type]) continue;
      
      if (template.trigger.type === 'SCENE_CHANGE') {
        // 检查离开触发
        if (template.trigger.leaveScene === oldScene) {
          if (template.activeHours && !this.isInActiveHours(template.activeHours)) {
            continue;
          }
          await this.triggerReminder(template);
        }
        // 检查进入触发
        else if (template.trigger.enterScene === newScene) {
          if (template.activeHours && !this.isInActiveHours(template.activeHours)) {
            continue;
          }
          await this.triggerReminder(template);
        }
      }
    }

    console.log(`[ProactiveReminder] Scene changed: ${oldScene} -> ${newScene}`);
  }

  /**
   * 触发提醒
   */
  private async triggerReminder(template: ReminderTemplate): Promise<void> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: template.title,
          body: template.body,
          data: {
            type: 'proactive_reminder',
            templateId: template.id,
            reminderType: template.type,
            timestamp: Date.now(),
          },
          sound: true,
        },
        trigger: null,  // 立即发送
      });

      // 记录历史
      const record: ReminderRecord = {
        id: `reminder_${Date.now()}`,
        templateId: template.id,
        type: template.type,
        triggeredAt: Date.now(),
      };
      this.history.push(record);
      
      // 保持最近100条记录
      if (this.history.length > 100) {
        this.history = this.history.slice(-100);
      }

      console.log(`[ProactiveReminder] Triggered: ${template.name} (${notificationId})`);
    } catch (error) {
      console.error('[ProactiveReminder] Failed to trigger reminder:', error);
    }
  }

  /**
   * 安排定时提醒
   */
  async scheduleTimeReminder(template: ReminderTemplate): Promise<string | null> {
    if (!template.trigger.time) return null;

    try {
      const [hours, minutes] = template.trigger.time.split(':').map(Number);
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);

      // 如果时间已过，安排明天
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: template.title,
          body: template.body,
          data: {
            type: 'proactive_reminder',
            templateId: template.id,
            reminderType: template.type,
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledTime,
        },
      });

      // 记录活动提醒
      const activeReminder: ActiveReminder = {
        id: `active_${Date.now()}`,
        templateId: template.id,
        scheduledAt: scheduledTime.getTime(),
        notificationId,
      };
      this.activeReminders.set(activeReminder.id, activeReminder);
      await this.saveActiveReminders();

      console.log(`[ProactiveReminder] Scheduled: ${template.name} at ${template.trigger.time}`);
      return notificationId;
    } catch (error) {
      console.error('[ProactiveReminder] Failed to schedule reminder:', error);
      return null;
    }
  }

  // ==================== 设置管理 ====================

  /**
   * 获取设置
   */
  getSettings(): ReminderSettings {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  async updateSettings(updates: Partial<ReminderSettings>): Promise<void> {
    await this.initialize();
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  /**
   * 设置免打扰时间
   */
  async setQuietHours(start: string, end: string, enabled: boolean = true): Promise<void> {
    await this.updateSettings({
      quietHours: { enabled, start, end },
    });
  }

  /**
   * 启用/禁用特定类型的提醒
   */
  async setTypeEnabled(type: ReminderType, enabled: boolean): Promise<void> {
    await this.initialize();
    this.settings.typeSettings[type] = enabled;
    await this.saveSettings();
  }

  /**
   * 设置久坐提醒间隔
   */
  async setSedentaryInterval(minutes: number): Promise<void> {
    await this.updateSettings({ sedentaryInterval: minutes });
    
    // 更新内置模板
    const sedentaryTemplate = this.templates.get('sedentary_office');
    if (sedentaryTemplate) {
      sedentaryTemplate.trigger.duration = minutes;
      if (sedentaryTemplate.repeat) {
        sedentaryTemplate.repeat.interval = minutes;
      }
    }
  }

  /**
   * 设置睡眠提醒时间
   */
  async setSleepReminderTime(time: string): Promise<void> {
    await this.updateSettings({ sleepReminderTime: time });
    
    // 更新内置模板
    const sleepTemplate = this.templates.get('sleep_reminder');
    if (sleepTemplate) {
      sleepTemplate.trigger.time = time;
      sleepTemplate.body = `已经${time}了，准备休息保证充足睡眠吧！`;
    }
  }

  // ==================== 模板管理 ====================

  /**
   * 获取所有模板
   */
  getTemplates(): ReminderTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 获取特定类型的模板
   */
  getTemplatesByType(type: ReminderType): ReminderTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.type === type);
  }

  /**
   * 获取模板
   */
  getTemplate(id: string): ReminderTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: ReminderTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 更新模板
   */
  updateTemplate(id: string, updates: Partial<ReminderTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) return false;
    
    this.templates.set(id, { ...template, ...updates });
    return true;
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * 启用/禁用模板
   */
  setTemplateEnabled(id: string, enabled: boolean): boolean {
    const template = this.templates.get(id);
    if (!template) return false;
    
    template.enabled = enabled;
    return true;
  }

  // ==================== 历史记录 ====================

  /**
   * 获取历史记录
   */
  getHistory(limit: number = 50): ReminderRecord[] {
    return this.history.slice(-limit);
  }

  /**
   * 记录用户操作
   */
  recordUserAction(recordId: string, action: 'VIEWED' | 'DISMISSED' | 'ACTED'): void {
    const record = this.history.find(r => r.id === recordId);
    if (record) {
      record.userAction = action;
      record.actionAt = Date.now();
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.history = [];
  }

  // ==================== 辅助方法 ====================

  /**
   * 取消所有活动提醒
   */
  async cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.activeReminders.clear();
    await this.saveActiveReminders();
    console.log('[ProactiveReminder] All reminders cancelled');
  }

  /**
   * 取消特定提醒
   */
  async cancelReminder(activeReminderId: string): Promise<void> {
    const reminder = this.activeReminders.get(activeReminderId);
    if (reminder?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    }
    this.activeReminders.delete(activeReminderId);
    await this.saveActiveReminders();
  }

  /**
   * 发送测试提醒
   */
  async sendTestReminder(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (template) {
      await this.triggerReminder(template);
    }
  }

  /**
   * 停止引擎
   */
  stop(): void {
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    this.initialized = false;
    console.log('[ProactiveReminder] Stopped');
  }
}

// ==================== 单例导出 ====================

export const proactiveReminder = new ProactiveReminder();

export default proactiveReminder;
