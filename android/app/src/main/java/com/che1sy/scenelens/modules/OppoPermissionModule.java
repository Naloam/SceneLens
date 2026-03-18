package com.che1sy.scenelens.modules;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;

import java.lang.reflect.Method;
import java.util.ArrayList;

@ReactModule(name = OppoPermissionModule.NAME)
public class OppoPermissionModule extends ReactContextBaseJavaModule {
    public static final String NAME = "OppoPermission";
    private static final String EXTRA_PERMISSION_LIST = "permissionList";
    private static final String EXTRA_IS_GET_PERMISSION = "isGetPermission";

    public OppoPermissionModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void openOppoPermissionSettings(ReadableArray permissions, Promise promise) {
        try {
            String packageName = getReactApplicationContext().getPackageName();
            ArrayList<String> permissionList = new ArrayList<>();

            for (int index = 0; index < permissions.size(); index++) {
                String permission = permissions.getString(index);
                if (permission != null && !permission.isEmpty()) {
                    permissionList.add(permission);
                }
            }

            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", packageName, null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (!permissionList.isEmpty()) {
                Bundle extras = new Bundle();
                extras.putStringArrayList(EXTRA_PERMISSION_LIST, permissionList);
                intent.putExtras(extras);
                intent.putExtra(EXTRA_IS_GET_PERMISSION, true);
            }

            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception exception) {
            promise.reject(
                "ERR_OPPO_PERMISSION_SETTINGS",
                "Failed to open OPPO permission settings: " + exception.getMessage(),
                exception
            );
        }
    }

    @ReactMethod
    public void isOppoDevice(Promise promise) {
        String colorOsVersion = getSystemProperty("ro.build.version.opporom");
        if (colorOsVersion != null && !colorOsVersion.isEmpty()) {
            promise.resolve(true);
            return;
        }

        String manufacturer = Build.MANUFACTURER;
        boolean isOppo = manufacturer != null && (
            manufacturer.equalsIgnoreCase("OPPO") ||
            manufacturer.equalsIgnoreCase("OnePlus") ||
            manufacturer.equalsIgnoreCase("realme")
        );
        promise.resolve(isOppo);
    }

    private String getSystemProperty(String key) {
        try {
            Class<?> systemProperties = Class.forName("android.os.SystemProperties");
            Method method = systemProperties.getMethod("get", String.class);
            return (String) method.invoke(null, key);
        } catch (Exception ignored) {
            return null;
        }
    }
}
