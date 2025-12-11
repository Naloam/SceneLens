/**
 * Notification Manager Demo
 * 
 * This file demonstrates how to use the notification manager
 */

import { notificationManager } from './NotificationManager';
import type { SceneSuggestionNotification } from './NotificationManager';

/**
 * Demo: Initialize notification manager
 */
export async function demoInitialize() {
  console.log('=== Notification Manager Demo: Initialize ===');
  
  const success = await notificationManager.initialize();
  console.log('Initialization result:', success);
  
  if (!success) {
    console.warn('Failed to initialize notifications. Permission may be denied.');
  }
  
  return success;
}

/**
 * Demo: Show scene suggestion notification
 */
export async function demoShowSceneSuggestion() {
  console.log('=== Notification Manager Demo: Show Scene Suggestion ===');
  
  const suggestion: SceneSuggestionNotification = {
    sceneType: 'COMMUTE',
    title: '检测到通勤场景',
    body: '一键打开乘车码和音乐应用',
    actions: [],
    confidence: 0.85,
  };
  
  const notificationId = await notificationManager.showSceneSuggestion(suggestion);
  console.log('Notification ID:', notificationId);
  
  return notificationId;
}

/**
 * Demo: Show execution result
 */
export async function demoShowExecutionResult() {
  console.log('=== Notification Manager Demo: Show Execution Result ===');
  
  const notificationId = await notificationManager.showExecutionResult(
    'COMMUTE',
    true,
    '已打开乘车码和音乐应用'
  );
  
  console.log('Notification ID:', notificationId);
  
  return notificationId;
}

/**
 * Demo: Show system notification
 */
export async function demoShowSystemNotification() {
  console.log('=== Notification Manager Demo: Show System Notification ===');
  
  const notificationId = await notificationManager.showSystemNotification(
    '系统提示',
    '场景检测服务已启动'
  );
  
  console.log('Notification ID:', notificationId);
  
  return notificationId;
}

/**
 * Demo: Check notification status
 */
export async function demoCheckNotificationStatus() {
  console.log('=== Notification Manager Demo: Check Status ===');
  
  const enabled = await notificationManager.areNotificationsEnabled();
  console.log('Notifications enabled:', enabled);
  
  const pending = await notificationManager.getPendingNotifications();
  console.log('Pending notifications:', pending.length);
  
  return { enabled, pendingCount: pending.length };
}

/**
 * Run all demos
 */
export async function runAllNotificationDemos() {
  console.log('=== Running All Notification Manager Demos ===\n');
  
  try {
    await demoInitialize();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoShowSceneSuggestion();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoShowExecutionResult();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoShowSystemNotification();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoCheckNotificationStatus();
    
    console.log('\n=== All Notification Demos Completed ===');
  } catch (error) {
    console.error('Demo error:', error);
  }
}
