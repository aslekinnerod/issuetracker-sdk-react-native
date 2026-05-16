package com.issuetracker.sdkreactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import io.issuetracker.sdk.Issuetracker

class SdkReactNativeModule(reactContext: ReactApplicationContext) :
  NativeSdkReactNativeSpec(reactContext) {

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
    )
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
