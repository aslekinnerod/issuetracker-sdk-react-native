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
  | 'transient'
  | 'tester_attestation_required'
  | 'tester_token_invalid';

const SDK_ERROR_REASONS: ReadonlySet<string> = new Set<SdkErrorReason>([
  'project_deleted',
  'project_not_found',
  'api_key_revoked',
  'workspace_suspended',
  'invalid_api_key',
  'quota_exceeded',
  'transient',
  'tester_attestation_required',
  'tester_token_invalid',
]);

const RECOVERABLE_REASONS: ReadonlySet<SdkErrorReason> = new Set([
  'quota_exceeded',
  'transient',
]);

// Tester-gating rejections (ADR-0005) are non-recoverable — retrying
// the same request cannot succeed — but they are NOT terminal: the
// project is alive, the key is valid, only this install lacks (valid)
// attestation. The SDK must never flip to TERMINATED on them, so they
// must never reach the host's onConfigurationError callback either.
//
// Built from RECOVERABLE_REASONS rather than re-listing them, so the
// structural invariant "every recoverable reason is non-terminal"
// cannot drift when a reason is added to one list and forgotten in
// the other. Terminal is deliberately NOT the complement of
// recoverable — that conflation is what made sdk-web's submit path
// kill an SDK the rest of the fleet kept alive (ITD-163).
const NON_TERMINAL_REASONS: ReadonlySet<SdkErrorReason> = new Set([
  ...RECOVERABLE_REASONS,
  'tester_attestation_required',
  'tester_token_invalid',
]);

export function isSdkErrorReason(value: unknown): value is SdkErrorReason {
  return typeof value === 'string' && SDK_ERROR_REASONS.has(value);
}

/** Mirrors `isSdkErrorRecoverable` in sdk-web and `isRecoverable` in sdk-android. */
export function isSdkErrorRecoverable(reason: SdkErrorReason): boolean {
  return RECOVERABLE_REASONS.has(reason);
}

/**
 * Whether this reason is one of the five that flip the underlying
 * native SDK into one-way TERMINATED, and therefore the only ones
 * ADR-0003 Decision 9 allows through `onConfigurationError`. Mirrors
 * `isSdkErrorTerminal` in sdk-web and `isTerminal` in sdk-android.
 */
export function isSdkErrorTerminal(reason: SdkErrorReason): boolean {
  return !NON_TERMINAL_REASONS.has(reason);
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
