/**
 * ShortcutManager - 桌面快捷方式管理器
 * 
 * 管理桌面快捷方式的创建、删除和事件处理
 */

import { DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { sceneBridge, isSceneBridgeNative } from './SceneBridge';

export interface ShortcutEvent {
  trigger: 'desktop_shortcut';
  source: string;
  timestamp: number;
}

export type ShortcutEventCallback = (event: ShortcutEvent) => void;

export class ShortcutManager {
  private eventSubscription: EmitterSubscription | null = null;
  private eventCallback: ShortcutEventCallback | null = null;

  /**
   * 创建场景分析桌面快捷方式
   */
  async createSceneAnalysisShortcut(): Promise<boolean> {
    try {
      console.log('创建场景分析桌面快捷方式...');

      if (!isSceneBridgeNative) {
        console.warn('当前运行环境缺少原生 SceneBridge，跳过创建快捷方式');
        return false;
      }
      
      // 检查是否支持快捷方式
      const supported = await sceneBridge.isShortcutSupported();
      if (!supported) {
        console.warn('当前设备不支持动态快捷方式');
        // 仍然尝试创建，可能支持旧版本的快捷方式
      }
      
      const success = await sceneBridge.createSceneAnalysisShortcut();
      
      if (success) {
        console.log('桌面快捷方式创建成功');
      } else {
        console.error('桌面快捷方式创建失败');
      }
      
      return success;
    } catch (error) {
      console.error('创建桌面快捷方式时发生错误:', error);
      return false;
    }
  }

  /**
   * 删除场景分析桌面快捷方式
   */
  async removeSceneAnalysisShortcut(): Promise<boolean> {
    try {
      console.log('删除场景分析桌面快捷方式...');

      if (!isSceneBridgeNative) {
        return true; // 无原生实现时视为已移除
      }
      
      const success = await sceneBridge.removeSceneAnalysisShortcut();
      
      if (success) {
        console.log('桌面快捷方式删除成功');
      } else {
        console.error('桌面快捷方式删除失败');
      }
      
      return success;
    } catch (error) {
      console.error('删除桌面快捷方式时发生错误:', error);
      return false;
    }
  }

  /**
   * 检查是否支持快捷方式
   */
  async isShortcutSupported(): Promise<boolean> {
    try {
      if (!isSceneBridgeNative) {
        return false;
      }
      return await sceneBridge.isShortcutSupported();
    } catch (error) {
      console.error('检查快捷方式支持时发生错误:', error);
      return false;
    }
  }

  /**
   * 启用快捷方式事件监听
   * 
   * @param callback 快捷方式触发时的回调函数
   */
  enableShortcutListener(callback: ShortcutEventCallback): boolean {
    try {
      console.log('启用桌面快捷方式事件监听...');

      if (!isSceneBridgeNative) {
        console.warn('当前运行环境缺少原生 SceneBridge，已跳过快捷方式监听');
        return false;
      }
      
      // 如果已经有监听器，先清理
      this.disableShortcutListener();
      
      // 监听桌面快捷方式触发事件
      this.eventSubscription = DeviceEventEmitter.addListener(
        'onDesktopShortcutTrigger',
        (event: ShortcutEvent) => {
          console.log('桌面快捷方式触发事件:', event);
          
          if (this.eventCallback) {
            try {
              this.eventCallback(event);
            } catch (error) {
              console.error('处理快捷方式事件时发生错误:', error);
            }
          }
        }
      );
      
      this.eventCallback = callback;
      
      console.log('桌面快捷方式事件监听已启用');
      return true;
    } catch (error) {
      console.error('启用快捷方式事件监听失败:', error);
      return false;
    }
  }

  /**
   * 禁用快捷方式事件监听
   */
  disableShortcutListener(): boolean {
    try {
      console.log('禁用桌面快捷方式事件监听...');
      
      if (this.eventSubscription) {
        this.eventSubscription.remove();
        this.eventSubscription = null;
      }
      
      this.eventCallback = null;
      
      console.log('桌面快捷方式事件监听已禁用');
      return true;
    } catch (error) {
      console.error('禁用快捷方式事件监听失败:', error);
      return false;
    }
  }

  /**
   * 检查是否已启用事件监听
   */
  isShortcutListenerEnabled(): boolean {
    return this.eventSubscription !== null && this.eventCallback !== null;
  }

  /**
   * 获取快捷方式状态信息（用于调试）
   */
  async getShortcutInfo(): Promise<{
    supported: boolean;
    listenerEnabled: boolean;
  }> {
    try {
      const supported = await this.isShortcutSupported();
      const listenerEnabled = this.isShortcutListenerEnabled();
      
      return {
        supported,
        listenerEnabled,
      };
    } catch (error) {
      console.error('获取快捷方式信息失败:', error);
      return {
        supported: false,
        listenerEnabled: false,
      };
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    console.log('清理 ShortcutManager 资源...');
    this.disableShortcutListener();
  }
}

export default ShortcutManager;