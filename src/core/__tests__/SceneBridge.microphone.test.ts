import sceneBridge from '../SceneBridge';
import type { AudioData } from '../../types';

jest.mock('react-native', () => ({
  NativeModules: {
    SceneBridge: {
      hasMicrophonePermission: jest.fn(),
      requestMicrophonePermission: jest.fn(),
      recordAudio: jest.fn(),
    },
  },
}));

describe('SceneBridge microphone', () => {
  const mockAudioData: AudioData = {
    base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
    duration: 1000,
    sampleRate: 16000,
    format: 'WAV',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks microphone permission through the native module', async () => {
    const mockHasPermission = require('react-native').NativeModules.SceneBridge.hasMicrophonePermission;
    mockHasPermission.mockResolvedValue(true);

    await expect(sceneBridge.hasMicrophonePermission()).resolves.toBe(true);
    expect(mockHasPermission).toHaveBeenCalledTimes(1);
  });

  it('requests microphone permission through the native module', async () => {
    const mockRequestPermission = require('react-native').NativeModules.SceneBridge.requestMicrophonePermission;
    mockRequestPermission.mockResolvedValue(true);

    await expect(sceneBridge.requestMicrophonePermission()).resolves.toBe(true);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('records audio when permission is already available', async () => {
    const nativeBridge = require('react-native').NativeModules.SceneBridge;
    nativeBridge.hasMicrophonePermission.mockResolvedValue(true);
    nativeBridge.recordAudio.mockResolvedValue(mockAudioData);

    await expect(sceneBridge.recordAudio(1000)).resolves.toEqual(mockAudioData);
    expect(nativeBridge.recordAudio).toHaveBeenCalledWith(1000);
  });

  it('requests permission once before recording when permission is denied', async () => {
    const nativeBridge = require('react-native').NativeModules.SceneBridge;
    nativeBridge.hasMicrophonePermission.mockResolvedValue(false);
    nativeBridge.requestMicrophonePermission.mockResolvedValue(true);
    nativeBridge.recordAudio.mockResolvedValue(mockAudioData);

    await expect(sceneBridge.recordAudio(1000)).resolves.toEqual(mockAudioData);
    expect(nativeBridge.requestMicrophonePermission).toHaveBeenCalledTimes(1);
    expect(nativeBridge.recordAudio).toHaveBeenCalledWith(1000);
  });

  it('rejects recording when permission remains denied', async () => {
    const nativeBridge = require('react-native').NativeModules.SceneBridge;
    nativeBridge.hasMicrophonePermission.mockResolvedValue(false);
    nativeBridge.requestMicrophonePermission.mockResolvedValue(false);

    await expect(sceneBridge.recordAudio(1000)).rejects.toThrow('Microphone permission not granted');
    expect(nativeBridge.recordAudio).not.toHaveBeenCalled();
  });

  it('propagates native recording errors after permission succeeds', async () => {
    const nativeBridge = require('react-native').NativeModules.SceneBridge;
    nativeBridge.hasMicrophonePermission.mockResolvedValue(true);
    nativeBridge.recordAudio.mockRejectedValue(new Error('Recording failed'));

    await expect(sceneBridge.recordAudio(1000)).rejects.toThrow('Recording failed');
  });

  it('uses the fallback shim when the native module is missing', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      NativeModules: {
        SceneBridge: null,
      },
    }));

    const { sceneBridge: fallbackBridge } = require('../SceneBridge');

    await expect(fallbackBridge.hasMicrophonePermission()).resolves.toBe(false);
    await expect(fallbackBridge.recordAudio(1000)).rejects.toThrow('Microphone permission not granted');
  });
});
