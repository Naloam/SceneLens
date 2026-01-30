/**
 * PermissionManager.ts
 * 统一的 Android 权限管理器
 * 
 * 功能：
 * 1. 管理所有运行时权限的请求和检查
 * 2. 处理特殊权限（系统设置、勿扰模式等）
 * 3. 提供权限状态监听
 * 4. 跟踪被永久拒绝的权限
 */

import { Platform, Linking, Alert, NativeModules, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== 类型定义 ====================

/**
 * 权限类型
 */
export enum PermissionType {
  /** 精确位置 */
  LOCATION_FINE = 'location_fine',
  /** 粗略位置 */
  LOCATION_COARSE = 'location_coarse',
  /** 后台位置 */
  LOCATION_BACKGROUND = 'location_background',
  /** 日历读取 */
  CALENDAR_READ = 'calendar_read',
  /** 日历写入 */
  CALENDAR_WRITE = 'calendar_write',
  /** 活动识别 */
  ACTIVITY_RECOGNITION = 'activity_recognition',
  /** 修改系统设置 */
  WRITE_SETTINGS = 'write_settings',
  /** 通知策略（勿扰模式） */
  NOTIFICATION_POLICY = 'notification_policy',
  /** 使用情况访问 */
  USAGE_STATS = 'usage_stats',
  /** 通知权限 */
  NOTIFICATIONS = 'notifications',
  /** 麦克风 */
  MICROPHONE = 'microphone',
  /** 相机 */
  CAMERA = 'camera',
  /** 存储读取 */
  STORAGE_READ = 'storage_read',
  /** 存储写入 */
  STORAGE_WRITE = 'storage_write',
}

/**
 * 权限状态
 */
export enum PermissionStatus {
  /** 已授权 */
  GRANTED = 'granted',
  /** 已拒绝 */
  DENIED = 'denied',
  /** 从未请求过 */
  UNDETERMINED = 'undetermined',
  /** 被永久拒绝（用户选择"不再询问"） */
  PERMANENTLY_DENIED = 'permanently_denied',
  /** 需要到设置中手动开启 */
  REQUIRES_SETTINGS = 'requires_settings',
  /** 不可用（设备不支持） */
  UNAVAILABLE = 'unavailable',
}

/**
 * 权限组
 */
export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: PermissionType[];
  required: boolean;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  permission: PermissionType;
  status: PermissionStatus;
  canRequest: boolean;
}

/**
 * 批量权限请求结果
 */
export interface BatchPermissionResult {
  allGranted: boolean;
  results: Map<PermissionType, PermissionStatus>;
  deniedPermissions: PermissionType[];
  permanentlyDeniedPermissions: PermissionType[];
}

// ==================== 常量定义 ====================

const STORAGE_KEY_DENIED = '@scenelens/permissions_denied';
const STORAGE_KEY_REQUEST_COUNT = '@scenelens/permissions_request_count';

/**
 * 权限到 Android 权限字符串的映射
 */
const PERMISSION_ANDROID_MAP: Record<PermissionType, string | null> = {
  [PermissionType.LOCATION_FINE]: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  [PermissionType.LOCATION_COARSE]: PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  [PermissionType.LOCATION_BACKGROUND]: 'android.permission.ACCESS_BACKGROUND_LOCATION',
  [PermissionType.CALENDAR_READ]: PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
  [PermissionType.CALENDAR_WRITE]: PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
  [PermissionType.ACTIVITY_RECOGNITION]: 'android.permission.ACTIVITY_RECOGNITION',
  [PermissionType.WRITE_SETTINGS]: null, // 特殊权限，需要跳转设置
  [PermissionType.NOTIFICATION_POLICY]: null, // 特殊权限，需要跳转设置
  [PermissionType.USAGE_STATS]: null, // 特殊权限，需要跳转设置
  [PermissionType.NOTIFICATIONS]: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  [PermissionType.MICROPHONE]: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  [PermissionType.CAMERA]: PermissionsAndroid.PERMISSIONS.CAMERA,
  [PermissionType.STORAGE_READ]: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  [PermissionType.STORAGE_WRITE]: PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
};

/**
 * 特殊权限列表（需要跳转到系统设置）
 */
const SPECIAL_PERMISSIONS: PermissionType[] = [
  PermissionType.WRITE_SETTINGS,
  PermissionType.NOTIFICATION_POLICY,
  PermissionType.USAGE_STATS,
];

/**
 * 权限分组定义
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'location',
    name: '位置信息',
    description: '用于检测您的位置，实现到家/离家场景识别',
    icon: 'map-marker',
    permissions: [PermissionType.LOCATION_FINE, PermissionType.LOCATION_COARSE],
    required: true,
  },
  {
    id: 'calendar',
    name: '日历访问',
    description: '用于读取日程安排，在会议前自动调整手机设置',
    icon: 'calendar',
    permissions: [PermissionType.CALENDAR_READ],
    required: false,
  },
  {
    id: 'activity',
    name: '活动识别',
    description: '用于检测步行、骑行、驾驶等活动状态',
    icon: 'walk',
    permissions: [PermissionType.ACTIVITY_RECOGNITION],
    required: false,
  },
  {
    id: 'system',
    name: '系统设置',
    description: '用于自动调整音量、亮度等系统设置',
    icon: 'cog',
    permissions: [PermissionType.WRITE_SETTINGS],
    required: true,
  },
  {
    id: 'dnd',
    name: '勿扰模式',
    description: '用于自动开启/关闭勿扰模式',
    icon: 'bell-off',
    permissions: [PermissionType.NOTIFICATION_POLICY],
    required: false,
  },
  {
    id: 'notifications',
    name: '通知权限',
    description: '用于显示智能提醒和场景切换通知',
    icon: 'bell',
    permissions: [PermissionType.NOTIFICATIONS],
    required: true,
  },
];

// ==================== Native Module 接口 ====================

const { SystemSettingsModule } = NativeModules;

// ==================== 主类实现 ====================

/**
 * 权限管理器
 */
export class PermissionManager {
  private permanentlyDenied: Set<PermissionType> = new Set();
  private requestCounts: Map<PermissionType, number> = new Map();
  private initialized: boolean = false;

  /**
   * 初始化权限管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 从存储加载永久拒绝的权限
      const deniedJson = await AsyncStorage.getItem(STORAGE_KEY_DENIED);
      if (deniedJson) {
        const deniedArray = JSON.parse(deniedJson) as PermissionType[];
        this.permanentlyDenied = new Set(deniedArray);
      }

      // 加载请求次数
      const countJson = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT);
      if (countJson) {
        const countObj = JSON.parse(countJson) as Record<string, number>;
        this.requestCounts = new Map(Object.entries(countObj) as [PermissionType, number][]);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[PermissionManager] 初始化失败:', error);
    }
  }

  /**
   * 保存状态到存储
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_DENIED,
        JSON.stringify(Array.from(this.permanentlyDenied))
      );
      await AsyncStorage.setItem(
        STORAGE_KEY_REQUEST_COUNT,
        JSON.stringify(Object.fromEntries(this.requestCounts))
      );
    } catch (error) {
      console.error('[PermissionManager] 保存状态失败:', error);
    }
  }

  /**
   * 检查单个权限状态
   */
  async checkPermission(permission: PermissionType): Promise<PermissionCheckResult> {
    if (Platform.OS !== 'android') {
      return {
        permission,
        status: PermissionStatus.UNAVAILABLE,
        canRequest: false,
      };
    }

    await this.initialize();

    // 检查是否是特殊权限
    if (SPECIAL_PERMISSIONS.includes(permission)) {
      return this.checkSpecialPermission(permission);
    }

    // 检查是否已永久拒绝
    if (this.permanentlyDenied.has(permission)) {
      return {
        permission,
        status: PermissionStatus.PERMANENTLY_DENIED,
        canRequest: false,
      };
    }

    // 检查普通权限
    const androidPermission = PERMISSION_ANDROID_MAP[permission];
    if (!androidPermission) {
      return {
        permission,
        status: PermissionStatus.UNAVAILABLE,
        canRequest: false,
      };
    }

    try {
      const granted = await PermissionsAndroid.check(androidPermission as any);
      return {
        permission,
        status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
        canRequest: !granted,
      };
    } catch (error) {
      console.error(`[PermissionManager] 检查权限失败 ${permission}:`, error);
      return {
        permission,
        status: PermissionStatus.UNDETERMINED,
        canRequest: true,
      };
    }
  }

  /**
   * 检查特殊权限
   */
  private async checkSpecialPermission(permission: PermissionType): Promise<PermissionCheckResult> {
    try {
      let granted = false;

      switch (permission) {
        case PermissionType.WRITE_SETTINGS:
          if (SystemSettingsModule?.canWriteSettings) {
            granted = await SystemSettingsModule.canWriteSettings();
          }
          break;

        case PermissionType.NOTIFICATION_POLICY:
          if (SystemSettingsModule?.isNotificationPolicyAccessGranted) {
            granted = await SystemSettingsModule.isNotificationPolicyAccessGranted();
          }
          break;

        case PermissionType.USAGE_STATS:
          if (SystemSettingsModule?.hasUsageStatsPermission) {
            granted = await SystemSettingsModule.hasUsageStatsPermission();
          }
          break;
      }

      return {
        permission,
        status: granted ? PermissionStatus.GRANTED : PermissionStatus.REQUIRES_SETTINGS,
        canRequest: !granted,
      };
    } catch (error) {
      console.error(`[PermissionManager] 检查特殊权限失败 ${permission}:`, error);
      return {
        permission,
        status: PermissionStatus.UNDETERMINED,
        canRequest: true,
      };
    }
  }

  /**
   * 请求单个权限
   */
  async requestPermission(permission: PermissionType): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return PermissionStatus.UNAVAILABLE;
    }

    await this.initialize();

    // 特殊权限需要跳转设置
    if (SPECIAL_PERMISSIONS.includes(permission)) {
      return this.requestSpecialPermission(permission);
    }

    // 检查是否已永久拒绝
    if (this.permanentlyDenied.has(permission)) {
      return PermissionStatus.PERMANENTLY_DENIED;
    }

    const androidPermission = PERMISSION_ANDROID_MAP[permission];
    if (!androidPermission) {
      return PermissionStatus.UNAVAILABLE;
    }

    try {
      // 增加请求计数
      const currentCount = this.requestCounts.get(permission) || 0;
      this.requestCounts.set(permission, currentCount + 1);

      const result = await PermissionsAndroid.request(androidPermission as any, {
        title: this.getPermissionTitle(permission),
        message: this.getPermissionMessage(permission),
        buttonPositive: '允许',
        buttonNegative: '拒绝',
        buttonNeutral: '稍后询问',
      });

      let status: PermissionStatus;

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        status = PermissionStatus.GRANTED;
        // 如果之前被标记为永久拒绝，移除标记
        this.permanentlyDenied.delete(permission);
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        status = PermissionStatus.PERMANENTLY_DENIED;
        this.permanentlyDenied.add(permission);
      } else {
        status = PermissionStatus.DENIED;
        // 如果多次拒绝，可能需要引导到设置
        if (currentCount >= 2) {
          this.permanentlyDenied.add(permission);
          status = PermissionStatus.PERMANENTLY_DENIED;
        }
      }

      await this.saveState();
      return status;
    } catch (error) {
      console.error(`[PermissionManager] 请求权限失败 ${permission}:`, error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * 请求特殊权限（跳转到系统设置）
   */
  private async requestSpecialPermission(permission: PermissionType): Promise<PermissionStatus> {
    try {
      switch (permission) {
        case PermissionType.WRITE_SETTINGS:
          if (SystemSettingsModule?.openWriteSettings) {
            await SystemSettingsModule.openWriteSettings();
          } else {
            await Linking.openSettings();
          }
          break;

        case PermissionType.NOTIFICATION_POLICY:
          if (SystemSettingsModule?.openNotificationPolicySettings) {
            await SystemSettingsModule.openNotificationPolicySettings();
          } else {
            await Linking.openSettings();
          }
          break;

        case PermissionType.USAGE_STATS:
          if (SystemSettingsModule?.openUsageAccessSettings) {
            await SystemSettingsModule.openUsageAccessSettings();
          } else {
            await Linking.openSettings();
          }
          break;

        default:
          await Linking.openSettings();
      }

      // 返回需要设置状态，用户需要手动操作
      return PermissionStatus.REQUIRES_SETTINGS;
    } catch (error) {
      console.error(`[PermissionManager] 打开设置失败 ${permission}:`, error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * 批量检查权限
   */
  async checkPermissions(permissions: PermissionType[]): Promise<Map<PermissionType, PermissionCheckResult>> {
    const results = new Map<PermissionType, PermissionCheckResult>();

    await Promise.all(
      permissions.map(async (permission) => {
        const result = await this.checkPermission(permission);
        results.set(permission, result);
      })
    );

    return results;
  }

  /**
   * 批量请求权限
   */
  async requestPermissions(permissions: PermissionType[]): Promise<BatchPermissionResult> {
    const results = new Map<PermissionType, PermissionStatus>();
    const deniedPermissions: PermissionType[] = [];
    const permanentlyDeniedPermissions: PermissionType[] = [];

    for (const permission of permissions) {
      const status = await this.requestPermission(permission);
      results.set(permission, status);

      if (status === PermissionStatus.DENIED) {
        deniedPermissions.push(permission);
      } else if (status === PermissionStatus.PERMANENTLY_DENIED) {
        permanentlyDeniedPermissions.push(permission);
      }
    }

    return {
      allGranted: deniedPermissions.length === 0 && permanentlyDeniedPermissions.length === 0,
      results,
      deniedPermissions,
      permanentlyDeniedPermissions,
    };
  }

  /**
   * 检查权限组
   */
  async checkPermissionGroup(groupId: string): Promise<{
    allGranted: boolean;
    results: Map<PermissionType, PermissionCheckResult>;
  }> {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) {
      return { allGranted: false, results: new Map() };
    }

    const results = await this.checkPermissions(group.permissions);
    const allGranted = Array.from(results.values()).every(
      r => r.status === PermissionStatus.GRANTED
    );

    return { allGranted, results };
  }

  /**
   * 请求权限组
   */
  async requestPermissionGroup(groupId: string): Promise<BatchPermissionResult> {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) {
      return {
        allGranted: false,
        results: new Map(),
        deniedPermissions: [],
        permanentlyDeniedPermissions: [],
      };
    }

    return this.requestPermissions(group.permissions);
  }

  /**
   * 检查所有必需权限
   */
  async checkRequiredPermissions(): Promise<{
    allGranted: boolean;
    missingPermissions: PermissionType[];
  }> {
    const requiredGroups = PERMISSION_GROUPS.filter(g => g.required);
    const allPermissions = requiredGroups.flatMap(g => g.permissions);
    
    const results = await this.checkPermissions(allPermissions);
    const missingPermissions = Array.from(results.entries())
      .filter(([_, result]) => result.status !== PermissionStatus.GRANTED)
      .map(([permission]) => permission);

    return {
      allGranted: missingPermissions.length === 0,
      missingPermissions,
    };
  }

  /**
   * 请求所有必需权限
   */
  async requestRequiredPermissions(): Promise<BatchPermissionResult> {
    const requiredGroups = PERMISSION_GROUPS.filter(g => g.required);
    const allPermissions = requiredGroups.flatMap(g => g.permissions);
    
    return this.requestPermissions(allPermissions);
  }

  /**
   * 打开应用设置页面
   */
  async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('[PermissionManager] 打开应用设置失败:', error);
      Alert.alert(
        '无法打开设置',
        '请手动前往系统设置 > 应用 > SceneLens 管理权限'
      );
    }
  }

  /**
   * 打开特定设置页面
   */
  async openSpecificSettings(permission: PermissionType): Promise<void> {
    switch (permission) {
      case PermissionType.WRITE_SETTINGS:
        if (SystemSettingsModule?.openWriteSettings) {
          await SystemSettingsModule.openWriteSettings();
        } else {
          await this.openAppSettings();
        }
        break;

      case PermissionType.NOTIFICATION_POLICY:
        if (SystemSettingsModule?.openNotificationPolicySettings) {
          await SystemSettingsModule.openNotificationPolicySettings();
        } else {
          await this.openAppSettings();
        }
        break;

      case PermissionType.USAGE_STATS:
        if (SystemSettingsModule?.openUsageAccessSettings) {
          await SystemSettingsModule.openUsageAccessSettings();
        } else {
          await this.openAppSettings();
        }
        break;

      case PermissionType.NOTIFICATIONS:
        if (SystemSettingsModule?.openNotificationSettings) {
          await SystemSettingsModule.openNotificationSettings();
        } else {
          await this.openAppSettings();
        }
        break;

      default:
        await this.openAppSettings();
    }
  }

  /**
   * 显示权限说明对话框
   */
  showPermissionRationale(
    permission: PermissionType,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    const title = this.getPermissionTitle(permission);
    const message = this.getPermissionMessage(permission);

    Alert.alert(
      title,
      message,
      [
        {
          text: '稍后再说',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: '去授权',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  }

  /**
   * 显示需要去设置页面的对话框
   */
  showSettingsDialog(
    permission: PermissionType,
    onOpenSettings: () => void,
    onCancel?: () => void
  ): void {
    const title = this.getPermissionTitle(permission);

    Alert.alert(
      `需要${title}`,
      `此功能需要${title}。您之前拒绝了该权限，请前往设置手动开启。`,
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: '前往设置',
          onPress: onOpenSettings,
        },
      ],
      { cancelable: true }
    );
  }

  /**
   * 获取权限的用户友好名称
   */
  getPermissionTitle(permission: PermissionType): string {
    const titles: Record<PermissionType, string> = {
      [PermissionType.LOCATION_FINE]: '精确位置',
      [PermissionType.LOCATION_COARSE]: '大致位置',
      [PermissionType.LOCATION_BACKGROUND]: '后台位置',
      [PermissionType.CALENDAR_READ]: '日历读取',
      [PermissionType.CALENDAR_WRITE]: '日历写入',
      [PermissionType.ACTIVITY_RECOGNITION]: '活动识别',
      [PermissionType.WRITE_SETTINGS]: '修改系统设置',
      [PermissionType.NOTIFICATION_POLICY]: '勿扰模式控制',
      [PermissionType.USAGE_STATS]: '使用情况访问',
      [PermissionType.NOTIFICATIONS]: '通知',
      [PermissionType.MICROPHONE]: '麦克风',
      [PermissionType.CAMERA]: '相机',
      [PermissionType.STORAGE_READ]: '存储读取',
      [PermissionType.STORAGE_WRITE]: '存储写入',
    };
    return titles[permission] || '未知权限';
  }

  /**
   * 获取权限的详细说明
   */
  getPermissionMessage(permission: PermissionType): string {
    const messages: Record<PermissionType, string> = {
      [PermissionType.LOCATION_FINE]: 'SceneLens 需要访问您的精确位置，以便在您到家、到公司等场景时自动执行相应操作。',
      [PermissionType.LOCATION_COARSE]: 'SceneLens 需要访问您的大致位置，以便识别您所处的区域。',
      [PermissionType.LOCATION_BACKGROUND]: 'SceneLens 需要在后台访问位置，以便在您移动时持续检测场景变化。',
      [PermissionType.CALENDAR_READ]: 'SceneLens 需要读取您的日历，以便在会议开始前自动调整手机设置。',
      [PermissionType.CALENDAR_WRITE]: 'SceneLens 需要写入日历权限，以便创建自动化提醒。',
      [PermissionType.ACTIVITY_RECOGNITION]: 'SceneLens 需要识别您的活动状态（如步行、骑行、驾驶），以提供相应的智能建议。',
      [PermissionType.WRITE_SETTINGS]: 'SceneLens 需要修改系统设置的权限，以便自动调整音量和亮度。',
      [PermissionType.NOTIFICATION_POLICY]: 'SceneLens 需要控制勿扰模式的权限，以便在特定场景自动开启或关闭勿扰。',
      [PermissionType.USAGE_STATS]: 'SceneLens 需要访问应用使用情况，以便学习您的应用使用习惯并提供个性化建议。',
      [PermissionType.NOTIFICATIONS]: 'SceneLens 需要通知权限，以便在场景切换时向您发送提醒。',
      [PermissionType.MICROPHONE]: 'SceneLens 需要麦克风权限，以便检测环境音量。',
      [PermissionType.CAMERA]: 'SceneLens 需要相机权限，以便扫描二维码或进行场景识别。',
      [PermissionType.STORAGE_READ]: 'SceneLens 需要读取存储权限，以便访问本地数据。',
      [PermissionType.STORAGE_WRITE]: 'SceneLens 需要写入存储权限，以便保存数据。',
    };
    return messages[permission] || '此应用需要该权限才能正常工作。';
  }

  /**
   * 获取权限状态的显示文本
   */
  getStatusText(status: PermissionStatus): string {
    const texts: Record<PermissionStatus, string> = {
      [PermissionStatus.GRANTED]: '已授权',
      [PermissionStatus.DENIED]: '已拒绝',
      [PermissionStatus.UNDETERMINED]: '未请求',
      [PermissionStatus.PERMANENTLY_DENIED]: '永久拒绝',
      [PermissionStatus.REQUIRES_SETTINGS]: '需要设置',
      [PermissionStatus.UNAVAILABLE]: '不可用',
    };
    return texts[status] || '未知';
  }

  /**
   * 获取权限状态的颜色
   */
  getStatusColor(status: PermissionStatus): string {
    const colors: Record<PermissionStatus, string> = {
      [PermissionStatus.GRANTED]: '#4CAF50',
      [PermissionStatus.DENIED]: '#FF9800',
      [PermissionStatus.UNDETERMINED]: '#9E9E9E',
      [PermissionStatus.PERMANENTLY_DENIED]: '#F44336',
      [PermissionStatus.REQUIRES_SETTINGS]: '#2196F3',
      [PermissionStatus.UNAVAILABLE]: '#9E9E9E',
    };
    return colors[status] || '#9E9E9E';
  }

  /**
   * 重置永久拒绝状态（用于测试或用户从设置中重新授权后）
   */
  async resetPermanentlyDenied(permission?: PermissionType): Promise<void> {
    if (permission) {
      this.permanentlyDenied.delete(permission);
    } else {
      this.permanentlyDenied.clear();
    }
    await this.saveState();
  }

  /**
   * 获取所有权限组的状态
   */
  async getAllGroupsStatus(): Promise<Map<string, {
    group: PermissionGroup;
    allGranted: boolean;
    results: Map<PermissionType, PermissionCheckResult>;
  }>> {
    const groupsStatus = new Map();

    for (const group of PERMISSION_GROUPS) {
      const { allGranted, results } = await this.checkPermissionGroup(group.id);
      groupsStatus.set(group.id, { group, allGranted, results });
    }

    return groupsStatus;
  }
}

// ==================== 导出单例实例 ====================

export const permissionManager = new PermissionManager();

export default PermissionManager;
