import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import {
  APP_PACKAGE_NAME,
  APP_VERSION,
  PRIVACY_POLICY_TEXT,
  SCENELENS_ISSUES_URL,
  exportDataWithBestEffortShare,
  buildFeedbackIssueUrl,
  persistExportData,
} from '../settingsSupport';

describe('settingsSupport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists export data into the app document directory', async () => {
    const now = new Date(2026, 2, 20, 12, 34, 56);

    const result = await persistExportData('{"ok":true}', now);

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-documents/scenelens-export-20260320-123456.json',
      '{"ok":true}',
      { encoding: 'utf8' }
    );
    expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith(
      'file:///mock-documents/scenelens-export-20260320-123456.json'
    );
    expect(result).toEqual({
      fileName: 'scenelens-export-20260320-123456.json',
      fileUri: 'file:///mock-documents/scenelens-export-20260320-123456.json',
      shareUri: 'content://mock-documents/scenelens-export-20260320-123456.json',
    });
  });

  it('marks export as share_sheet_opened when the native share sheet opens', async () => {
    const now = new Date(2026, 2, 20, 1, 2, 3);

    const result = await exportDataWithBestEffortShare('{"scene":"meeting"}', now);

    expect(Share.share).toHaveBeenCalledWith(
      {
        title: 'scenelens-export-20260320-010203.json',
        url: 'content://mock-documents/scenelens-export-20260320-010203.json',
        message:
          'SceneLens 导出文件已生成：content://mock-documents/scenelens-export-20260320-010203.json',
      },
      {
        dialogTitle: '分享导出文件',
        subject: 'scenelens-export-20260320-010203.json',
      }
    );
    expect(result.shareState).toBe('share_sheet_opened');
  });

  it('keeps truthful saved_only semantics when share cannot be opened', async () => {
    const shareMock = Share.share as jest.MockedFunction<typeof Share.share>;
    shareMock.mockRejectedValueOnce(new Error('share unavailable'));

    const result = await exportDataWithBestEffortShare('{"scene":"home"}', new Date(2026, 2, 20, 9, 0, 0));

    expect(result.shareState).toBe('saved_only');
    expect(result.fileUri).toBe('file:///mock-documents/scenelens-export-20260320-090000.json');
  });

  it('builds a real GitHub issues feedback URL with environment details', () => {
    const url = buildFeedbackIssueUrl();
    const decoded = decodeURIComponent(url);

    expect(url.startsWith(SCENELENS_ISSUES_URL)).toBe(true);
    expect(decoded).toContain(`- App: SceneLens ${APP_VERSION}`);
    expect(decoded).toContain(`- Package: ${APP_PACKAGE_NAME}`);
    expect(decoded).toContain('- Platform: android 34');
  });

  it('ships a concrete privacy policy instead of a placeholder', () => {
    expect(PRIVACY_POLICY_TEXT).toContain('隐私政策（当前版本）');
    expect(PRIVACY_POLICY_TEXT).toContain('本地设备完成');
    expect(PRIVACY_POLICY_TEXT).toContain('主动分享');
  });
});
