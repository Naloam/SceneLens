package com.che1sy.scenelens.modules;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;

import java.util.ArrayList;

/**
 * OppoPermissionModule
 *
 * 针对 OPPO / ColorOS 设备的权限受阻跳转优化模块。
 *
 * 当用户两次拒绝运行时权限后，系统将不再弹出权限弹窗（权限受阻）。
 * 此模块利用 OPPO 提供的私有 Intent 参数，在跳转应用详情页时：
 *   1. 直接定位到权限管理页（跳过应用详情页中间步骤）
 *   2. 高亮闪烁对应受阻权限条目（仅单权限组时生效）
 *
 * 适用系统：ColorOS 14.0.1 及以上（OPPO FindX7 系列、A3 Pro、一加 Ace 3V 等）
 * 非 OPPO 设备会自动降级为标准应用详情页跳转。
 *
 * 文档参考：OPPO 开放平台《应用权限受阻跳转优化适配》
 */
@ReactModule(name = OppoPermissionModule.NAME)
public class OppoPermissionModule extends ReactContextBaseJavaModule {

    public static final String NAME = "OppoPermission";
    private static final String LOG_TAG = "OppoPermission";

    /**
     * OPPO 私有 Intent Extra 键：传入受阻权限列表（ArrayList<String>）
     * 元素为 android.Manifest.permission.* 原生权限字符串
     */
    private static final String EXTRA_PERMISSION_LIST = "permissionList";

    /**
     * OPPO 私有 Intent Extra 键：标识本次跳转为权限获取优化跳转
     * 传入 true 后系统将直接跳转至权限管理页并高亮受阻权限
     */
    private static final String EXTRA_IS_GET_PERMISSION = "isGetPermission";

    public OppoPermissionModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    // ==================== 公开 React Method ====================

    /**
     * 跳转到 OPPO 权限管理页（带高亮定位）
     *
     * 当设备为 OPPO/ColorOS 时，直接跳转至权限管理页并高亮受阻权限；
     * 非 OPPO 设备降级为标准应用详情页。
     *
     * @param permissions JS 传入的受阻权限数组，元素为 Android 原生权限字符串，
     *                    例如 ["android.permission.CAMERA"]
     *                    传入单一权限组内的权限时，跳转后会触发高亮闪烁效果。
     * @param promise     resolve(true) 表示成功启动 Intent；
     *                    reject 表示启动失败（如 Activity 为 null）
     *
     * 使用示例（JS 侧）：
     *   await OppoPermission.openOppoPermissionSettings(
     *     ['android.permission.CAMERA'],
     *   );
     */
    @ReactMethod
    public void openOppoPermissionSettings(ReadableArray permissions, Promise promise) {
        try {
            String packageName = getReactApplicationContext().getPackageName();

            // 将 JS ReadableArray 转换为 Java ArrayList<String>
            ArrayList<String> permissionList = new ArrayList<>();
            for (int i = 0; i < permissions.size(); i++) {
                String perm = permissions.getString(i);
                if (perm != null && !perm.isEmpty()) {
                    permissionList.add(perm);
                }
            }

            // 构建基础 Intent（标准应用详情页，OPPO 以此 Action 识别接入点）
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", packageName, null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // ---- OPPO 私有扩展参数（ColorOS 14.0.1+ 生效）----
            if (!permissionList.isEmpty()) {
                Bundle bundle = new Bundle();
                // 传入受阻权限列表
                bundle.putStringArrayList(EXTRA_PERMISSION_LIST, permissionList);
                intent.putExtras(bundle);
                // 传入跳转优化标识，触发直接跳转权限管理页逻辑
                intent.putExtra(EXTRA_IS_GET_PERMISSION, true);
                Log.d(LOG_TAG, "OPPO 权限跳转优化：传入权限列表 " + permissionList + ", ColorOS版本: " + getSystemProperty("ro.build.version.opporom"));
            } else {
                // 未传入权限列表时，仅跳转应用详情页（兜底行为）
                Log.w(LOG_TAG, "权限列表为空，降级为标准应用详情页跳转");
            }
            // ---- OPPO 私有扩展参数结束 ----

            getReactApplicationContext().startActivity(intent);
            Log.d(LOG_TAG, "成功启动权限设置页，packageName=" + packageName);
            promise.resolve(true);

        } catch (Exception e) {
            Log.e(LOG_TAG, "跳转权限设置页失败: " + e.getMessage(), e);
            promise.reject("ERR_OPPO_PERMISSION_SETTINGS", "跳转权限设置页失败: " + e.getMessage(), e);
        }
    }

    /**
     * 检测当前设备是否为 OPPO/ColorOS 设备
     *
     * 通过读取系统属性 ro.build.version.opporom 判断，
     * 该属性在 ColorOS 设备上存在且非空。
     *
     * @param promise resolve(true) 表示是 OPPO 设备，resolve(false) 表示非 OPPO 设备
     */
    @ReactMethod
    public void isOppoDevice(Promise promise) {
        try {
            // 方式1：读取 ColorOS 版本属性（最可靠）
            String colorOsVersion = getSystemProperty("ro.build.version.opporom");
            if (colorOsVersion != null && !colorOsVersion.isEmpty()) {
                Log.d(LOG_TAG, "检测到 ColorOS 设备，版本: " + colorOsVersion);
                promise.resolve(true);
                return;
            }

            // 方式2：检查厂商字段（兜底）
            String manufacturer = Build.MANUFACTURER;
            boolean isOppo = manufacturer != null &&
                    (manufacturer.equalsIgnoreCase("OPPO") ||
                     manufacturer.equalsIgnoreCase("OnePlus") ||
                     manufacturer.equalsIgnoreCase("realme"));

            Log.d(LOG_TAG, "厂商检测: manufacturer=" + manufacturer + ", isOppo=" + isOppo);
            promise.resolve(isOppo);

        } catch (Exception e) {
            Log.e(LOG_TAG, "设备检测失败: " + e.getMessage(), e);
            // 检测失败时保守返回 false，降级为标准跳转
            promise.resolve(false);
        }
    }

    /**
     * 获取当前设备的 ColorOS 版本号
     *
     * 可用于判断是否满足 ColorOS 14.0.1+ 的最低版本要求。
     *
     * @param promise resolve(String) 返回版本号字符串，如 "V14.0.1"；
     *                非 ColorOS 设备返回空字符串 ""
     */
    @ReactMethod
    public void getColorOsVersion(Promise promise) {
        try {
            String version = getSystemProperty("ro.build.version.opporom");
            Log.d(LOG_TAG, "ColorOS版本检测: " + version);
            promise.resolve(version != null ? version : "");
        } catch (Exception e) {
            Log.e(LOG_TAG, "获取 ColorOS 版本失败: " + e.getMessage(), e);
            promise.resolve("");
        }
    }

    // ==================== 私有工具方法 ====================

    /**
     * 通过反射读取 Android 系统属性
     *
     * @param key 系统属性键名
     * @return 属性值，读取失败时返回 null
     */
    private String getSystemProperty(String key) {
        try {
            Class<?> systemProperties = Class.forName("android.os.SystemProperties");
            java.lang.reflect.Method getMethod = systemProperties.getMethod("get", String.class);
            return (String) getMethod.invoke(null, key);
        } catch (Exception e) {
            Log.w(LOG_TAG, "读取系统属性失败 key=" + key + ": " + e.getMessage());
            return null;
        }
    }
}
