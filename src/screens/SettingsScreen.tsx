/**
 * 设置页面
 *
 * 提供应用设置选项，包括外观、通知、高级设置和数据管理
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  Text,
} from 'react-native';
import {
  Card,
  List,
  Switch,
  RadioButton,
  TouchableRipple,
  useTheme,
  Divider,
  Portal,
  Dialog,
  Button,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useSettingsStore, themeColors, type ThemeColor, type NotificationStyle, type DetectionInterval } from '../stores/settingsStore';
import { storageManager } from '../stores/storageManager';

/**
 * 颜色选择器组件
 */
const ColorPicker: React.FC<{
  selectedColor: ThemeColor;
  onSelectColor: (color: ThemeColor) => void;
}> = ({ selectedColor, onSelectColor }) => {
  const colors: ThemeColor[] = ['blue', 'purple', 'green', 'orange'];

  return (
    <View style={styles.colorPickerContainer}>
      {colors.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorDot,
            { backgroundColor: themeColors[color].primary },
            selectedColor === color && styles.colorDotSelected,
          ]}
          onPress={() => onSelectColor(color)}
          activeOpacity={0.7}
        >
          {selectedColor === color && <View style={styles.colorDotCheck} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

/**
 * 单选按钮组组件
 */
interface RadioOption<T> {
  label: string;
  value: T;
  description?: string;
}

const RadioGroup: React.FC<{
  options: RadioOption<string | number>[];
  value: string | number;
  onChange: (value: any) => void;
}> = ({ options, value, onChange }) => {
  const theme = useTheme();

  return (
    <View style={styles.radioGroup}>
      {options.map((option, index) => (
        <View key={option.value.toString()}>
          <TouchableRipple onPress={() => onChange(option.value)}>
            <View style={styles.radioItem}>
              <View style={styles.radioContent}>
                <Text style={[styles.radioLabel, { color: theme.colors.onSurface }]}>
                  {option.label}
                </Text>
                {option.description && (
                  <Text style={[styles.radioDescription, { color: theme.colors.onSurfaceVariant }]}>
                    {option.description}
                  </Text>
                )}
              </View>
              <RadioButton
                value={option.value.toString()}
                status={value === option.value ? 'checked' : 'unchecked'}
                onPress={() => onChange(option.value)}
              />
            </View>
          </TouchableRipple>
          {index < options.length - 1 && <Divider />}
        </View>
      ))}
    </View>
  );
};

/**
 * 置信度滑块组件
 */
const ConfidenceSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const theme = useTheme();
  const options = [30, 40, 50, 60, 70, 80, 90];

  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <View>
          <Text style={[styles.sliderTitle, { color: theme.colors.onSurface }]}>
            置信度阈值
          </Text>
          <Text style={[styles.sliderDescription, { color: theme.colors.onSurfaceVariant }]}>
            触发场景通知的最低置信度
          </Text>
        </View>
        <Text style={[styles.sliderValue, { color: theme.colors.primary }]}>
          {value}%
        </Text>
      </View>
      <View style={styles.sliderButtons}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sliderButton,
              value === option && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                value === option && { color: '#FFFFFF' },
              ]}
            >
              {option}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

/**
 * 主设置页面
 */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const {
    settings,
    isLoading,
    toggleDarkMode,
    setThemeColor,
    toggleSceneNotifications,
    setNotificationStyle,
    toggleAutoDetection,
    setDetectionInterval,
    setConfidenceThreshold,
    resetSettings,
    exportData,
    clearHistory,
    loadSettings,
  } = useSettingsStore();

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * 导出数据
   */
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();

      // 在实际应用中，可以使用 expo-file-system 和 expo-sharing
      // 这里简化处理
      Alert.alert(
        '导出数据',
        '数据已准备就绪（JSON 格式）\n\n在实际应用中，这里会保存为文件并提供分享选项。',
        [{ text: '确定', onPress: () => {} }]
      );

      // TODO: 安装 expo-sharing 后可以启用完整的导出功能
      // npm install expo-sharing
    } catch (error) {
      Alert.alert('导出失败', `无法导出数据：${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 清除历史记录
   */
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearHistory();
      setShowClearDialog(false);
      Alert.alert('成功', '历史记录已清除');
    } catch (error) {
      Alert.alert('清除失败', `无法清除历史记录：${(error as Error).message}`);
    } finally {
      setIsClearing(false);
    }
  };

  /**
   * 重置所有设置
   */
  const handleResetSettings = () => {
    resetSettings();
    setShowResetDialog(false);
    Alert.alert('成功', '设置已重置为默认值');
  };

  /**
   * 打开隐私政策
   */
  const openPrivacyPolicy = () => {
    // TODO: 替换为实际的隐私政策 URL
    Alert.alert('隐私政策', '隐私政策将在未来版本中提供');
  };

  /**
   * 开源源代码仓库
   */
  const openGitHubRepo = () => {
    Linking.openURL('https://github.com/yourusername/scenelens').catch((err) => {
      Alert.alert('错误', '无法打开链接');
    });
  };

  /**
   * 发送反馈
   */
  const sendFeedback = () => {
    const email = 'feedback@scenelens.app';
    const subject = 'SceneLens 反馈';
    const body = '请在此处描述您的意见或建议...';

    Linking.openURL(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    ).catch(() => {
      Alert.alert('错误', '无法打开邮件应用');
    });
  };

  const notificationStyleOptions: RadioOption<NotificationStyle>[] = [
    {
      label: '基本样式',
      value: 'basic',
      description: '仅显示场景名称和基本操作',
    },
    {
      label: '详细样式',
      value: 'detailed',
      description: '显示场景详情、置信度和完整操作',
    },
  ];

  const intervalOptions: RadioOption<DetectionInterval>[] = [
    { label: '5 分钟', value: 5, description: '更频繁的检测，可能增加耗电' },
    { label: '10 分钟', value: 10, description: '平衡的检测频率' },
    { label: '15 分钟', value: 15, description: '较少的检测，更省电' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 场景与自动化 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>场景与自动化</List.Subheader>

        <List.Item
          title="场景配置"
          description="配置各场景的首选应用和触发条件"
          left={(props) => <List.Icon {...props} icon="cog-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('SceneConfig')}
        />

        <Divider />

        <List.Item
          title="自动化规则"
          description="创建和管理场景触发的自动化规则"
          left={(props) => <List.Icon {...props} icon="robot" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('RuleEditor')}
        />

        <Divider />

        <List.Item
          title="位置配置"
          description="设置家、公司等常用位置的地理围栏"
          left={(props) => <List.Icon {...props} icon="map-marker" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('LocationConfig')}
        />

        <Divider />

        <List.Item
          title="会议场景配置"
          description="配置日历集成和会议检测规则"
          left={(props) => <List.Icon {...props} icon="calendar-clock" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('MeetingConfig')}
        />

        <Divider />

        <List.Item
          title="权限管理"
          description="管理应用所需的各项系统权限"
          left={(props) => <List.Icon {...props} icon="shield-check" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Permissions')}
        />
      </Card>

      {/* 外观设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>外观设置</List.Subheader>

        <List.Item
          title="深色模式"
          description={settings.darkMode ? '已开启' : '已关闭'}
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => <Switch value={settings.darkMode} onValueChange={toggleDarkMode} />}
        />

        <Divider />

        <View style={styles.colorPickerSection}>
          <View style={styles.colorPickerHeader}>
            <List.Icon icon="palette" />
            <Text style={[styles.colorPickerTitle, { color: theme.colors.onSurface }]}>
              主题颜色
            </Text>
          </View>
          <ColorPicker selectedColor={settings.themeColor} onSelectColor={setThemeColor} />
        </View>
      </Card>

      {/* 通知设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>通知设置</List.Subheader>

        <List.Item
          title="场景通知"
          description="检测到新场景时发送通知"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={() => (
            <Switch
              value={settings.sceneNotificationsEnabled}
              onValueChange={toggleSceneNotifications}
            />
          )}
        />

        {settings.sceneNotificationsEnabled && (
          <>
            <Divider />
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                通知样式
              </Text>
              <RadioGroup
                options={notificationStyleOptions}
                value={settings.notificationStyle}
                onChange={setNotificationStyle}
              />
            </View>
          </>
        )}
        
        <Divider />
        
        <List.Item
          title="智能通知过滤"
          description="根据场景自动过滤不重要的通知"
          left={(props) => <List.Icon {...props} icon="filter" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('NotificationFilter')}
        />
      </Card>

      {/* 高级设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>高级设置</List.Subheader>

        <List.Item
          title="自动检测"
          description="定期自动检测场景变化"
          left={(props) => <List.Icon {...props} icon="radar" />}
          right={() => (
            <Switch
              value={settings.autoDetectionEnabled}
              onValueChange={toggleAutoDetection}
            />
          )}
        />

        {settings.autoDetectionEnabled && (
          <>
            <Divider />
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                检测间隔
              </Text>
              <RadioGroup
                options={intervalOptions}
                value={settings.detectionInterval}
                onChange={setDetectionInterval}
              />
            </View>
          </>
        )}

        <Divider />

        <ConfidenceSlider
          value={settings.confidenceThreshold}
          onChange={setConfidenceThreshold}
        />
      </Card>

      {/* 数据设置 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>数据设置</List.Subheader>

        <List.Item
          title="导出数据"
          description="将所有数据导出为 JSON 文件"
          left={(props) => <List.Icon {...props} icon="download" />}
          onPress={handleExportData}
          disabled={isExporting}
        />

        <Divider />

        <List.Item
          title="清除历史"
          description="删除所有场景历史记录"
          left={(props) => <List.Icon {...props} icon="delete-sweep" />}
          onPress={() => setShowClearDialog(true)}
          disabled={isClearing}
        />

        <Divider />

        <List.Item
          title="重置设置"
          description="恢复所有设置为默认值"
          left={(props) => <List.Icon {...props} icon="restore" />}
          onPress={() => setShowResetDialog(true)}
          style={styles.dangerItem}
        />
      </Card>

      {/* 关于 */}
      <Card style={styles.card}>
        <List.Subheader style={styles.cardHeader}>关于</List.Subheader>

        <List.Item
          title="版本"
          description="1.0.0"
          left={(props) => <List.Icon {...props} icon="information" />}
        />

        <Divider />

        <List.Item
          title="隐私政策"
          left={(props) => <List.Icon {...props} icon="shield-account" />}
          onPress={openPrivacyPolicy}
        />

        <Divider />

        <List.Item
          title="源代码"
          description="在 GitHub 上查看"
          left={(props) => <List.Icon {...props} icon="github" />}
          onPress={openGitHubRepo}
        />

        <Divider />

        <List.Item
          title="发送反馈"
          description="报告问题或提出建议"
          left={(props) => <List.Icon {...props} icon="message-draw" />}
          onPress={sendFeedback}
        />
      </Card>

      {/* 确认重置对话框 */}
      <Portal>
        <Dialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title>重置设置</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              确定要将所有设置恢复为默认值吗？此操作无法撤销。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)}>取消</Button>
            <Button onPress={handleResetSettings} mode="contained">
              确认重置
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 确认清除历史对话框 */}
      <Portal>
        <Dialog visible={showClearDialog} onDismiss={() => setShowClearDialog(false)}>
          <Dialog.Title>清除历史</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>
              确定要删除所有场景历史记录吗？此操作无法撤销。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>取消</Button>
            <Button onPress={handleClearHistory} mode="contained" buttonColor="#FF3B30">
              确认清除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
          SceneLens - 智能场景感知助手
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    paddingLeft: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  colorPickerSection: {
    padding: 16,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  colorDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#007AFF',
  },
  colorDotCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  sectionContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  sliderSection: {
    padding: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sliderTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  sliderDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  sliderValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sliderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sliderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sliderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  dangerItem: {
    backgroundColor: '#FFF5F5',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
