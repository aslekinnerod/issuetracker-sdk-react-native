import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeIssuetrackerSdk from './NativeSdkReactNative';
import {
  isSdkErrorReason,
  isSdkErrorTerminal,
  type SdkErrorReason,
  type TerminatedUiStrings,
} from './errors';

export type { SdkErrorReason, TerminatedUiStrings };

export interface ConfigureOptions {
  apiKey: string;
  shakeToReport?: boolean;
  longPressToReport?: boolean;
  /**
   * If `true`, the native SDK registers a screen-reader custom action
   * ("Report a bug") while VoiceOver / TalkBack is running, giving
   * screen-reader users a gesture-free path to the reporter (the OS
   * screen reader typically claims the shake and multi-finger
   * gestures). See ADR-0008 Decision 2. Defaults to `false`.
   */
  accessibilityAction?: boolean;
  /**
   * If `true`, the native SDK renders a small floating "Report a bug"
   * button — a one-line path to a visible, WCAG-conformant entry
   * point for hosts that don't wire their own control to
   * {@link Issuetracker.report}. See ADR-0008 Decision 3. Defaults to
   * `false`.
   */
  showReportButton?: boolean;
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
   *
   * Fires at most once per registered callback. If the SDK is already
   * terminated when `configure()` runs, the callback passed to that
   * call is invoked with the original reason — a re-configure() never
   * reports a terminated SDK as healthy by staying silent.
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
  /**
   * Overrides for the TERMINATED-state UI text rendered by the
   * underlying native SDK. Useful for host apps that ship in non-
   * English locales — the SDK's built-in defaults are English. Any
   * field left undefined falls back to the default. See ADR-0003
   * Decision 9.
   */
  terminatedUI?: TerminatedUiStrings;
}

export type IssueReportType = 'bug' | 'task' | 'story';

const EVENT_NAME = 'Issuetracker_onConfigurationError';
const emitter = new NativeEventEmitter(
  NativeIssuetrackerSdk as unknown as ConstructorParameters<
    typeof NativeEventEmitter
  >[0]
);

let activeSubscription: EmitterSubscription | undefined;

/**
 * The reason the underlying native SDK went one-way TERMINATED, once
 * it has told us. First reason wins and it is never cleared: JS has no
 * business deciding the SDK is healthy again, and ADR-0003 Decision 9
 * makes recovery the native LifecycleStore's call, not ours.
 *
 * Module scope, so it dies with the JS context — the durable marker
 * lives in UserDefaults / SharedPreferences on the native side. This
 * is a cache of what native told us, never a second source of truth.
 */
let terminatedReason: SdkErrorReason | undefined;

/**
 * Re-entrancy guard for the replay below. A host that calls
 * configure() from inside its own onConfigurationError would otherwise
 * recurse: replay -> host configure() -> replay -> ...
 */
let replaying = false;

/**
 * Wraps the host callback so it hears about termination exactly once,
 * no matter how many times native re-emits (a rehydrated TERMINATED
 * state re-announcing itself on configure(), plus a mid-session submit
 * failure, is two emissions for one transition). `configure()`
 * documents this callback as fired once.
 */
function onceDeliverer(
  callback: (reason: SdkErrorReason) => void
): (reason: SdkErrorReason) => void {
  let delivered = false;
  return (reason) => {
    if (delivered) return;
    delivered = true;
    callback(reason);
  };
}

/**
 * Flags this JS surface accepts that the underlying native SDKs do not
 * forward yet — they need IssuetrackerSDK / no.issuetracker:sdk >= 0.7
 * (see the matching TODOs in ios/IssuetrackerSdkBridge.swift and
 * android/.../SdkReactNativeModule.kt, both of which accept and discard
 * them). `configure()` succeeds either way, so a host that asks for the
 * report button gets no error, no button, and no way to tell why. Warn
 * instead of throwing: rejecting would break apps already passing these.
 */
const NOT_YET_FORWARDED_BY_NATIVE = [
  'accessibilityAction',
  'showReportButton',
] as const;

const warnedFlags = new Set<string>();

function warnAboutUnsupportedFlags(options: ConfigureOptions): void {
  for (const flag of NOT_YET_FORWARDED_BY_NATIVE) {
    if (options[flag] !== true || warnedFlags.has(flag)) continue;
    // Development-time integration mistake; stay silent in release
    // builds rather than log on every host app's production console.
    if (typeof __DEV__ !== 'undefined' && !__DEV__) continue;
    warnedFlags.add(flag);
    console.warn(
      `[Issuetracker] configure({ ${flag}: true }) has no effect yet: the ` +
        'native iOS / Android SDKs this version bridges to ignore it until ' +
        'IssuetrackerSDK / no.issuetracker:sdk 0.7. configure() still ' +
        'succeeds — the feature is simply absent.'
    );
  }
}

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
    warnAboutUnsupportedFlags(options);

    // Tear down any prior subscription so a re-configure() with a
    // different callback doesn't end up firing both. Subsequent
    // configure() calls are uncommon but the SDK doesn't forbid them.
    activeSubscription?.remove();
    activeSubscription = undefined;

    const cb = options.onConfigurationError;
    const deliver = cb ? onceDeliverer(cb) : undefined;
    if (deliver) {
      activeSubscription = emitter.addListener(
        EVENT_NAME,
        (reason: unknown) => {
          // Defence in depth at the JS boundary. The native SDKs emit
          // this event only on the one-way OK -> TERMINATED transition,
          // so a recoverable reason (quota_exceeded / transient) or a
          // tester-gating rejection (ADR-0005) arriving here would be a
          // native-side regression — forwarding it would tell the host
          // app its project is gone when it is not. Unrecognised
          // strings are dropped for the same reason. ADR-0003 Decision 9.
          //
          // isSdkErrorTerminal, never !isSdkErrorRecoverable: the two
          // partitions differ on the ADR-0005 tester-gating reasons,
          // which are non-recoverable yet must NOT terminate. ITD-163.
          if (!isSdkErrorReason(reason) || !isSdkErrorTerminal(reason)) return;
          terminatedReason ??= reason; // first reason wins
          deliver(terminatedReason);
        }
      );
    }

    NativeIssuetrackerSdk.configure(
      options.apiKey,
      options.shakeToReport ?? true,
      options.longPressToReport ?? true,
      options.accessibilityAction ?? false,
      options.showReportButton ?? false,
      options.enableCrashReporting ?? true,
      options.showOnboarding ?? false,
      options.terminatedUI?.title ?? null,
      options.terminatedUI?.subtitle ?? null,
      options.terminatedUI?.closeLabel ?? null
    );

    // If native already told us it is dead, tell this callback too.
    // Without it a re-configure() — a locale toggle, a Fast Refresh
    // remount, a host wiring its telemetry hook late — hands the host
    // a fresh callback that never fires, and the host reads that
    // silence as a healthy SDK. Native persists TERMINATED across
    // launches and a re-configure() does not revive it (ADR-0003
    // Decision 9), so the silence would be a lie. Runs after the
    // native call so configure() has fully applied before the host
    // reacts, and is a no-op if the native side re-announced during
    // configure() — onceDeliverer collapses the two.
    if (deliver && terminatedReason !== undefined && !replaying) {
      replaying = true;
      try {
        deliver(terminatedReason);
      } finally {
        replaying = false;
      }
    }
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

  /**
   * Stores a tester attestation token (ADR-0005). On projects in
   * testers-only mode this is what unlocks the report triggers and
   * gets reports past the server; in open mode it stamps reports with
   * the tester's identity. The token will normally arrive from the
   * native companion-app transports; this API is the manual injection
   * point until those ship (and for integration tests).
   */
  setTesterToken(token: string, expiresAtMillis?: number): void {
    NativeIssuetrackerSdk.setTesterToken(token, expiresAtMillis ?? null);
  },

  /**
   * Removes the stored tester token. On testers-only projects the
   * gesture triggers go inert again from the next gesture.
   */
  clearTesterToken(): void {
    NativeIssuetrackerSdk.clearTesterToken();
  },

  /** Throws inside the native layer. SDK integration testing only. */
  testCrash(): void {
    NativeIssuetrackerSdk.testCrash();
  },
};
