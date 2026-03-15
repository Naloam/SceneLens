import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // 新增引入
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, useTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
import { DataScreen } from './src/screens/DataScreen';
import LocationConfigScreen from './src/screens/LocationConfigScreen';
import { backgroundService } from './src/background';
import { useSettingsStore, themeColors } from './src/stores/settingsStore';
// 1. 定义路由类型
export type RootStackParamList = {
  MainTabs: undefined; // 底部导航的根路由
  SceneConfig: undefined;
  PermissionGuide: undefined;
  MeetingConfig: undefined;
  LocationConfig: undefined;
  Stats: undefined;
  NotificationFilter: undefined;
  RuleEditor: undefined;
  Permissions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// 2. 创建底部导航组件
function MainTabNavigator() {
  const theme = useTheme(); // 使用当前主题，完美适配深色/浅色模式

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'help-circle';
         if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'DataTab') {
            // "数据" 对应的图标 (方块型图表)
            iconName = focused ? 'chart-box' : 'chart-box-outline'; 
          } else if (route.name === 'SettingsTab') {
            // "设置" 对应的图标 (齿轮)
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={26} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.surfaceVariant,
          elevation: 8, // MD3 阴影
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'SceneLens',
          tabBarLabel: '首页',
        }}
      />
      <Tab.Screen
        name="SceneTab"
        component={DataScreen} // 挂载我们新建的数据页面
        options={{
          title: '场景配置',
          tabBarLabel: '场景',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen} // 第三个改为原本存在的设置中心
        options={{
          title: '设置',
          tabBarLabel: '我的',
        }}
      />
    </Tab.Navigator>
  );
}

// 3. 核心应用组件 (保持你的所有功能逻辑原封不动)
export default function App() {
  // 获取设置状态
  const { settings, loadSettings } = useSettingsStore();

  // 根据设置动态创建主题
  // 根据设置动态创建主题（纯正的同色系 Monochromatic 风格）
  const theme = useMemo(() => {
    const baseTheme = settings.darkMode ? MD3DarkTheme : MD3LightTheme;
    const colorScheme = themeColors[settings.themeColor];
    
    // 魔法在这里：利用 16 进制透明度，动态生成与当前主色一致的极浅底色
    // 1A 代表 10% 透明度，0D 代表 5% 透明度 (深色模式下稍微提亮点用 33)
    const lightBg = settings.darkMode ? `${colorScheme.primary}33` : `${colorScheme.primary}1A`;
    const lighterBg = settings.darkMode ? `${colorScheme.primary}1A` : `${colorScheme.primary}0D`;
    
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        // 1. 核心主色
        primary: colorScheme.primary,
        secondary: settings.darkMode ? colorScheme.light : colorScheme.dark,
        tertiary: colorScheme.primary, 
        
        // 2. 基础背景板 (去掉原先自带的微粉色，改为纯粹的白/黑)
        background: settings.darkMode ? '#121212' : '#FFFFFF',
        surface: settings.darkMode ? '#1E1E1E' : '#FFFFFF',
        
        // 3. 核心修复：覆盖默认的紫色容器！全部改为动态计算的【同色系浅色透明版】
        primaryContainer: lightBg,
        onPrimaryContainer: colorScheme.primary,
        secondaryContainer: lightBg,
        onSecondaryContainer: colorScheme.primary,
        tertiaryContainer: lightBg,
        onTertiaryContainer: colorScheme.primary,
        surfaceVariant: lighterBg, // 面板、卡片内部极浅的区分底色
        
        // 4. 文字及其他颜色
        onPrimary: '#FFFFFF',
        onSecondary: '#FFFFFF',
        onBackground: settings.darkMode ? '#E6E1E5' : '#1C1B1F',
        onSurface: settings.darkMode ? '#E6E1E5' : '#1C1B1F',
        onSurfaceVariant: settings.darkMode ? '#CAC4D0' : '#49454F',
        
        // 5. 错误状态颜色也做配套的深浅处理
        error: '#B3261E',
        errorContainer: settings.darkMode ? '#B3261E33' : '#B3261E1A',
        onError: '#FFFFFF',
      },
    };
  }, [settings.darkMode, settings.themeColor]);

  // 初始化加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  // 初始化后台服务
  useEffect(() => {
    const initBackgroundService = async () => {
      try {
        await backgroundService.initialize();
        backgroundService.start();
        console.log('[App] Background service started');
      } catch (error) {
        console.error('[App] Failed to initialize background service:', error);
      }
    };

    initBackgroundService();

    // 清理
    return () => {
      backgroundService.destroy();
    };
  }, []);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="MainTabs"
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
          {/* 将底部导航作为 Stack 的基础页面 */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabNavigator}
            options={{ headerShown: false }} // 隐藏 Stack 的 Header，使用 Tab 自带的 Header
          />

          <Stack.Screen name="SceneConfig" component={SceneConfigScreen} options={{ title: '场景配置' }} />
          
          {/* 其他二级页面保持不变，点击进入时会盖住底部导航栏（更符合原生 App 体验） */}
          <Stack.Screen name="PermissionGuide" component={PermissionGuideScreen} options={{ title: '权限管理' }} />
          <Stack.Screen name="MeetingConfig" component={MeetingConfigScreen} options={{ title: '会议场景配置' }} />
          <Stack.Screen name="LocationConfig" component={LocationConfigScreen} options={{ title: '位置配置' }} />
          <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '数据统计' }} />
          <Stack.Screen name="NotificationFilter" component={NotificationFilterScreen} options={{ title: '智能通知过滤' }} />
          <Stack.Screen name="RuleEditor" component={RuleEditorScreen} options={{ title: '自动化规则' }} />
          <Stack.Screen name="Permissions" component={PermissionsScreen} options={{ title: '权限管理' }} />
        </Stack.Navigator>
        <StatusBar style={settings.darkMode ? 'light' : 'dark'} />
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({});