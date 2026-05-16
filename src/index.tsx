import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeIssuetrackerSdk from './NativeSdkReactNative';

/**
 * Machine-readable reason for an SDK-callable failure. String values
 * match the server-side `SdkErrorReasonSchema` in
 * `@issuetracker/shared` byte-for-byte — they are the wire contract
 * across all five SDKs. See ADR-0003 Decision 9.
 */
export type SdkErrorReason =
  | 'project_deleted'
  | 'project_not_found'
  | 'api_key_revoked'
  | 'workspace_suspended'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'transient';

const SDK_ERROR_REASONS: ReadonlySet<string> = new Set<SdkErrorReason>([
  'project_deleted',
  'project_not_found',
  'api_key_revoked',
  'workspace_suspended',
  'invalid_api_key',
  'quota_exceeded',
  'transient',
]);

function isSdkErrorReason(value: unknown): value is SdkErrorReason {
  return typeof value === 'string' && SDK_ERROR_REASONS.has(value);
}

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
}

export type IssueReportType = 'bug' | 'task' | 'story';

const EVENT_NAME = 'Issuetracker_onConfigurationError';
const emitter = new NativeEventEmitter(
  NativeIssuetrackerSdk as unknown as Parameters<typeof NativeEventEmitter>[0],
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
      options.enableCrashReporting ?? true
    );
  },

  /** Programmatic trigger — for an in-app "Report a bug" button. */
  report(): void {
    NativeIssuetrackerSdk.report();
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
