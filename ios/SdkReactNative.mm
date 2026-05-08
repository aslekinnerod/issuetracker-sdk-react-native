#import "SdkReactNative.h"
#import "SdkReactNative-Swift.h"

@implementation SdkReactNative

RCT_EXPORT_MODULE()

- (void)configure:(NSString *)apiKey
         endpoint:(NSString *)endpoint
    shakeToReport:(BOOL)shakeToReport
longPressToReport:(BOOL)longPressToReport
enableCrashReporting:(BOOL)enableCrashReporting
{
    [IssuetrackerSdkBridge configureWithApiKey:apiKey
                                       endpoint:endpoint
                                  shakeToReport:shakeToReport
                              longPressToReport:longPressToReport
                            enableCrashReporting:enableCrashReporting];
}

- (void)report
{
    [IssuetrackerSdkBridge report];
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
