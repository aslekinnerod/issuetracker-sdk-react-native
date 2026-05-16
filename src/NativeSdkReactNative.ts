import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule spec — keep type signatures simple (primitives + flat
 * objects) so codegen produces clean Java/ObjC bindings. Metadata is
 * Object so codegen emits ReadableMap / NSDictionary, which both
 * native sides convert to Map<String,String>.
 */
export interface Spec extends TurboModule {
  configure(
    apiKey: string,
    shakeToReport: boolean,
    longPressToReport: boolean,
    enableCrashReporting: boolean
  ): void;
  report(): void;
  identify(name: string): void;
  clearIdentity(): void;
  recordAction(action: string, metadata: Object | null): void;
  testCrash(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SdkReactNative');
