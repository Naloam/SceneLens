# UI Screens

用户界面屏幕模块，包含主屏幕、场景配置和权限引导页面。

## 功能特性

- ✅ 主屏幕（场景状态显示）
- ✅ 场景配置页面（应用偏好设置）
- ✅ 权限引导页面（权限管理）
- ✅ React Navigation 导航
- ✅ 响应式设计
- ✅ 下拉刷新

## 屏幕列表

### 1. Home Screen (主屏幕)

显示当前场景状态、置信度、信号源和最近场景历史。

**功能：**
- 实时场景检测
- 显示场景置信度和信号源
- 显示最近场景历史
- 下拉刷新
- 自动推送场景建议通知

**使用的 Store：**
- `useSceneStore`: 场景状态管理

**使用的引擎：**
- `silentContextEngine`: 场景检测
- `notificationManager`: 通知推送

**导航：**
- 左上角：跳转到权限管理页面
- 右上角：跳转到场景配置页面

### 2. Scene Config Screen (场景配置)

显示和管理各场景的首选应用。

**功能：**
- 显示已分类的应用列表
- 显示各类别的 Top 3 应用
- 重新扫描应用
- 显示统计信息

**使用的 Store：**
- `useAppPreferenceStore`: 应用偏好管理
- `useSceneStore`: 自动模式设置

**使用的引擎：**
- `appDiscoveryEngine`: 应用发现

**应用类别：**
- 音乐播放器 (MUSIC_PLAYER)
- 乘车码/交通 (TRANSIT_APP)
- 会议应用 (MEETING_APP)
- 学习应用 (STUDY_APP)
- 智能家居 (SMART_HOME)
- 日历应用 (CALENDAR)
- 支付应用 (PAYMENT_APP)

### 3. Permission Guide Screen (权限引导)

显示和管理应用所需的各项权限。

**功能：**
- 显示所有权限及其状态
- 请求权限
- 显示权限授予进度
- 显示隐私承诺
- 刷新权限状态

**使用的 Store：**
- `usePermissionStore`: 权限状态管理

**使用的桥接：**
- `sceneBridge`: 权限检查和请求

**权限列表：**
- 📍 位置权限 (必需)
- 🚶 活动识别权限 (必需)
- 📊 使用统计权限 (必需)
- 📷 相机权限 (可选)
- 🎤 麦克风权限 (可选)
- 🔔 通知权限 (必需)
- 🔕 勿扰模式权限 (可选)

## 导航结构

```
App
├── Home Screen (主屏幕)
│   ├── → Permission Guide (权限管理)
│   └── → Scene Config (场景配置)
├── Scene Config Screen (场景配置)
└── Permission Guide Screen (权限引导)
```

## 使用方法

### 导航配置

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen, SceneConfigScreen, PermissionGuideScreen } from './screens';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SceneConfig" component={SceneConfigScreen} />
        <Stack.Screen name="PermissionGuide" component={PermissionGuideScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 导航跳转

```typescript
import { useNavigation } from '@react-navigation/native';

function MyComponent() {
  const navigation = useNavigation();

  const goToSceneConfig = () => {
    navigation.navigate('SceneConfig');
  };

  const goToPermissionGuide = () => {
    navigation.navigate('PermissionGuide');
  };

  return (
    <View>
      <Button title="场景配置" onPress={goToSceneConfig} />
      <Button title="权限管理" onPress={goToPermissionGuide} />
    </View>
  );
}
```

## 样式设计

### 颜色方案

**场景颜色：**
- 通勤 (COMMUTE): #FF6B6B
- 办公 (OFFICE): #4ECDC4
- 到家 (HOME): #95E1D3
- 学习 (STUDY): #F38181
- 睡前 (SLEEP): #AA96DA
- 出行 (TRAVEL): #FCBAD3
- 未知 (UNKNOWN): #A8A8A8

**状态颜色：**
- 已授予: #4CAF50 (绿色)
- 已拒绝: #F44336 (红色)
- 未请求: #FF9800 (橙色)
- 未知: #9E9E9E (灰色)

**主题颜色：**
- 主色: #007AFF (蓝色)
- 背景: #F5F5F5 (浅灰)
- 卡片: #FFFFFF (白色)
- 文字: #333333 (深灰)

### 组件样式

**卡片 (Card):**
- 背景: 白色
- 圆角: 12px
- 阴影: 轻微阴影
- 内边距: 16px

**按钮 (Button):**
- 主按钮: 蓝色背景，白色文字
- 圆角: 8px
- 内边距: 12px 垂直

**徽章 (Badge):**
- 圆角: 12-20px
- 内边距: 4-8px 垂直，8-16px 水平
- 场景徽章使用对应的场景颜色

## 交互设计

### 下拉刷新

主屏幕支持下拉刷新，重新检测当前场景。

```typescript
<ScrollView
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
>
  {/* 内容 */}
</ScrollView>
```

### 加载状态

所有异步操作都有加载状态指示：
- 场景检测中：显示加载动画
- 应用初始化中：显示加载文本
- 权限检查中：禁用按钮

### 错误处理

错误信息会友好地显示给用户：
- 场景检测失败：显示错误信息和重试按钮
- 权限请求失败：显示提示信息
- 应用加载失败：显示错误提示

## 相关需求

- 需求 2.2: 通勤场景推送通知卡片
- 需求 9.5: 首次配置向导（选择首选应用）
- 需求 11: 权限管理（清晰说明权限用途）
- 需求 14: 可维护性（模块化架构）
