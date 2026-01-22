import React from 'react';

// Mock React Native components
jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Alert: {
    alert: jest.fn(),
  },
  TextInput: 'TextInput',
  Switch: 'Switch',
}));

// Mock the dependencies
jest.mock('../../stores/geoFenceManager', () => ({
  geoFenceManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getGeoFencesByType: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../stores', () => ({
  useAppPreferenceStore: () => ({
    getTopAppsForCategory: jest.fn().mockReturnValue([]),
    getAppByPackageName: jest.fn().mockReturnValue(null),
    updatePreference: jest.fn(),
  }),
}));

jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    hasCalendarPermission: jest.fn().mockResolvedValue(false),
    requestCalendarPermission: jest.fn().mockResolvedValue(false),
    getCurrentLocation: jest.fn().mockResolvedValue({
      latitude: 39.9042,
      longitude: 116.4074,
      accuracy: 10,
      timestamp: Date.now(),
    }),
    getUpcomingEvents: jest.fn().mockResolvedValue([]),
  },
}));

import { MeetingConfigScreen } from '../MeetingConfigScreen';

describe('MeetingConfigScreen', () => {
  it('should be defined and exportable', () => {
    expect(MeetingConfigScreen).toBeDefined();
    expect(typeof MeetingConfigScreen).toBe('function');
  });

  it('should be a React component', () => {
    const component = React.createElement(MeetingConfigScreen);
    expect(component).toBeDefined();
    expect(component.type).toBe(MeetingConfigScreen);
  });
});