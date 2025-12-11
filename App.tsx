import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { HomeScreen, SceneConfigScreen, PermissionGuideScreen } from './src/screens';

export type RootStackParamList = {
  Home: undefined;
  SceneConfig: undefined;
  PermissionGuide: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
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
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
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
