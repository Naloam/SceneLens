import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSceneStore } from '../stores';
import { silentContextEngine } from '../sensors';
import { notificationManager } from '../notifications';
import type { SilentContext } from '../types';

export const HomeScreen: React.FC = () => {
  const {
    currentContext,
    isDetecting,
    detectionError,
    history,
    setCurrentContext,
    setIsDetecting,
    setDetectionError,
    addToHistory,
    getRecentHistory,
  } = useSceneStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Initialize notification manager
    initializeNotifications();
    
    // Detect scene on mount
    detectScene();
  }, []);

  const initializeNotifications = async () => {
    const success = await notificationManager.initialize();
    if (!success) {
      console.warn('Failed to initialize notifications');
    }
  };

  const detectScene = async () => {
    setIsDetecting(true);
    setDetectionError(null);

    try {
      const context = await silentContextEngine.getContext();
      setCurrentContext(context);

      // Add to history
      addToHistory({
        sceneType: context.context,
        timestamp: Date.now(),
        confidence: context.confidence,
        triggered: false,
        userAction: null,
      });

      // Show notification if confidence is high enough
      if (context.confidence > 0.7) {
        await showSceneSuggestion(context);
      }
    } catch (error) {
      console.error('Scene detection error:', error);
      setDetectionError((error as Error).message);
    } finally {
      setIsDetecting(false);
    }
  };

  const showSceneSuggestion = async (context: SilentContext) => {
    const sceneNames: Record<string, string> = {
      COMMUTE: '通勤模式',
      OFFICE: '办公模式',
      HOME: '到家模式',
      STUDY: '学习模式',
      SLEEP: '睡前模式',
      TRAVEL: '出行模式',
      UNKNOWN: '未知场景',
    };

    await notificationManager.showSceneSuggestion({
      sceneType: context.context,
      title: `检测到${sceneNames[context.context]}`,
      body: `置信度: ${(context.confidence * 100).toFixed(0)}%`,
      actions: [],
      confidence: context.confidence,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await detectScene();
    setRefreshing(false);
  };

  const getSceneColor = (sceneType: string): string => {
    const colors: Record<string, string> = {
      COMMUTE: '#FF6B6B',
      OFFICE: '#4ECDC4',
      HOME: '#95E1D3',
      STUDY: '#F38181',
      SLEEP: '#AA96DA',
      TRAVEL: '#FCBAD3',
      UNKNOWN: '#A8A8A8',
    };
    return colors[sceneType] || '#A8A8A8';
  };

  const getSceneName = (sceneType: string): string => {
    const names: Record<string, string> = {
      COMMUTE: '通勤',
      OFFICE: '办公',
      HOME: '到家',
      STUDY: '学习',
      SLEEP: '睡前',
      TRAVEL: '出行',
      UNKNOWN: '未知',
    };
    return names[sceneType] || '未知';
  };

  const recentHistory = getRecentHistory(5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>SceneLens</Text>
        <Text style={styles.subtitle}>场景感知助手</Text>
      </View>

      {/* Current Scene Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>当前场景</Text>

        {isDetecting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>正在检测场景...</Text>
          </View>
        ) : detectionError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {detectionError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={detectScene}>
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : currentContext ? (
          <View style={styles.sceneContainer}>
            <View
              style={[
                styles.sceneBadge,
                { backgroundColor: getSceneColor(currentContext.context) },
              ]}
            >
              <Text style={styles.sceneText}>
                {getSceneName(currentContext.context)}
              </Text>
            </View>

            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceLabel}>置信度</Text>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${currentContext.confidence * 100}%`,
                      backgroundColor: getSceneColor(currentContext.context),
                    },
                  ]}
                />
              </View>
              <Text style={styles.confidenceValue}>
                {(currentContext.confidence * 100).toFixed(1)}%
              </Text>
            </View>

            <View style={styles.signalsContainer}>
              <Text style={styles.signalsTitle}>
                信号源 ({currentContext.signals.length})
              </Text>
              {currentContext.signals.map((signal, index) => (
                <View key={index} style={styles.signalItem}>
                  <Text style={styles.signalType}>{signal.type}</Text>
                  <Text style={styles.signalValue}>{signal.value}</Text>
                  <Text style={styles.signalWeight}>
                    权重: {signal.weight.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>点击下方按钮开始检测场景</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.detectButton, isDetecting && styles.detectButtonDisabled]}
          onPress={detectScene}
          disabled={isDetecting}
        >
          <Text style={styles.detectButtonText}>
            {isDetecting ? '检测中...' : '检测场景'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent History Card */}
      {recentHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>最近场景</Text>
          {recentHistory.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <View
                style={[
                  styles.historyBadge,
                  { backgroundColor: getSceneColor(item.sceneType) },
                ]}
              >
                <Text style={styles.historyBadgeText}>
                  {getSceneName(item.sceneType)}
                </Text>
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTime}>
                  {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.historyConfidence}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sceneContainer: {
    marginBottom: 16,
  },
  sceneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  sceneText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  confidenceContainer: {
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceValue: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  signalsContainer: {
    marginTop: 8,
  },
  signalsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  signalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  signalType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  signalValue: {
    fontSize: 12,
    color: '#666',
    flex: 2,
  },
  signalWeight: {
    fontSize: 11,
    color: '#999',
    flex: 1,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  detectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detectButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  detectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
  },
  historyConfidence: {
    fontSize: 12,
    color: '#999',
  },
});
