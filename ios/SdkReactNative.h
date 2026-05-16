#import <React/RCTEventEmitter.h>
#import <SdkReactNativeSpec/SdkReactNativeSpec.h>

// Inherits RCTEventEmitter so we can `sendEventWithName:body:` from
// the configure-time onConfigurationError handler into JS. The TurboModule
// spec protocol coexists fine — RCTEventEmitter is a plain NSObject
// subclass and the codegen-emitted protocol has no superclass clash.
// ADR-0003 Decision 9.
@interface SdkReactNative : RCTEventEmitter <NativeSdkReactNativeSpec>

@end
