/**
 * App.tsx - 应用入口（重构版本）
 * 使用 React Native Paper 和底部导航
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen, SceneConfigScreen, PermissionGuideScreen, MeetingConfigScreen } from './src/screens';
import { lightTheme, darkTheme } from './src/theme';

/**
 * 导航参数类型定义
 */
export type RootStackParamList = {
  MainTabs: undefined;
  SceneConfig: undefined;
  PermissionGuide: undefined;
  MeetingConfig: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * 主应用组件
 */
export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="MainTabs"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen
              name="MainTabs"
              component={MainTabsNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SceneConfig"
              component={SceneConfigScreen}
              options={{
                title: '场景配置',
                headerShown: true,
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: '#FFFFFF',
              }}
            />
            <Stack.Screen
              name="PermissionGuide"
              component={PermissionGuideScreen}
              options={{
                title: '权限管理',
                headerShown: true,
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: '#FFFFFF',
              }}
            />
            <Stack.Screen
              name="MeetingConfig"
              component={MeetingConfigScreen}
              options={{
                title: '会议场景配置',
                headerShown: true,
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: '#FFFFFF',
              }}
            />
          </Stack.Navigator>
          <StatusBar style="auto" />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

/**
 * 底部导航标签页导航器
 * 暂时使用 Stack 模拟，后续可迁移到 Bottom Tabs Navigator
 */
import { View, TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';

function MainTabsNavigator() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRouteName = route.name;

  /**
   * 导航到指定标签
   */
  const navigateToTab = (tabName: string) => {
    if (currentRouteName !== tabName) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: tabName }],
        })
      );
    }
  };

  /**
   * 渲染标签项
   */
  const renderTab = (
    name: string,
    label: string,
    icon: string,
    routeName: string
  ) => {
    const isActive = currentRouteName === routeName;

    return (
      <TouchableOpacity
        key={name}
        style={[styles.tabItem, isActive && styles.tabItemActive]}
        onPress={() => navigateToTab(name)}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
          {icon}
        </Text>
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 主屏幕内容 */}
      <View style={styles.content}>
        <HomeScreen />
      </View>

      {/* 底部导航栏 */}
      <View style={styles.tabBar}>
        {renderTab('Home', '首页', '🏠', 'Home')}
        {renderTab('SceneConfig', '配置', '⚙️', 'SceneConfig')}
        {renderTab('PermissionGuide', '权限', '🔒', 'PermissionGuide')}
        {renderTab('Stats', '统计', '📊', 'Stats')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabItemActive: {
    // 活跃标签样式
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  tabLabelActive: {
    fontWeight: '600',
    opacity: 1,
  },
});
