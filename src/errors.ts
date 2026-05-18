/**
 * Machine-readable reason for an SDK-callable failure. String values
 * match the server-side `SdkErrorReasonSchema` in
 * `@issuetracker/shared` byte-for-byte — they are the wire contract
 * across all five SDKs. See ADR-0003 Decision 9.
 *
 * Recoverable reasons (`quota_exceeded`, `transient`) keep the SDK in
 * the OK state; non-recoverable reasons transition the underlying
 * native SDK into one-way TERMINATED and surface via the
 * `onConfigurationError` host-app callback.
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

export function isSdkErrorReason(value: unknown): value is SdkErrorReason {
  return typeof value === 'string' && SDK_ERROR_REASONS.has(value);
}

/**
 * Strings shown when the underlying native SDK has been terminated
 * and a test-cohort user opens the reporting surface. ADR-0003
 * Decision 9 mandates a localised terminal message; English is the
 * built-in default on the native side, and host apps may inject
 * translations via `Issuetracker.configure({ terminatedUI })`.
 *
 * Each field is optional — fields the host doesn't override fall back
 * to English. A missing entire object falls back to all-English.
 */
export interface TerminatedUiStrings {
  /** Big headline. Default: "Bug reporting is no longer available." */
  title?: string;
  /** One-line follow-up. Default: "Contact your team." */
  subtitle?: string;
  /** Close-button label. Default: "Close". */
  closeLabel?: string;
}
