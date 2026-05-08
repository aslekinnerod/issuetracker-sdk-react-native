import NativeIssuetrackerSdk from './NativeSdkReactNative';

export interface ConfigureOptions {
  apiKey: string;
  endpoint: string;
  shakeToReport?: boolean;
  longPressToReport?: boolean;
  enableCrashReporting?: boolean;
}

export type IssueReportType = 'bug' | 'task' | 'story';

/**
 * Public facade. Wraps the native iOS + Android Issuetracker SDKs.
 * All functionality (UI, screenshot, shake-detect, crash-detect)
 * lives in the native layer; this is a pass-through bridge.
 */
export const Issuetracker = {
  /**
   * Call once at app start (typically in App.tsx top-level).
   *
   * @param options.apiKey  Raw API key from the Issuetracker web admin.
   * @param options.endpoint  Base URL, e.g. https://api.issuetracker.no/v1
   */
  configure(options: ConfigureOptions): void {
    NativeIssuetrackerSdk.configure(
      options.apiKey,
      options.endpoint,
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
