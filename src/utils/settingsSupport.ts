import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';
import sceneBridge from '../core/SceneBridge';

export const APP_VERSION = '1.0.0';
export const APP_PACKAGE_NAME = 'com.che1sy.scenelens';
export const SCENELENS_REPO_URL = 'https://github.com/Naloam/SceneLens';
export const SCENELENS_ISSUES_URL = `${SCENELENS_REPO_URL}/issues/new`;

export type ExportShareState = 'share_sheet_opened' | 'saved_only';
export type ExportShareMode = 'file_attachment' | 'text_fallback' | 'not_shared';

export interface ExportedDataFile {
  fileName: string;
  fileUri: string;
  shareUri: string;
}

export interface ExportDataResult extends ExportedDataFile {
  shareState: ExportShareState;
  shareMode: ExportShareMode;
}

export interface SharedDirectoryExportedDataFile {
  fileName: string;
  fileUri: string;
  directoryUri: string;
}

export const PRIVACY_POLICY_TEXT = [
  'SceneLens 隐私政策（当前版本）',
  '',
  '1. 场景识别、建议生成与自动化决策默认在本地设备完成，不会将原始相机、麦克风或位置数据上传到云端服务。',
  '',
  '2. 位置、日历、活动识别、通知和系统设置等权限仅用于对应的场景识别与自动化能力；未授权的能力不会被静默启用。',
  '',
  '3. 导出功能会把设置、用户配置、最近历史记录与应用偏好保存为本地 JSON 文件，只有在您主动分享时才会离开设备。',
  '',
  '4. 您可以随时在系统设置中撤回权限，也可以在 SceneLens 设置页中清除历史记录、在线学习数据或重置设置。',
].join('\n');

function formatExportTimestamp(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  const hours = `${now.getHours()}`.padStart(2, '0');
  const minutes = `${now.getMinutes()}`.padStart(2, '0');
  const seconds = `${now.getSeconds()}`.padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function buildExportFileName(now: Date): string {
  return `scenelens-export-${formatExportTimestamp(now)}.json`;
}

export async function persistExportData(data: string, now: Date = new Date()): Promise<ExportedDataFile> {
  if (!FileSystem.documentDirectory) {
    throw new Error('当前环境未提供应用文档目录，无法生成导出文件');
  }

  const fileName = buildExportFileName(now);
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, data, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let shareUri = fileUri;
  if (Platform.OS === 'android') {
    try {
      shareUri = await FileSystem.getContentUriAsync(fileUri);
    } catch {
      shareUri = fileUri;
    }
  }

  return {
    fileName,
    fileUri,
    shareUri,
  };
}

export async function persistExportDataToAndroidDirectory(
  data: string,
  now: Date = new Date()
): Promise<SharedDirectoryExportedDataFile | null> {
  if (Platform.OS !== 'android') {
    throw new Error('导出到系统文件夹目前仅支持 Android');
  }

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  const fileName = buildExportFileName(now);
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    fileName,
    'application/json'
  );

  await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, data, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    fileName,
    fileUri,
    directoryUri: permission.directoryUri,
  };
}

export async function exportDataWithBestEffortShare(
  data: string,
  now: Date = new Date()
): Promise<ExportDataResult> {
  const exportedFile = await persistExportData(data, now);
  let shareState: ExportShareState = 'saved_only';
  let shareMode: ExportShareMode = 'not_shared';

  try {
    if (Platform.OS === 'android') {
      const opened = await sceneBridge.shareFile(
        exportedFile.shareUri,
        'application/json',
        '分享导出文件',
        exportedFile.fileName,
        'SceneLens 导出数据'
      );

      if (!opened) {
        await Share.share(
          {
            title: exportedFile.fileName,
            message: `SceneLens 导出文件已生成：${exportedFile.shareUri}`,
          },
          {
            dialogTitle: '分享导出文件',
            subject: exportedFile.fileName,
          }
        );
        shareMode = 'text_fallback';
      } else {
        shareMode = 'file_attachment';
      }
    } else {
      await Share.share(
        {
          title: exportedFile.fileName,
          url: exportedFile.shareUri,
          message: `SceneLens 导出文件已生成：${exportedFile.shareUri}`,
        },
        {
          dialogTitle: '分享导出文件',
          subject: exportedFile.fileName,
        }
      );
      shareMode = 'file_attachment';
    }
    shareState = 'share_sheet_opened';
  } catch {
    shareState = 'saved_only';
    shareMode = 'not_shared';
  }

  return {
    ...exportedFile,
    shareState,
    shareMode,
  };
}

export function buildFeedbackIssueUrl(): string {
  const title = '反馈：请填写问题标题';
  const body = [
    '请描述你遇到的问题或建议：',
    '',
    '环境信息：',
    `- App: SceneLens ${APP_VERSION}`,
    `- Platform: ${Platform.OS} ${String(Platform.Version)}`,
    `- Package: ${APP_PACKAGE_NAME}`,
    '',
    '建议补充：',
    '- 触发场景：',
    '- 预期结果：',
    '- 实际结果：',
    '- 复现步骤：',
  ].join('\n');

  return `${SCENELENS_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
