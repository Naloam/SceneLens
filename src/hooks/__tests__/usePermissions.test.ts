import { shouldRefreshPermissionsOnForeground } from '../usePermissions';

describe('usePermissions foreground refresh guard', () => {
  it('refreshes when the app returns to active state', () => {
    expect(shouldRefreshPermissionsOnForeground('background', 'active')).toBe(true);
    expect(shouldRefreshPermissionsOnForeground('inactive', 'active')).toBe(true);
  });

  it('does not refresh for non-foreground transitions', () => {
    expect(shouldRefreshPermissionsOnForeground('active', 'active')).toBe(false);
    expect(shouldRefreshPermissionsOnForeground('active', 'background')).toBe(false);
    expect(shouldRefreshPermissionsOnForeground('background', 'inactive')).toBe(false);
  });
});
