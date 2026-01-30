/**
 * VolumeKeyListener - 音量键双击监听器
 * 
 * 监听音量键双击事件，触发用户场景识别流程
 */

import { DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { sceneBridge, isSceneBridgeNative } from './SceneBridge';

export interface VolumeKeyEvent {
  trigger: string;
  timestamp: number;
}

export type VolumeKeyCallback = (event: VolumeKeyEvent) => void;

export class VolumeKeyListener {
  private subscription: EmitterSubscription | null = null;
  private callback: VolumeKeyCallback | null = null;
  private isEnabled: boolean = false;

  /**
   * 启用音量键双击监听
   * 
   * @param callback 双击事件回调函数
   */
  async enable(callback: VolumeKeyCallback): Promise<boolean> {
    try {
      console.log('启用音量键双击监听...');

      if (!isSceneBridgeNative) {
        console.warn('当前运行环境缺少原生 SceneBridge，已跳过音量键监听');
        return false;
      }
      
      // 如果已经启用，先禁用
      if (this.isEnabled) {
        await this.disable();
      }

      // 启用原生监听器
      const enabled = await sceneBridge.enableVolumeKeyListener();
      if (!enabled) {
        console.error('无法启用原生音量键监听器');
        return false;
      }

      // 设置事件监听
      this.subscription = DeviceEventEmitter.addListener(
        'onVolumeKeyDoubleTap',
        (event: VolumeKeyEvent) => {
          console.log('收到音量键双击事件:', event);
          if (this.callback) {
            this.callback(event);
          }
        }
      );

      this.callback = callback;
      this.isEnabled = true;

      console.log('音量键双击监听已启用');
      return true;

    } catch (error) {
      console.error('启用音量键监听失败:', error);
      return false;
    }
  }

  /**
   * 禁用音量键双击监听
   */
  async disable(): Promise<boolean> {
    try {
      console.log('禁用音量键双击监听...');

      if (!isSceneBridgeNative) {
        // 在无原生环境下只需要移除 JS 侧订阅
        if (this.subscription) {
          this.subscription.remove();
          this.subscription = null;
        }
        this.callback = null;
        this.isEnabled = false;
        return true;
      }

      // 移除事件监听
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      // 禁用原生监听器
      const disabled = await sceneBridge.disableVolumeKeyListener();
      if (!disabled) {
        console.warn('无法禁用原生音量键监听器');
      }

      this.callback = null;
      this.isEnabled = false;

      console.log('音量键双击监听已禁用');
      return true;

    } catch (error) {
      console.error('禁用音量键监听失败:', error);
      return false;
    }
  }

  /**
   * 检查是否已启用
   */
  isListening(): boolean {
    return this.isEnabled;
  }

  /**
   * 检查原生监听器状态
   */
  async checkNativeStatus(): Promise<boolean> {
    try {
      return await sceneBridge.isVolumeKeyListenerEnabled();
    } catch (error) {
      console.error('检查原生监听器状态失败:', error);
      return false;
    }
  }

  /**
   * 测试音量键双击功能
   */
  async test(): Promise<boolean> {
    try {
      console.log('测试音量键双击功能...');
      const result = await sceneBridge.testVolumeKeyDoubleTap();
      console.log('音量键双击测试结果:', result);
      return result;
    } catch (error) {
      console.error('音量键双击测试失败:', error);
      return false;
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    console.log('清理 VolumeKeyListener 资源...');
    this.disable().catch(error => {
      console.error('清理时禁用监听器失败:', error);
    });
  }
}

export default VolumeKeyListener;