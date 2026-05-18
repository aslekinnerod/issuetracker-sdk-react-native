import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule spec — keep type signatures simple (primitives + flat
 * objects) so codegen produces clean Java/ObjC bindings. Metadata is
 * Object so codegen emits ReadableMap / NSDictionary, which both
 * native sides convert to Map<String,String>.
 *
 * `addListener` / `removeListeners` are required for the
 * `NativeEventEmitter` plumbing — JS uses them to start and stop
 * receiving the `Issuetracker_onConfigurationError` event emitted by
 * the native side when the SDK transitions to TERMINATED. See
 * ADR-0003 Decision 9.
 */
export interface Spec extends TurboModule {
  configure(
    apiKey: string,
    shakeToReport: boolean,
    longPressToReport: boolean,
    enableCrashReporting: boolean,
    showOnboarding: boolean,
    terminatedTitle: string | null,
    terminatedSubtitle: string | null,
    terminatedCloseLabel: string | null
  ): void;
  report(): void;
  showOnboarding(): void;
  identify(name: string): void;
  clearIdentity(): void;
  recordAction(action: string, metadata: Object | null): void;
  testCrash(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SdkReactNative');
