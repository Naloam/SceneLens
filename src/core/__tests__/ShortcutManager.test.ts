/**
 * ShortcutManager 测试
 */

import { ShortcutManager } from '../ShortcutManager';
import { sceneBridge } from '../SceneBridge';

// Mock SceneBridge
jest.mock('../SceneBridge', () => ({
  sceneBridge: {
    createSceneAnalysisShortcut: jest.fn(),
    removeSceneAnalysisShortcut: jest.fn(),
    isShortcutSupported: jest.fn(),
  },
}));

// Mock DeviceEventEmitter
const mockAddListener = jest.fn();
const mockRemove = jest.fn();

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(),
  },
}));

describe('ShortcutManager', () => {
  let shortcutManager: ShortcutManager;
  const mockSceneBridge = sceneBridge as jest.Mocked<typeof sceneBridge>;

  beforeEach(() => {
    shortcutManager = new ShortcutManager();
    jest.clearAllMocks();
    
    // Setup mock subscription
    const { DeviceEventEmitter } = require('react-native');
    DeviceEventEmitter.addListener.mockReturnValue({
      remove: mockRemove,
    });
  });

  afterEach(() => {
    shortcutManager.cleanup();
  });

  describe('createSceneAnalysisShortcut', () => {
    it('should create shortcut successfully', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockResolvedValue(true);
      mockSceneBridge.createSceneAnalysisShortcut.mockResolvedValue(true);

      // Act
      const result = await shortcutManager.createSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(true);
      expect(mockSceneBridge.isShortcutSupported).toHaveBeenCalled();
      expect(mockSceneBridge.createSceneAnalysisShortcut).toHaveBeenCalled();
    });

    it('should handle creation failure', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockResolvedValue(true);
      mockSceneBridge.createSceneAnalysisShortcut.mockResolvedValue(false);

      // Act
      const result = await shortcutManager.createSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockRejectedValue(new Error('Test error'));

      // Act
      const result = await shortcutManager.createSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(false);
    });

    it('should work even when shortcuts are not supported', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockResolvedValue(false);
      mockSceneBridge.createSceneAnalysisShortcut.mockResolvedValue(true);

      // Act
      const result = await shortcutManager.createSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(true);
      expect(mockSceneBridge.createSceneAnalysisShortcut).toHaveBeenCalled();
    });
  });

  describe('removeSceneAnalysisShortcut', () => {
    it('should remove shortcut successfully', async () => {
      // Arrange
      mockSceneBridge.removeSceneAnalysisShortcut.mockResolvedValue(true);

      // Act
      const result = await shortcutManager.removeSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(true);
      expect(mockSceneBridge.removeSceneAnalysisShortcut).toHaveBeenCalled();
    });

    it('should handle removal failure', async () => {
      // Arrange
      mockSceneBridge.removeSceneAnalysisShortcut.mockResolvedValue(false);

      // Act
      const result = await shortcutManager.removeSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockSceneBridge.removeSceneAnalysisShortcut.mockRejectedValue(new Error('Test error'));

      // Act
      const result = await shortcutManager.removeSceneAnalysisShortcut();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isShortcutSupported', () => {
    it('should return support status', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockResolvedValue(true);

      // Act
      const result = await shortcutManager.isShortcutSupported();

      // Assert
      expect(result).toBe(true);
      expect(mockSceneBridge.isShortcutSupported).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockRejectedValue(new Error('Test error'));

      // Act
      const result = await shortcutManager.isShortcutSupported();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('enableShortcutListener', () => {
    it('should enable event listener successfully', () => {
      // Arrange
      const mockCallback = jest.fn();
      const { DeviceEventEmitter } = require('react-native');

      // Act
      const result = shortcutManager.enableShortcutListener(mockCallback);

      // Assert
      expect(result).toBe(true);
      expect(DeviceEventEmitter.addListener).toHaveBeenCalledWith(
        'onDesktopShortcutTrigger',
        expect.any(Function)
      );
      expect(shortcutManager.isShortcutListenerEnabled()).toBe(true);
    });

    it('should handle event when triggered', () => {
      // Arrange
      const mockCallback = jest.fn();
      let eventHandler: (event: any) => void;
      const { DeviceEventEmitter } = require('react-native');
      
      DeviceEventEmitter.addListener.mockImplementation((eventName: string, handler: any) => {
        eventHandler = handler;
        return { remove: mockRemove };
      });

      // Act
      shortcutManager.enableShortcutListener(mockCallback);
      
      const testEvent = {
        trigger: 'desktop_shortcut',
        source: 'test',
        timestamp: Date.now(),
      };
      
      eventHandler!(testEvent);

      // Assert
      expect(mockCallback).toHaveBeenCalledWith(testEvent);
    });

    it('should replace existing listener', () => {
      // Arrange
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      const { DeviceEventEmitter } = require('react-native');

      // Act
      shortcutManager.enableShortcutListener(mockCallback1);
      shortcutManager.enableShortcutListener(mockCallback2);

      // Assert
      expect(mockRemove).toHaveBeenCalled();
      expect(DeviceEventEmitter.addListener).toHaveBeenCalledTimes(2);
    });

    it('should handle callback errors gracefully', () => {
      // Arrange
      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      
      let eventHandler: (event: any) => void;
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.addListener.mockImplementation((eventName: string, handler: any) => {
        eventHandler = handler;
        return { remove: mockRemove };
      });

      // Act
      shortcutManager.enableShortcutListener(mockCallback);
      
      const testEvent = {
        trigger: 'desktop_shortcut',
        source: 'test',
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => eventHandler!(testEvent)).not.toThrow();
    });
  });

  describe('disableShortcutListener', () => {
    it('should disable event listener successfully', () => {
      // Arrange
      const mockCallback = jest.fn();
      shortcutManager.enableShortcutListener(mockCallback);

      // Act
      const result = shortcutManager.disableShortcutListener();

      // Assert
      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalled();
      expect(shortcutManager.isShortcutListenerEnabled()).toBe(false);
    });

    it('should handle disabling when no listener is active', () => {
      // Act
      const result = shortcutManager.disableShortcutListener();

      // Assert
      expect(result).toBe(true);
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe('getShortcutInfo', () => {
    it('should return shortcut information', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockResolvedValue(true);
      const mockCallback = jest.fn();
      shortcutManager.enableShortcutListener(mockCallback);

      // Act
      const info = await shortcutManager.getShortcutInfo();

      // Assert
      expect(info).toEqual({
        supported: true,
        listenerEnabled: true,
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockSceneBridge.isShortcutSupported.mockRejectedValue(new Error('Test error'));

      // Act
      const info = await shortcutManager.getShortcutInfo();

      // Assert
      expect(info).toEqual({
        supported: false,
        listenerEnabled: false,
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      // Arrange
      const mockCallback = jest.fn();
      shortcutManager.enableShortcutListener(mockCallback);

      // Act
      shortcutManager.cleanup();

      // Assert
      expect(mockRemove).toHaveBeenCalled();
      expect(shortcutManager.isShortcutListenerEnabled()).toBe(false);
    });

    it('should handle cleanup when no resources are active', () => {
      // Act & Assert - should not throw
      expect(() => shortcutManager.cleanup()).not.toThrow();
    });
  });
});