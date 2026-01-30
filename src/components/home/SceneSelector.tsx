/**
 * SceneSelector - 场景选择器组件
 * 允许用户手动选择/切换当前场景
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Dialog,
  Portal,
  Button,
  Surface,
  TouchableRipple,
  RadioButton,
} from 'react-native-paper';
import { spacing } from '../../theme/spacing';
import { getSceneContainerColor } from '../../theme/colors';
import type { SceneType } from '../../types';

/**
 * 场景配置
 */
interface SceneConfig {
  id: SceneType;
  name: string;
  icon: string;
  description: string;
}

const SCENE_CONFIGS: SceneConfig[] = [
  { id: 'COMMUTE', name: '通勤', icon: '🚇', description: '上下班路上' },
  { id: 'OFFICE', name: '办公', icon: '🏢', description: '在公司工作' },
  { id: 'HOME', name: '在家', icon: '🏠', description: '回到家中' },
  { id: 'STUDY', name: '学习', icon: '📚', description: '专注学习中' },
  { id: 'SLEEP', name: '睡眠', icon: '😴', description: '准备休息' },
  { id: 'TRAVEL', name: '出行', icon: '✈️', description: '外出旅行' },
];

export interface SceneSelectorProps {
  visible: boolean;
  currentScene: SceneType | null;
  onSelect: (scene: SceneType) => void;
  onDismiss: () => void;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({
  visible,
  currentScene,
  onSelect,
  onDismiss,
}) => {
  const [selectedScene, setSelectedScene] = useState<SceneType | null>(currentScene);

  const handleConfirm = () => {
    if (selectedScene) {
      onSelect(selectedScene);
    }
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={styles.dialog}
      >
        <Dialog.Title style={styles.title}>选择场景</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <RadioButton.Group
              value={selectedScene || ''}
              onValueChange={(value) => setSelectedScene(value as SceneType)}
            >
              {SCENE_CONFIGS.map((scene) => (
                <TouchableRipple
                  key={scene.id}
                  onPress={() => setSelectedScene(scene.id)}
                  style={styles.sceneItem}
                >
                  <View style={styles.sceneRow}>
                    <Surface
                      style={[
                        styles.sceneIcon,
                        { backgroundColor: getSceneContainerColor(scene.id) },
                      ]}
                      elevation={0}
                    >
                      <Text style={styles.sceneEmoji}>{scene.icon}</Text>
                    </Surface>
                    <View style={styles.sceneInfo}>
                      <Text variant="titleMedium" style={styles.sceneName}>
                        {scene.name}
                      </Text>
                      <Text variant="bodySmall" style={styles.sceneDescription}>
                        {scene.description}
                      </Text>
                    </View>
                    <RadioButton value={scene.id} />
                  </View>
                </TouchableRipple>
              ))}
            </RadioButton.Group>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} mode="outlined">
            取消
          </Button>
          <Button
            onPress={handleConfirm}
            mode="contained"
            disabled={!selectedScene}
          >
            确认
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
    borderRadius: 16,
  },
  title: {
    textAlign: 'center',
  },
  scrollArea: {
    paddingHorizontal: 0,
    maxHeight: 400,
  },
  sceneItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sceneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sceneEmoji: {
    fontSize: 24,
  },
  sceneInfo: {
    flex: 1,
  },
  sceneName: {
    fontWeight: '600',
  },
  sceneDescription: {
    color: '#666',
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
});

export default SceneSelector;
