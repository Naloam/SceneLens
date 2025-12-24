/**
 * VolumeKeyListener Tests
 */

import { VolumeKeyListener } from '../VolumeKeyListener';
import { sceneBridge } from '../SceneBridge';

// Mock the sceneBridge
jest.mock('../SceneBridge', () => ({
  sceneBridge: {
    enableVolumeKeyListener: jest.fn(),
    disableVolumeKeyListener: jest.fn(),
    isVolumeKeyListenerEnabled: jest.fn(),
    testVolumeKeyDoubleTap: jest.fn(),
  },
}));

// Mock DeviceEventEmitter
jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(),
  },
}));

import { DeviceEventEmitter } from 'react-native';

describe('VolumeKeyListener', () => {
  let volumeKeyListener: VolumeKeyListener;
  const mockCallback = jest.fn();
  const mockRemove = jest.fn();

  beforeEach(() => {
    volumeKeyListener = new VolumeKeyListener();
    jest.clearAllMocks();
    
    // Setup mock subscription
    (DeviceEventEmitter.addListener as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });
  });

  afterEach(() => {
    volumeKeyListener.cleanup();
  });

  describe('enable', () => {
    it('should enable volume key listener successfully', async () => {
      (sceneBridge.enableVolumeKeyListener as jest.Mock).mockResolvedValue(true);

      const result = await volumeKeyListener.enable(mockCallback);

      expect(result).toBe(true);
      expect(sceneBridge.enableVolumeKeyListener).toHaveBeenCalled();
      expect(DeviceEventEmitter.addListener).toHaveBeenCalledWith('onVolumeKeyDoubleTap', expect.any(Function));
      expect(volumeKeyListener.isListening()).toBe(true);
    });

    it('should handle native listener failure', async () => {
      (sceneBridge.enableVolumeKeyListener as jest.Mock).mockResolvedValue(false);

      const result = await volumeKeyListener.enable(mockCallback);

      expect(result).toBe(false);
      expect(volumeKeyListener.isListening()).toBe(false);
    });
  });

  describe('disable', () => {
    it('should disable volume key listener successfully', async () => {
      // First enable
      (sceneBridge.enableVolumeKeyListener as jest.Mock).mockResolvedValue(true);
      await volumeKeyListener.enable(mockCallback);

      // Then disable
      (sceneBridge.disableVolumeKeyListener as jest.Mock).mockResolvedValue(true);
      const result = await volumeKeyListener.disable();

      expect(result).toBe(true);
      expect(sceneBridge.disableVolumeKeyListener).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();
      expect(volumeKeyListener.isListening()).toBe(false);
    });
  });
});