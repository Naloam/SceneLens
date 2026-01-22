import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import {
  HomeScreen,
  SceneConfigScreen,
  PermissionGuideScreen,
  MeetingConfigScreen,
  StatsScreen,
  SettingsScreen,
} from './src/screens';
import LocationConfigScreen from './src/screens/LocationConfigScreen';

export type RootStackParamList = {
  Home: undefined;
  SceneConfig: undefined;
  PermissionGuide: undefined;
  MeetingConfig: undefined;
  LocationConfig: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// 自定义 Material Design 3 主题
const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6750A4',
    secondary: '#625B71',
    tertiary: '#7D5260',
    background: '#FFFBFE',
    surface: '#FFFBFE',
    surfaceVariant: '#E7E0EC',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#1C1B1F',
    onSurface: '#1C1B1F',
    onSurfaceVariant: '#49454F',
    error: '#B3261E',
    onError: '#FFFFFF',
  },
};

export default function App() {
  return (
    <PaperProvider theme={customTheme}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: customTheme.colors.primary,
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
                  onPress={() => navigation.navigate('SceneConfig')}
                >
                  <Text style={styles.headerButtonText}>⚙️</Text>
                </TouchableOpacity>
              ),
              headerLeft: () => (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('PermissionGuide')}
                >
                  <Text style={styles.headerButtonText}>🔒</Text>
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
        </Stack.Navigator>
        <StatusBar style="light" />
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
