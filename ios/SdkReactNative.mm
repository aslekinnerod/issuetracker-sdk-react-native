#import "SdkReactNative.h"
#import "SdkReactNative-Swift.h"

// ADR-0003 Decision 9 event name. Mirrored in src/index.tsx — keep
// them in sync if either side changes.
static NSString *const IssuetrackerEventConfigurationError = @"Issuetracker_onConfigurationError";

@implementation SdkReactNative

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[IssuetrackerEventConfigurationError];
}

- (void)configure:(NSString *)apiKey
    shakeToReport:(BOOL)shakeToReport
longPressToReport:(BOOL)longPressToReport
enableCrashReporting:(BOOL)enableCrashReporting
   showOnboarding:(BOOL)showOnboarding
  terminatedTitle:(NSString * _Nullable)terminatedTitle
terminatedSubtitle:(NSString * _Nullable)terminatedSubtitle
terminatedCloseLabel:(NSString * _Nullable)terminatedCloseLabel
{
    // Wire the Swift bridge's static handler into this RCTEventEmitter
    // instance. Captured weakly so the module can be torn down without
    // leaking; if the JS side hasn't subscribed yet, `sendEventWithName:`
    // is a no-op rather than an error, which is fine — the underlying
    // native SDK still persists TERMINATED via its own LifecycleStore.
    __weak SdkReactNative *weakSelf = self;
    [IssuetrackerSdkBridge setOnConfigurationErrorHandler:^(NSString *reason) {
        [weakSelf sendEventWithName:IssuetrackerEventConfigurationError body:reason];
    }];
    [IssuetrackerSdkBridge configureWithApiKey:apiKey
                                  shakeToReport:shakeToReport
                              longPressToReport:longPressToReport
                            enableCrashReporting:enableCrashReporting
                                 showOnboarding:showOnboarding
                                terminatedTitle:terminatedTitle
                             terminatedSubtitle:terminatedSubtitle
                           terminatedCloseLabel:terminatedCloseLabel];
}

- (void)report
{
    [IssuetrackerSdkBridge report];
}

- (void)showOnboarding
{
    [IssuetrackerSdkBridge showOnboarding];
}

- (void)identify:(NSString *)name
{
    [IssuetrackerSdkBridge identify:name];
}

- (void)clearIdentity
{
    [IssuetrackerSdkBridge clearIdentity];
}

- (void)recordAction:(NSString *)action metadata:(NSDictionary *)metadata
{
    NSDictionary<NSString *, NSString *> *typed = nil;
    if ([metadata isKindOfClass:[NSDictionary class]]) {
        typed = (NSDictionary<NSString *, NSString *> *)metadata;
    }
    [IssuetrackerSdkBridge recordAction:action metadata:typed];
}

- (void)testCrash
{
    [IssuetrackerSdkBridge testCrash];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeSdkReactNativeSpecJSI>(params);
}

+ (NSString *)moduleName
{
    return @"SdkReactNative";
}

@end
