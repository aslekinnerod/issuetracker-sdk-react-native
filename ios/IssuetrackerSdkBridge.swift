import Foundation
import IssuetrackerSDK

/// @objc-friendly facade so the Obj-C++ TurboModule can call into the
/// Swift-only IssuetrackerSDK without each call site having to deal
/// with name-mangling or URL parsing.
@objc public class IssuetrackerSdkBridge: NSObject {

    @objc public static func configure(
        apiKey: String,
        shakeToReport: Bool,
        longPressToReport: Bool,
        enableCrashReporting: Bool
    ) {
        DispatchQueue.main.async {
            Issuetracker.configure(
                apiKey: apiKey,
                shakeToReport: shakeToReport,
                longPressToReport: longPressToReport,
                enableCrashReporting: enableCrashReporting
            )
        }
    }

    @objc public static func report() {
        DispatchQueue.main.async { Issuetracker.report() }
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
