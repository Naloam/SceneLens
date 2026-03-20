import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import {
  HomeScreen,
  SceneConfigScreen,
  PermissionGuideScreen,
  MeetingConfigScreen,
  StatsScreen,
  SettingsScreen,
  NotificationFilterScreen,
  RuleEditorScreen,
  PermissionsScreen,
} from './src/screens';
import LocationConfigScreen from './src/screens/LocationConfigScreen';
import { backgroundService } from './src/background';
import { useSettingsStore, themeColors } from './src/stores/settingsStore';

export type RootStackParamList = {
  Home: undefined;
  SceneConfig: undefined;
  PermissionGuide: undefined;
  MeetingConfig: undefined;
  LocationConfig: undefined;
  Stats: undefined;
  Settings: undefined;
  NotificationFilter: undefined;
  RuleEditor: undefined;
  Permissions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { settings, isLoading, loadSettings } = useSettingsStore();
  const [backgroundServiceReady, setBackgroundServiceReady] = useState(false);

  const theme = useMemo(() => {
    const baseTheme = settings.darkMode ? MD3DarkTheme : MD3LightTheme;
    const colorScheme = themeColors[settings.themeColor];
    
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colorScheme.primary,
        secondary: settings.darkMode ? colorScheme.light : colorScheme.dark,
        tertiary: '#7D5260',
        background: settings.darkMode ? '#121212' : '#FFFBFE',
        surface: settings.darkMode ? '#1E1E1E' : '#FFFBFE',
        surfaceVariant: settings.darkMode ? '#49454F' : '#E7E0EC',
        onPrimary: '#FFFFFF',
        onSecondary: '#FFFFFF',
        onBackground: settings.darkMode ? '#E6E1E5' : '#1C1B1F',
        onSurface: settings.darkMode ? '#E6E1E5' : '#1C1B1F',
        onSurfaceVariant: settings.darkMode ? '#CAC4D0' : '#49454F',
        error: '#B3261E',
        onError: '#FFFFFF',
      },
    };
  }, [settings.darkMode, settings.themeColor]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initBackgroundService = async () => {
      try {
        await backgroundService.initialize();
        if (isMounted) {
          setBackgroundServiceReady(true);
        }
        console.log('[App] Background service initialized');
      } catch (error) {
        console.error('[App] Failed to initialize background service:', error);
      }
    };

    void initBackgroundService();

    // 清理
    return () => {
      isMounted = false;
      backgroundService.destroy();
    };
  }, []);

  useEffect(() => {
    if (!backgroundServiceReady || isLoading) {
      return;
    }

    backgroundService.updateConfig({
      detectionIntervalMs: settings.detectionInterval * 60 * 1000,
      minDetectionIntervalMs: Math.max(settings.detectionInterval, 15) * 60 * 1000,
    });

    if (settings.autoDetectionEnabled) {
      backgroundService.start();
    } else {
      backgroundService.stop();
    }
  }, [
    backgroundServiceReady,
    isLoading,
    settings.autoDetectionEnabled,
    settings.detectionInterval,
  ]);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: 'SceneLens',
              headerRight: () => (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Text style={styles.headerButtonText}>⚙️</Text>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="SceneConfig"
            component={SceneConfigScreen}
            options={{
              title: '场景配置',
            }}
          />
          <Stack.Screen
            name="PermissionGuide"
            component={PermissionGuideScreen}
            options={{
              title: '权限管理',
            }}
          />
          <Stack.Screen
            name="MeetingConfig"
            component={MeetingConfigScreen}
            options={{
              title: '会议场景配置',
            }}
          />
          <Stack.Screen
            name="LocationConfig"
            component={LocationConfigScreen}
            options={{
              title: '位置配置',
            }}
          />
          <Stack.Screen
            name="Stats"
            component={StatsScreen}
            options={{
              title: '数据统计',
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: '设置',
            }}
          />
          <Stack.Screen
            name="NotificationFilter"
            component={NotificationFilterScreen}
            options={{
              title: '智能通知过滤',
            }}
          />
          <Stack.Screen
            name="RuleEditor"
            component={RuleEditorScreen}
            options={{
              title: '自动化规则',
            }}
          />
          <Stack.Screen
            name="Permissions"
            component={PermissionsScreen}
            options={{
              title: '权限管理',
            }}
          />
        </Stack.Navigator>
        <StatusBar style={settings.darkMode ? 'light' : 'dark'} />
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 20,
  },
});
