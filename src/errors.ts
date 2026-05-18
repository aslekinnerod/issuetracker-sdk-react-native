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
