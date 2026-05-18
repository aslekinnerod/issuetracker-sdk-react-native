import { describe, expect, it } from 'vitest';
import { isSdkErrorReason, type SdkErrorReason } from './errors';

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
