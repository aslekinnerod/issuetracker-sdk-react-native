package com.issuetracker.sdkreactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import no.issuetracker.sdk.Issuetracker

class SdkReactNativeModule(reactContext: ReactApplicationContext) :
  NativeSdkReactNativeSpec(reactContext) {

  // ADR-0003 Decision 9 event name. Mirrored in src/index.tsx — keep
  // them in sync if either side changes.
  private val configurationErrorEvent = "Issuetracker_onConfigurationError"

  override fun configure(
    apiKey: String,
    shakeToReport: Boolean,
    longPressToReport: Boolean,
    enableCrashReporting: Boolean,
  ) {
    val app = reactApplicationContext.applicationContext as android.app.Application
    Issuetracker.configure(
      application = app,
      apiKey = apiKey,
      shakeToReport = shakeToReport,
      longPressToReport = longPressToReport,
      enableCrashReporting = enableCrashReporting,
      onConfigurationError = { reason ->
        // Emit on the JS thread via DeviceEventManagerModule. If JS
        // hasn't subscribed yet, RN drops the event silently — the
        // underlying native SDK still persists TERMINATED via its
        // own LifecycleStore, so the user-visible UI is unaffected.
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(configurationErrorEvent, reason.rawValue)
      },
    )
  }

  // Required for NativeEventEmitter on the JS side. No-op
  // implementations are fine — the spec contract is satisfied and the
  // actual event plumbing happens via DeviceEventManagerModule above.
  override fun addListener(eventName: String) {
    // intentionally empty
  }

  override fun removeListeners(count: Double) {
    // intentionally empty
  }

  override fun report() {
    Issuetracker.report()
  }

  override fun identify(name: String) {
    Issuetracker.identify(name)
  }

  override fun clearIdentity() {
    Issuetracker.clearIdentity()
  }

  override fun recordAction(action: String, metadata: ReadableMap?) {
    val map: Map<String, String>? = metadata?.let { rm ->
      val out = mutableMapOf<String, String>()
      val it = rm.keySetIterator()
      while (it.hasNextKey()) {
        val k = it.nextKey()
        val v = rm.getString(k)
        if (v != null) out[k] = v
      }
      out.takeIf { it.isNotEmpty() }
    }
    Issuetracker.recordAction(action, map)
  }

  override fun testCrash() {
    Issuetracker.testCrash()
  }

  companion object {
    const val NAME = NativeSdkReactNativeSpec.NAME
  }
}
