/**
 * 设置页面
 *
 * 提供应用设置选项，包括外观、通知、高级设置和数据管理
 */


import React, { 
  useEffect, 
  useState 
} from 'react';
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
import { 
  useSettingsStore, 
  themeColors, 
  type ThemeColor, 
  type NotificationStyle, 
  type DetectionInterval 
} from '../stores/settingsStore';

/**
 * 颜色选择器
 */
const ColorPicker: React.FC<{
  selectedColor: ThemeColor;
  onSelectColor: (color: ThemeColor) => void;
}> = ({ selectedColor, onSelectColor }) => {
  const theme = useTheme();
  const colors: ThemeColor[] = [
    'blue', 
    'purple', 
    'green', 
    'orange', 
    'pink', 
    'mint', 
    'sky', 
    'lavender'
  ];

  return (
    <View style={styles.colorPickerContainer}>
      {colors.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorDot,
            { backgroundColor: themeColors[color].primary },
            selectedColor === color && { 
              borderColor: theme.colors.primary, 
              borderWidth: 3 
            },
          ]}
          onPress={() => onSelectColor(color)}
          activeOpacity={0.7}
        >
          {selectedColor === color && (
            <View style={styles.colorDotCheck} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

/**
 * 单选组件
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
                <Text 
                  style={[
                    styles.radioLabel, 
                    { color: theme.colors.onSurface }
                  ]}
                >
                  {option.label}
                </Text>
                {option.description && (
                  <Text 
                    style={[
                      styles.radioDescription, 
                      { color: theme.colors.onSurfaceVariant }
                    ]}
                  >
                    {option.description}
                  </Text>
                )}
              </View>
              <RadioButton
                value={option.value.toString()}
                status={value === option.value ? 'checked' : 'unchecked'}
                onPress={() => onChange(option.value)}
                color={theme.colors.primary}
              />
            </View>
          </TouchableRipple>
          {index < options.length - 1 && (
            <Divider 
              style={{ 
                backgroundColor: theme.colors.surfaceVariant, 
                opacity: 0.3 
              }} 
            />
          )}
        </View>
      ))}
    </View>
  );
};

/**
 * 阈值滑块
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
          <Text 
            style={[
              styles.sliderTitle, 
              { color: theme.colors.onSurface }
            ]}
          >
            置信度阈值
          </Text>
          <Text 
            style={[
              styles.sliderDescription, 
              { color: theme.colors.onSurfaceVariant }
            ]}
          >
            触发场景通知的最低置信度
          </Text>
        </View>
        <Text 
          style={[
            styles.sliderValue, 
            { color: theme.colors.primary }
          ]}
        >
          {value}%
        </Text>
      </View>
      <View style={styles.sliderButtons}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sliderButton,
              { 
                backgroundColor: value === option 
                  ? theme.colors.primary 
                  : theme.colors.surface 
              },
            ]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.sliderButtonText,
                { 
                  color: value === option 
                    ? theme.colors.onPrimary 
                    : theme.colors.onSurfaceVariant 
                },
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

export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const ultraLightBg = theme.colors.primary + '0A';

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

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await exportData();
      Alert.alert(
        '导出数据',
        '数据已准备就绪',
        [{ text: '确定' }]
      );
    } catch (error) {
      Alert.alert('导出失败', '无法导出数据');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearHistory();
      setShowClearDialog(false);
      Alert.alert('成功', '历史记录已清除');
    } catch (error) {
      Alert.alert('清除失败', '操作未完成');
    } finally {
      setIsClearing(false);
    }
  };

  const handleResetSettings = () => {
    resetSettings();
    setShowResetDialog(false);
    Alert.alert('成功', '设置已重置');
  };

  const openPrivacyPolicy = () => {
    Alert.alert('隐私政策', '相关条款将在后续版本更新。');
  };

  const openGitHubRepo = () => {
    Linking.openURL('https://github.com/').catch(() => {
      Alert.alert('错误', '无法连接。');
    });
  };

  const sendFeedback = () => {
    const email = 'feedback@scenelens.app';
    const subject = 'SceneLens 反馈';
    Linking.openURL(
      `mailto:${email}?subject=${encodeURIComponent(subject)}`
    ).catch(() => {
      Alert.alert('错误', '未找到邮件客户端。');
    });
  };

  const notificationStyleOptions: RadioOption<NotificationStyle>[] = [
    { 
      label: '基本样式', 
      value: 'basic', 
      description: '仅显示场景名称和基本操作' 
    },
    { 
      label: '详细样式', 
      value: 'detailed', 
      description: '显示场景详情、置信度和完整操作' 
    },
  ];

  const intervalOptions: RadioOption<DetectionInterval>[] = [
    { label: '5 分钟', value: 5, description: '更频繁的检测' },
    { label: '10 分钟', value: 10, description: '平衡模式' },
    { label: '15 分钟', value: 15, description: '省电模式' },
  ];

  return (
    <ScrollView
      style={[
        styles.container, 
        { backgroundColor: theme.colors.background }
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.primary }]}>
          场景与自动化
        </List.Subheader>
        <List.Item 
          title="场景配置" 
          description="配置首选应用和触发条件" 
          left={(props) => <List.Icon {...props} icon="cog-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={() => navigation.navigate('SceneConfig')} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="自动化规则" 
          description="创建和管理自动化规则" 
          left={(props) => <List.Icon {...props} icon="robot-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={() => navigation.navigate('RuleEditor')} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="位置配置" 
          description="设置常用位置的地理围栏" 
          left={(props) => <List.Icon {...props} icon="map-marker-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={() => navigation.navigate('LocationConfig')} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="权限管理" 
          description="管理各项系统权限" 
          left={(props) => <List.Icon {...props} icon="shield-check-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={() => navigation.navigate('Permissions')} 
        />
      </Card>

      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.primary }]}>
          外观设置
        </List.Subheader>
        <List.Item
          title="深色模式"
          description={settings.darkMode ? '已开启' : '已关闭'}
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => (
            <Switch 
              value={settings.darkMode} 
              onValueChange={toggleDarkMode} 
              color={theme.colors.primary}
            />
          )}
        />
        <Divider style={styles.cardDivider} />
        <View style={styles.colorPickerSection}>
          <View style={styles.colorPickerHeader}>
            <List.Icon 
              icon="palette-outline" 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text 
              style={[
                styles.colorPickerTitle, 
                { color: theme.colors.onSurface }
              ]}
            >
              主题颜色
            </Text>
          </View>
          <ColorPicker 
            selectedColor={settings.themeColor} 
            onSelectColor={setThemeColor} 
          />
        </View>
      </Card>

      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.primary }]}>
          通知设置
        </List.Subheader>
        <List.Item
          title="场景通知"
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={() => (
            <Switch
              value={settings.sceneNotificationsEnabled}
              onValueChange={toggleSceneNotifications}
              color={theme.colors.primary}
            />
          )}
        />
        {settings.sceneNotificationsEnabled && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.sectionContent}>
              <Text 
                style={[
                  styles.sectionLabel, 
                  { color: theme.colors.onSurfaceVariant }
                ]}
              >
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
      </Card>

      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.primary }]}>
          高级设置
        </List.Subheader>
        <List.Item
          title="自动检测"
          left={(props) => <List.Icon {...props} icon="radar" />}
          right={() => (
            <Switch
              value={settings.autoDetectionEnabled}
              onValueChange={toggleAutoDetection}
              color={theme.colors.primary}
            />
          )}
        />
        {settings.autoDetectionEnabled && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.sectionContent}>
              <Text 
                style={[
                  styles.sectionLabel, 
                  { color: theme.colors.onSurfaceVariant }
                ]}
              >
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
        <Divider style={styles.cardDivider} />
        <ConfidenceSlider
          value={settings.confidenceThreshold}
          onChange={setConfidenceThreshold}
        />
      </Card>

      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.primary }]}>
          关于
        </List.Subheader>
        <List.Item 
          title="版本" 
          description="1.0.0" 
          left={(props) => <List.Icon {...props} icon="information-outline" />} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="隐私政策" 
          left={(props) => <List.Icon {...props} icon="shield-account-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={openPrivacyPolicy} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="源代码" 
          left={(props) => <List.Icon {...props} icon="github" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={openGitHubRepo} 
        />
        <Divider style={styles.cardDivider} />
        <List.Item 
          title="发送反馈" 
          left={(props) => <List.Icon {...props} icon="message-alert-outline" />} 
          right={(props) => <List.Icon {...props} icon="chevron-right" />} 
          onPress={sendFeedback} 
        />
      </Card>

      <Card 
        mode="contained" 
        style={[styles.card, { backgroundColor: ultraLightBg, marginBottom: 40 }]}
      >
        <List.Subheader style={[styles.cardHeader, { color: theme.colors.error }]}>
          危险区域
        </List.Subheader>
        <List.Item
          title="清除历史"
          titleStyle={{ color: theme.colors.error }}
          left={(props) => <List.Icon {...props} icon="delete-sweep-outline" color={theme.colors.error} />}
          onPress={() => setShowClearDialog(true)}
        />
        <Divider style={styles.cardDivider} />
        <List.Item
          title="重置设置"
          titleStyle={{ color: theme.colors.error }}
          left={(props) => <List.Icon {...props} icon="restore" color={theme.colors.error} />}
          onPress={() => setShowResetDialog(true)}
        />
      </Card>

      <Portal>
        <Dialog 
          visible={showResetDialog} 
          onDismiss={() => setShowResetDialog(false)}
          style={{ backgroundColor: theme.colors.surface, borderRadius: 24 }}
        >
          <Dialog.Title>重置设置</Dialog.Title>
          <Dialog.Content>
            <Text>确定要重置吗？此操作无法撤销。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)}>取消</Button>
            <Button 
              onPress={handleResetSettings} 
              mode="contained" 
              buttonColor={theme.colors.error}
            >
              确认
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog 
          visible={showClearDialog} 
          onDismiss={() => setShowClearDialog(false)}
          style={{ backgroundColor: theme.colors.surface, borderRadius: 24 }}
        >
          <Dialog.Title>清除历史</Dialog.Title>
          <Dialog.Content>
            <Text>确定要删除所有历史记录吗？</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>取消</Button>
            <Button 
              onPress={handleClearHistory} 
              mode="contained" 
              buttonColor={theme.colors.error}
            >
              确认
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
    flex: 1 
  },
  contentContainer: { 
    padding: 16 
  },
  card: { 
    marginBottom: 16, 
    borderRadius: 32 
  },
  cardHeader: { 
    paddingLeft: 16, 
    paddingTop: 16, 
    paddingBottom: 4, 
    fontWeight: '700' 
  },
  cardDivider: { 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    marginHorizontal: 16 
  },
  colorPickerSection: { 
    padding: 16 
  },
  colorPickerHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  colorPickerTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginLeft: 8 
  },
  colorPickerContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'flex-start', 
    gap: 16, 
    paddingHorizontal: 8 
  },
  colorDot: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 3, 
    borderColor: 'transparent' 
  },
  colorDotCheck: { 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: '#FFFFFF' 
  },
  sectionContent: { 
    padding: 16 
  },
  sectionLabel: { 
    fontSize: 13, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    marginBottom: 12 
  },
  radioGroup: { 
    marginTop: 4 
  },
  radioItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8 
  },
  radioContent: { 
    flex: 1 
  },
  radioLabel: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  radioDescription: { 
    fontSize: 13, 
    marginTop: 4 
  },
  sliderSection: { 
    padding: 16 
  },
  sliderHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 16 
  },
  sliderTitle: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  sliderDescription: { 
    fontSize: 13, 
    marginTop: 4 
  },
  sliderValue: { 
    fontSize: 24, 
    fontWeight: '800' 
  },
  sliderButtons: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  sliderButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 999 
  },
  sliderButtonText: { 
    fontSize: 14, 
    fontWeight: '700' 
  },
  footer: { 
    alignItems: 'center', 
    marginTop: 8, 
    marginBottom: 24 
  },
  footerText: { 
    fontSize: 12, 
    letterSpacing: 0.5, 
    opacity: 0.7 
  },
});

export default SettingsScreen;