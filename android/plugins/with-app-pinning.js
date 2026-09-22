/**
 * Config plugin for Quizary App Pinning (Screen Pinning / Lock Task).
 * - Creates Kotlin native module for startLockTask/stopLockTask
 * - No extra Android permissions needed for non-DO screen pinning
 * - Works with EAS Build development / preview / production
 *
 * startLockTask() is available since API 21, Expo minSdk is 24.
 * When is_restricted=false, module is idle. When true, JS calls startPinning()
 * right after createSubmission(). Unpin on submit/expire/close.
 */
const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_KT = `package com.qynatech.Quizary

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.MotionEvent
import android.view.ViewTreeObserver
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = "AppPinning")
class AppPinningModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "AppPinning"

    private var isObscuredByTouch = false
    private var isSecureEnabled = false
    private var focusChangeListener: ViewTreeObserver.OnWindowFocusChangeListener? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val checkRunnable = object : Runnable {
        override fun run() {
            if (!isSecureEnabled) return
            val activity = reactContext.currentActivity
            if (activity != null) {
                var floating = false
                var reason = ""
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    if (activity.isInPictureInPictureMode) { floating = true; reason = "pip" }
                    if (!floating && activity.isInMultiWindowMode) { floating = true; reason = "multi-window" }
                }
                if (!floating && !activity.hasWindowFocus()) {
                    floating = true
                    reason = "window-focus-lost"
                }
                if (!floating && isObscuredByTouch) {
                    floating = true
                    reason = "touch-obscured"
                }
                if (floating) {
                    sendEvent("onOverlayDetected", reason)
                }
            }
            mainHandler.postDelayed(this, 100)
        }
    }

    private fun sendEvent(eventName: String, params: Any?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun startPinning(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = reactContext.currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No current activity")
                    return@runOnUiThread
                }
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
                    promise.reject("UNSUPPORTED", "startLockTask requires API 21+")
                    return@runOnUiThread
                }
                activity.startLockTask()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun stopPinning(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = reactContext.currentActivity
                if (activity == null) {
                    // Already gone, consider unpinned
                    promise.resolve(true)
                    return@runOnUiThread
                }
                try {
                    activity.stopLockTask()
                } catch (_: Exception) {
                    // Not in lock task, ignore
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("STOP_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isPinned(promise: Promise) {
        try {
            val am = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val state = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.lockTaskModeState
            } else {
                @Suppress("DEPRECATION")
                if (am.isInLockTaskMode) ActivityManager.LOCK_TASK_MODE_PINNED else ActivityManager.LOCK_TASK_MODE_NONE
            }
            promise.resolve(state != ActivityManager.LOCK_TASK_MODE_NONE)
        } catch (e: Exception) {
            promise.reject("CHECK_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun hasOverlay(promise: Promise) {
        try {
            // Auto-check: PiP, multi-window, draw-over-other-apps, touch-obscured, or loss of window focus
            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.resolve(true)
                return
            }
            var floating = false
            var reason = ""
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                if (activity.isInPictureInPictureMode) { floating = true; reason = "pip" }
                if (!floating && activity.isInMultiWindowMode) { floating = true; reason = "multi-window" }
            }
            if (!floating && !activity.hasWindowFocus()) {
                floating = true
                reason = "window-focus-lost"
            }
            if (!floating && isObscuredByTouch) {
                floating = true
                reason = "touch-obscured"
            }
            promise.resolve(floating)
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun hasWindowFocus(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity != null) {
                promise.resolve(activity.hasWindowFocus())
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isInPipMode(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                promise.resolve(activity.isInPictureInPictureMode)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setSecureFlag(enable: Boolean, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = reactContext.currentActivity
                if (activity != null) {
                    val window = activity.window
                    isSecureEnabled = enable
                    if (enable) {
                        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
                        try {
                            try {
                                val m = window.decorView.javaClass.getMethod("setFilterTouchesWhenObfuscated", Boolean::class.javaPrimitiveType ?: java.lang.Boolean.TYPE)
                                m.invoke(window.decorView, true)
                            } catch (_: Exception) {}
                            window.decorView.setOnTouchListener { _, event ->
                                val flags = event.flags
                                val isObscured = (flags and MotionEvent.FLAG_WINDOW_IS_OBSCURED) != 0 ||
                                        (flags and MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) != 0
                                if (isObscured) {
                                    isObscuredByTouch = true
                                    sendEvent("onOverlayDetected", "touch-obscured")
                                }
                                false
                            }
                            if (focusChangeListener == null) {
                                focusChangeListener = ViewTreeObserver.OnWindowFocusChangeListener { hasFocus ->
                                    if (!hasFocus && isSecureEnabled) {
                                        sendEvent("onOverlayDetected", "window-focus-lost")
                                    }
                                }
                                window.decorView.viewTreeObserver.addOnWindowFocusChangeListener(focusChangeListener)
                            }
                        } catch (_: Exception) {}
                        mainHandler.removeCallbacks(checkRunnable)
                        mainHandler.post(checkRunnable)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        try {
                            try {
                                val m = window.decorView.javaClass.getMethod("setFilterTouchesWhenObfuscated", Boolean::class.javaPrimitiveType ?: java.lang.Boolean.TYPE)
                                m.invoke(window.decorView, false)
                            } catch (_: Exception) {}
                            window.decorView.setOnTouchListener(null)
                            if (focusChangeListener != null) {
                                window.decorView.viewTreeObserver.removeOnWindowFocusChangeListener(focusChangeListener)
                                focusChangeListener = null
                            }
                        } catch (_: Exception) {}
                        isObscuredByTouch = false
                        mainHandler.removeCallbacks(checkRunnable)
                    }
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("SECURE_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const PACKAGE_KT = `package com.qynatech.Quizary

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppPinningPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AppPinningModule(reactContext))
    }
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withAppPinningFiles(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    // Use actual package case from app.json: com.qynatech.Quizary
    const pkgDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'qynatech', 'Quizary');
    // During prebuild before android folder exists, skip file creation but keep plugin
    // The files will be created on next prebuild after android folder exists.
    // Also create them inside the plugin's expected location for EAS Build
    try {
      if (fs.existsSync(path.join(projectRoot, 'android'))) {
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'AppPinningModule.kt'), MODULE_KT);
        fs.writeFileSync(path.join(pkgDir, 'AppPinningPackage.kt'), PACKAGE_KT);
      }
    } catch (e) {
      console.warn('[with-app-pinning] could not write Kotlin files:', e.message);
    }

    // Also store templates for documentation / manual copy
    const pluginDir = path.join(projectRoot, 'plugins');
    try {
      fs.mkdirSync(path.join(projectRoot, 'src', 'modules', 'app-pinning'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, 'src', 'modules', 'app-pinning', 'AppPinningModule.kt.template'), MODULE_KT);
      fs.writeFileSync(path.join(projectRoot, 'src', 'modules', 'app-pinning', 'AppPinningPackage.kt.template'), PACKAGE_KT);
    } catch {}

    return cfg;
  }]);
}

function withAppPinningPackage(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const mainAppPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'qynatech', 'Quizary', 'MainApplication.kt');
    const mainAppJavaPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'qynatech', 'Quizary', 'MainApplication.java');

    for (const p of [mainAppPath, mainAppJavaPath]) {
      if (!fs.existsSync(p)) continue;
      let content = fs.readFileSync(p, 'utf8');
      if (content.includes('AppPinningPackage')) {
        // Already injected
        return cfg;
      }
      const isKt = p.endsWith('.kt');
      // 1) Add import robustly after package line
      if (!content.includes('AppPinningPackage')) {
        if (isKt) {
          // Try specific ReactPackage import first, fallback to package line
          if (content.includes('import com.facebook.react.ReactPackage')) {
            content = content.replace(
              'import com.facebook.react.ReactPackage',
              'import com.facebook.react.ReactPackage\nimport com.qynatech.Quizary.AppPinningPackage'
            );
          } else {
            content = content.replace(
              /package com\.qynatech\.Quizary/,
              'package com.qynatech.Quizary\nimport com.qynatech.Quizary.AppPinningPackage'
            );
          }
        } else {
          if (content.includes('import com.facebook.react.ReactPackage;')) {
            content = content.replace(
              'import com.facebook.react.ReactPackage;',
              'import com.facebook.react.ReactPackage;\nimport com.qynatech.Quizary.AppPinningPackage;'
            );
          } else {
            content = content.replace(
              /package com\.qynatech\.Quizary;/,
              'package com.qynatech.Quizary;\nimport com.qynatech.Quizary.AppPinningPackage;'
            );
          }
        }
      }
      // 2) Add package to list — handle multiple Expo 57 patterns
      let injected = false;
      if (isKt) {
        // Pattern A: val packages = PackageList(this).packages  (Expo 57 default)
        if (content.includes('PackageList(this).packages')) {
          content = content.replace(
            'PackageList(this).packages',
            'PackageList(this).packages.apply { add(AppPinningPackage()) }'
          );
          injected = true;
        }
        // Pattern B: PackageList(this).getPackages() or PackageList(application).packages
        if (!injected && content.includes('PackageList')) {
          // Generic fallback: append after first PackageList expression
          content = content.replace(
            /PackageList\([^)]+\)\.(packages|getPackages\(\))/,
            (m) => `${m}.let { it.apply { add(AppPinningPackage()) } }`
          );
          injected = content.includes('AppPinningPackage()');
        }
        // Pattern C: packages.add(...)
        if (!injected && content.includes('packages.add')) {
          content = content.replace('packages.add(', 'packages.add(AppPinningPackage()); packages.add(');
          injected = true;
        }
        // Pattern D: ReactHost / DefaultReactHost — inject via getPackages override
        if (!injected) {
          // Append before return packages or at end of getPackages function
          content = content.replace(
            /return packages/,
            'packages.add(AppPinningPackage())\n      return packages'
          );
          injected = content.includes('AppPinningPackage()');
        }
      } else {
        // Java
        if (content.includes('new PackageList(this).getPackages()')) {
          content = content.replace(
            'List<ReactPackage> packages = new PackageList(this).getPackages();',
            'List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new AppPinningPackage());'
          );
          injected = true;
        }
        if (!injected && content.includes('packages.add')) {
          content = content.replace('packages.add(', 'packages.add(new AppPinningPackage()); packages.add(');
          injected = true;
        }
      }
      if (!injected) {
        console.warn('[with-app-pinning] WARN: could not auto-inject AppPinningPackage into', p, '— please inject manually');
      }
      fs.writeFileSync(p, content);
      break;
    }
    return cfg;
  }]);
}

module.exports = (config) => withPlugins(config, [withAppPinningFiles, withAppPinningPackage]);
