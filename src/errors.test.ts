import { describe, expect, it } from 'vitest';
import {
  isSdkErrorReason,
  isSdkErrorRecoverable,
  isSdkErrorTerminal,
  type SdkErrorReason,
} from './errors';

// Contract tests for the SDK error wire format. The values here MUST
// match @issuetracker/shared SdkErrorReasonSchema byte-for-byte — any
// drift breaks the host-app onConfigurationError callback. The
// JS-side guard is the last line of defence before invoking the host
// callback; the underlying iOS / Android SDKs already filter on the
// same enum, but a regression in the native event-bridge could leak
// arbitrary strings through.
//
// Mirrors the suites in sdk-web/src/errors.test.ts,
// sdk-ios/Tests/IssuetrackerSDKTests/SdkErrorReasonTests.swift, and
// sdk-android/.../SdkErrorReasonTest.kt. Keep them in lockstep.
//
// See ADR-0003 Decision 9.

const CANONICAL: SdkErrorReason[] = [
  'project_deleted',
  'project_not_found',
  'api_key_revoked',
  'workspace_suspended',
  'invalid_api_key',
  'quota_exceeded',
  'transient',
  'tester_attestation_required',
  'tester_token_invalid',
];

describe('isSdkErrorReason', () => {
  it.each(CANONICAL)('accepts canonical reason %s', (reason) => {
    expect(isSdkErrorReason(reason)).toBe(true);
  });

  it.each([
    'workspace_deleted', // misnomer — must NOT match
    'WORKSPACE_SUSPENDED', // wrong casing
    '',
    null,
    undefined,
    42,
    true,
    { error: 'project_deleted' },
    ['project_deleted'],
  ])('rejects %s', (value) => {
    expect(isSdkErrorReason(value)).toBe(false);
  });
});

// The recoverable / terminal split is the part of the contract the
// host app actually feels: only a terminal reason may surface as
// onConfigurationError, because only a terminal reason means the
// native SDK has flipped into one-way TERMINATED. Byte-identical to
// sdk-web's isSdkErrorTerminal and sdk-android's
// SdkErrorReason.isTerminal.
describe('isSdkErrorRecoverable', () => {
  it.each<SdkErrorReason>(['quota_exceeded', 'transient'])(
    'treats %s as recoverable',
    (reason) => {
      expect(isSdkErrorRecoverable(reason)).toBe(true);
    }
  );

  it.each<SdkErrorReason>([
    'project_deleted',
    'project_not_found',
    'api_key_revoked',
    'workspace_suspended',
    'invalid_api_key',
    'tester_attestation_required',
    'tester_token_invalid',
  ])('treats %s as non-recoverable', (reason) => {
    expect(isSdkErrorRecoverable(reason)).toBe(false);
  });
});

describe('isSdkErrorTerminal', () => {
  it.each<SdkErrorReason>([
    'project_deleted',
    'project_not_found',
    'api_key_revoked',
    'workspace_suspended',
    'invalid_api_key',
  ])('terminates on %s', (reason) => {
    expect(isSdkErrorTerminal(reason)).toBe(true);
  });

  // Non-recoverable but NOT terminal: the project is alive and the key
  // is valid, this install just lacks (valid) tester attestation.
  it.each<SdkErrorReason>([
    'quota_exceeded',
    'transient',
    'tester_attestation_required',
    'tester_token_invalid',
  ])('does not terminate on %s', (reason) => {
    expect(isSdkErrorTerminal(reason)).toBe(false);
  });

  // ITD-163. sdk-web's submit path used `!details.recoverable` as its
  // termination test while every other path in the fleet used the
  // terminal predicate. The two are not the same partition, and the
  // gap is exactly the ADR-0005 tester-gating reasons: non-recoverable
  // (retrying cannot help) but the project is alive, so terminating on
  // them would permanently kill an SDK the other paths keep running.
  it('is not the complement of recoverability', () => {
    const misclassified = CANONICAL.filter(
      (r) => !isSdkErrorRecoverable(r) !== isSdkErrorTerminal(r)
    );
    expect(misclassified.sort()).toEqual([
      'tester_attestation_required',
      'tester_token_invalid',
    ]);
  });

  it('treats every recoverable reason as non-terminal', () => {
    // The one direction that IS an invariant: nothing the SDK may
    // retry can also be a reason to stop forever.
    const recoverable = CANONICAL.filter(isSdkErrorRecoverable);
    expect(recoverable.length).toBeGreaterThan(0);
    for (const reason of recoverable) {
      expect(isSdkErrorTerminal(reason), reason).toBe(false);
    }
  });

  it('classifies every canonical reason exactly once', () => {
    const terminal = CANONICAL.filter(isSdkErrorTerminal);
    const nonTerminal = CANONICAL.filter((r) => !isSdkErrorTerminal(r));
    expect(terminal).toHaveLength(5);
    expect(nonTerminal).toHaveLength(4);
  });
});
