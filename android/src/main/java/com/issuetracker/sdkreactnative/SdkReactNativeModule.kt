package com.issuetracker.sdkreactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import no.issuetracker.sdk.Issuetracker
import no.issuetracker.sdk.TerminatedUiStrings

class SdkReactNativeModule(reactContext: ReactApplicationContext) :
  NativeSdkReactNativeSpec(reactContext) {

  // ADR-0003 Decision 9 event name. Mirrored in src/index.tsx — keep
  // them in sync if either side changes.
  private val configurationErrorEvent = "Issuetracker_onConfigurationError"

  override fun configure(
    apiKey: String,
    shakeToReport: Boolean,
    longPressToReport: Boolean,
    accessibilityAction: Boolean,
    showReportButton: Boolean,
    enableCrashReporting: Boolean,
    showOnboarding: Boolean,
    terminatedTitle: String?,
    terminatedSubtitle: String?,
    terminatedCloseLabel: String?,
  ) {
    val app = reactApplicationContext.applicationContext as android.app.Application
    // Build TerminatedUiStrings only when the host app provided
    // something. All-null means "use the SDK's built-in English
    // defaults" — same contract as on iOS and web. ADR-0003 Decision 9.
    val terminatedUI: TerminatedUiStrings? = if (
      terminatedTitle == null && terminatedSubtitle == null && terminatedCloseLabel == null
    ) {
      null
    } else {
      TerminatedUiStrings(
        title = terminatedTitle,
        subtitle = terminatedSubtitle,
        closeLabel = terminatedCloseLabel,
      )
    }
    // TODO: requires no.issuetracker:sdk >= 0.7 — forward
    // accessibilityAction / showReportButton once the native SDK's
    // configure() gains the ADR-0008 flags. Accepted-and-ignored until
    // then so the JS surface can ship ahead of the native release.
    Issuetracker.configure(
      application = app,
      apiKey = apiKey,
      shakeToReport = shakeToReport,
      longPressToReport = longPressToReport,
      enableCrashReporting = enableCrashReporting,
      onConfigurationError = { reason ->
        // Emit to JS via RCTDeviceEventEmitter. If JS hasn't subscribed
        // yet, RN drops the event silently — the underlying native SDK
        // still persists TERMINATED via its own LifecycleStore, so the
        // user-visible UI is unaffected.
        //
        // The native SDK holds this closure for the life of the
        // process, which can outlive the React context (dev reload, or
        // a hybrid host tearing the RN instance down), and it invokes
        // it from its own background thread. On the bridge
        // architecture getJSModule() throws IllegalStateException
        // ("Tried to access a JS module after the React instance was
        // destroyed") in that window, which would take the host app
        // down on a code path whose whole purpose is to fail
        // gracefully. Guard + swallow: a dropped event is the correct
        // trade, TERMINATED is persisted natively either way.
        val ctx = reactApplicationContext
        if (ctx.hasActiveReactInstance()) {
          runCatching { ctx.emitDeviceEvent(configurationErrorEvent, reason.rawValue) }
        }
      },
      showOnboarding = showOnboarding,
      terminatedUI = terminatedUI,
    )
  }

  override fun showOnboarding() {
    Issuetracker.showOnboarding()
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

  override fun setTesterToken(token: String, expiresAtMillis: Double?) {
    Issuetracker.setTesterToken(token, expiresAtMillis?.toLong())
  }

  override fun clearTesterToken() {
    Issuetracker.clearTesterToken()
  }

  override fun testCrash() {
    Issuetracker.testCrash()
  }

  companion object {
    const val NAME = NativeSdkReactNativeSpec.NAME
  }
}
