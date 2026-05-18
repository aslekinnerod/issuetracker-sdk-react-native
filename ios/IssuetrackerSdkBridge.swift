import Foundation
import IssuetrackerSDK

/// @objc-friendly facade so the Obj-C++ TurboModule can call into the
/// Swift-only IssuetrackerSDK without each call site having to deal
/// with name-mangling or URL parsing.
@objc public class IssuetrackerSdkBridge: NSObject {

    /// Set by SdkReactNative.mm at configure-time. Receives the
    /// SdkErrorReason rawValue (matching the wire contract) which the
    /// .mm forwards to JS via `sendEventWithName:body:`. Lives here
    /// because the Swift `Issuetracker.configure(onConfigurationError:)`
    /// closure runs in the IssuetrackerSDK module's context and we
    /// need a way to bridge that into the Obj-C++ TurboModule.
    /// See ADR-0003 Decision 9.
    @objc public static var onConfigurationErrorHandler: ((String) -> Void)?

    @objc public static func configure(
        apiKey: String,
        shakeToReport: Bool,
        longPressToReport: Bool,
        enableCrashReporting: Bool,
        showOnboarding: Bool,
        terminatedTitle: String?,
        terminatedSubtitle: String?,
        terminatedCloseLabel: String?
    ) {
        // Build the optional TerminatedUiStrings only when the host app
        // actually provided something. All-nil means "use the SDK's
        // built-in English defaults" — same contract as on web and
        // Android. ADR-0003 Decision 9.
        let terminatedUI: TerminatedUiStrings? = {
            if terminatedTitle == nil && terminatedSubtitle == nil && terminatedCloseLabel == nil {
                return nil
            }
            return TerminatedUiStrings(
                title: terminatedTitle,
                subtitle: terminatedSubtitle,
                closeLabel: terminatedCloseLabel
            )
        }()
        DispatchQueue.main.async {
            Issuetracker.configure(
                apiKey: apiKey,
                shakeToReport: shakeToReport,
                longPressToReport: longPressToReport,
                enableCrashReporting: enableCrashReporting,
                onConfigurationError: { reason in
                    onConfigurationErrorHandler?(reason.rawValue)
                },
                showOnboarding: showOnboarding,
                terminatedUI: terminatedUI
            )
        }
    }

    @objc public static func report() {
        DispatchQueue.main.async { Issuetracker.report() }
    }

    @objc public static func showOnboarding() {
        DispatchQueue.main.async { Issuetracker.showOnboarding() }
    }

    @objc public static func identify(_ name: String) {
        Issuetracker.identify(name: name)
    }

    @objc public static func clearIdentity() {
        Issuetracker.clearIdentity()
    }

    @objc public static func recordAction(_ action: String, metadata: [String: String]?) {
        Issuetracker.recordAction(action, metadata: metadata)
    }

    @objc public static func testCrash() {
        // _testCrash returns Never; calling it from @objc is fine —
        // the process dies before the bridge frame is unwound.
        Issuetracker._testCrash()
    }
}
