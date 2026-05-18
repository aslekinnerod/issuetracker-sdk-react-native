import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeIssuetrackerSdk from './NativeSdkReactNative';
import { isSdkErrorReason, type SdkErrorReason } from './errors';

export type { SdkErrorReason };

export interface ConfigureOptions {
  apiKey: string;
  shakeToReport?: boolean;
  longPressToReport?: boolean;
  enableCrashReporting?: boolean;
  /**
   * Optional callback invoked once when the SDK transitions to the
   * terminated state because the underlying native SDK signalled a
   * non-recoverable failure (project deleted, API key revoked,
   * workspace suspended, etc. — see {@link SdkErrorReason}). Default
   * behaviour is silent; host apps may forward this to their own
   * telemetry. Once invoked, the SDK will not call the report endpoint
   * again for the lifetime of this install — recovery requires a fresh
   * `configure()` (typically an app relaunch). See ADR-0003 Decision 9.
   */
  onConfigurationError?: (reason: SdkErrorReason) => void;
  /**
   * If `true`, presents a one-time popover on first launch teaching
   * the user which gestures trigger the reporter — only the gestures
   * currently enabled are shown. Persisted per install by the native
   * iOS / Android SDKs so the popover never appears twice unless
   * {@link Issuetracker.showOnboarding} is called explicitly. With
   * both `shakeToReport` and `longPressToReport` disabled the popover
   * is silently skipped. Defaults to `false`.
   */
  showOnboarding?: boolean;
}

export type IssueReportType = 'bug' | 'task' | 'story';

const EVENT_NAME = 'Issuetracker_onConfigurationError';
const emitter = new NativeEventEmitter(
  NativeIssuetrackerSdk as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
);

let activeSubscription: EmitterSubscription | undefined;

/**
 * Public facade. Wraps the native iOS + Android Issuetracker SDKs.
 * All UI / triggers / network / lifecycle persistence live in the
 * native layer; this module is a bridge plus the JS-side event
 * abonnement that forwards onConfigurationError out to host apps.
 */
export const Issuetracker = {
  /**
   * Call once at app start (typically in App.tsx top-level).
   * Environment (production vs. staging) is derived from the apiKey
   * prefix — there is no endpoint to configure.
   */
  configure(options: ConfigureOptions): void {
    // Tear down any prior subscription so a re-configure() with a
    // different callback doesn't end up firing both. Subsequent
    // configure() calls are uncommon but the SDK doesn't forbid them.
    activeSubscription?.remove();
    activeSubscription = undefined;

    const cb = options.onConfigurationError;
    if (cb) {
      activeSubscription = emitter.addListener(EVENT_NAME, (reason: unknown) => {
        if (isSdkErrorReason(reason)) cb(reason);
      });
    }

    NativeIssuetrackerSdk.configure(
      options.apiKey,
      options.shakeToReport ?? true,
      options.longPressToReport ?? true,
      options.enableCrashReporting ?? true,
      options.showOnboarding ?? false
    );
  },

  /** Programmatic trigger — for an in-app "Report a bug" button. */
  report(): void {
    NativeIssuetrackerSdk.report();
  },

  /**
   * Re-presents the onboarding popover regardless of whether it has
   * been shown before on this install. Intended for a "Show
   * introduction again"-style entry in a host app's settings screen.
   * No-op if no gestures are enabled, or if called before configure().
   */
  showOnboarding(): void {
    NativeIssuetrackerSdk.showOnboarding();
  },

  /** Skip the "What should we call you?" prompt. */
  identify(name: string): void {
    NativeIssuetrackerSdk.identify(name);
  },

  clearIdentity(): void {
    NativeIssuetrackerSdk.clearIdentity();
  },

  /** Record one user action (max 5 retained, attached to next report). */
  recordAction(action: string, metadata?: Record<string, string>): void {
    NativeIssuetrackerSdk.recordAction(action, metadata ?? null);
  },

  /** Throws inside the native layer. SDK integration testing only. */
  testCrash(): void {
    NativeIssuetrackerSdk.testCrash();
  },
};
