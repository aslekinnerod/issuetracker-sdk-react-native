import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SdkErrorReason } from './errors';

// ADR-0003 Decision 9 contract tests for the React Native bridge.
//
// The RN SDK is a thin facade: the lifecycle state machine, the
// on-disk TERMINATED marker, the queue purge, the trigger teardown and
// the terminal UI all live in the native iOS / Android SDKs (and are
// covered by their own suites). What this package owns — and what
// therefore has to be tested here — is:
//
//   1. that a terminal reason emitted by the native side actually
//      reaches the host app's JS `onConfigurationError` callback,
//   2. that a non-terminal reason does NOT (a host that disables its
//      bug-report entry point on `quota_exceeded` is a bug we would
//      have shipped from here),
//   3. that repeated `configure()` calls don't leak subscriptions or
//      double-fire, and
//   4. that the JS surface offers no way back out of TERMINATED.
//
// Mirrors the suites in sdk-web/src/lifecycle.test.ts,
// sdk-ios/Tests/IssuetrackerSDKTests/LifecycleStoreTests.swift and
// sdk-android/.../LifecycleStoreTest.kt. Keep them in lockstep.

const EVENT_NAME = 'Issuetracker_onConfigurationError';

// Reasons that flip the native SDK into one-way TERMINATED. These are
// exactly the reasons ADR-0003 Decision 9 allows through
// onConfigurationError.
const TERMINAL_REASONS: SdkErrorReason[] = [
  'project_deleted',
  'project_not_found',
  'api_key_revoked',
  'workspace_suspended',
  'invalid_api_key',
];

// Recoverable (quota / transient) plus the ADR-0005 tester-gating
// rejections: non-recoverable, but the project is alive and the key is
// valid, so they must never be reported as a configuration error.
const NON_TERMINAL_REASONS: SdkErrorReason[] = [
  'quota_exceeded',
  'transient',
  'tester_attestation_required',
  'tester_token_invalid',
];

const mocks = vi.hoisted(() => {
  type Listener = (body: unknown) => void;

  const state = {
    emitterConstructions: 0,
    emitterModuleArg: undefined as unknown,
    listeners: new Map<number, { event: string; listener: Listener }>(),
    nextId: 1,
  };

  const native = {
    configure: vi.fn(),
    report: vi.fn(),
    showOnboarding: vi.fn(),
    identify: vi.fn(),
    clearIdentity: vi.fn(),
    recordAction: vi.fn(),
    setTesterToken: vi.fn(),
    clearTesterToken: vi.fn(),
    testCrash: vi.fn(),
    addListener: vi.fn(),
    removeListeners: vi.fn(),
  };

  // Stands in for RN's NativeEventEmitter, including the bit that
  // matters for leak detection: addListener/removeListeners are
  // forwarded to the native module, and remove() is idempotent.
  class FakeNativeEventEmitter {
    constructor(nativeModule: unknown) {
      state.emitterConstructions += 1;
      state.emitterModuleArg = nativeModule;
    }

    addListener(event: string, listener: Listener) {
      native.addListener(event);
      const id = state.nextId++;
      state.listeners.set(id, { event, listener });
      return {
        remove: () => {
          if (state.listeners.delete(id)) native.removeListeners(1);
        },
      };
    }
  }

  return { state, native, FakeNativeEventEmitter };
});

vi.mock('react-native', () => ({
  NativeEventEmitter: mocks.FakeNativeEventEmitter,
}));

vi.mock('./NativeSdkReactNative', () => ({ default: mocks.native }));

type SdkModule = typeof import('./index');

/**
 * Re-imports the facade from scratch. Module-scope state (the
 * NativeEventEmitter instance and the active subscription) is rebuilt,
 * which is the closest a JS-only suite gets to a process restart.
 */
async function loadSdk(): Promise<SdkModule> {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.state.listeners.clear();
  mocks.state.nextId = 1;
  mocks.state.emitterConstructions = 0;
  return import('./index');
}

/** Simulates the native side emitting on the configuration-error event. */
function emitFromNative(body: unknown, event: string = EVENT_NAME): void {
  for (const entry of [...mocks.state.listeners.values()]) {
    if (entry.event === event) entry.listener(body);
  }
}

function activeListenerCount(): number {
  return mocks.state.listeners.size;
}

const CONFIGURE_ARG = {
  apiKey: 0,
  shakeToReport: 1,
  longPressToReport: 2,
  accessibilityAction: 3,
  showReportButton: 4,
  enableCrashReporting: 5,
  showOnboarding: 6,
  terminatedTitle: 7,
  terminatedSubtitle: 8,
  terminatedCloseLabel: 9,
} as const;

function lastConfigureArgs(): unknown[] {
  const calls = mocks.native.configure.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as unknown[];
}

let sdk: SdkModule;

beforeEach(async () => {
  sdk = await loadSdk();
});

describe('onConfigurationError reaches JS', () => {
  it.each(TERMINAL_REASONS)(
    'forwards the terminal reason %s to the host callback',
    (reason) => {
      const onConfigurationError = vi.fn();
      sdk.Issuetracker.configure({ apiKey: 'it_dev_x', onConfigurationError });

      emitFromNative(reason);

      expect(onConfigurationError).toHaveBeenCalledTimes(1);
      expect(onConfigurationError).toHaveBeenCalledWith(reason);
    }
  );

  it('subscribes to exactly the event name the native modules emit', () => {
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: vi.fn(),
    });

    expect(mocks.native.addListener).toHaveBeenCalledTimes(1);
    expect(mocks.native.addListener).toHaveBeenCalledWith(EVENT_NAME);
  });

  it('subscribes before handing control to native, so a synchronous terminal error is not missed', () => {
    // The native SDK can rehydrate a persisted TERMINATED state inside
    // configure() and fire the callback straight away; if JS subscribed
    // afterwards the event would be dropped on the floor.
    const order: string[] = [];
    mocks.native.addListener.mockImplementation(() => order.push('subscribe'));
    mocks.native.configure.mockImplementation(() => order.push('configure'));

    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: vi.fn(),
    });

    expect(order).toEqual(['subscribe', 'configure']);
  });

  it('does not subscribe at all when the host passes no callback', () => {
    sdk.Issuetracker.configure({ apiKey: 'it_dev_x' });

    expect(mocks.native.addListener).not.toHaveBeenCalled();
    expect(activeListenerCount()).toBe(0);
  });

  it('creates the NativeEventEmitter once per module load, not per configure()', () => {
    for (let i = 0; i < 5; i++) {
      sdk.Issuetracker.configure({
        apiKey: 'it_dev_x',
        onConfigurationError: vi.fn(),
      });
    }

    expect(mocks.state.emitterConstructions).toBe(1);
  });
});

describe('non-terminal reasons must not be reported as configuration errors', () => {
  it.each(NON_TERMINAL_REASONS)(
    'ignores %s (quota / transient / tester-gating are not TERMINATED)',
    (reason) => {
      const onConfigurationError = vi.fn();
      sdk.Issuetracker.configure({ apiKey: 'it_dev_x', onConfigurationError });

      emitFromNative(reason);

      expect(onConfigurationError).not.toHaveBeenCalled();
    }
  );

  it.each([
    'workspace_deleted', // misnomer, not on the wire contract
    'PROJECT_DELETED', // wrong casing
    '',
    null,
    undefined,
    42,
    true,
    { error: 'project_deleted' },
    ['project_deleted'],
  ])('ignores malformed event body %s without throwing', (body) => {
    const onConfigurationError = vi.fn();
    sdk.Issuetracker.configure({ apiKey: 'it_dev_x', onConfigurationError });

    expect(() => emitFromNative(body)).not.toThrow();
    expect(onConfigurationError).not.toHaveBeenCalled();
  });
});

describe('re-configure() does not leak subscriptions', () => {
  it('keeps exactly one active listener across repeated configure() calls', () => {
    for (let i = 0; i < 10; i++) {
      sdk.Issuetracker.configure({
        apiKey: 'it_dev_x',
        onConfigurationError: vi.fn(),
      });
    }

    expect(activeListenerCount()).toBe(1);
    expect(mocks.native.addListener).toHaveBeenCalledTimes(10);
    expect(mocks.native.removeListeners).toHaveBeenCalledTimes(9);
  });

  it('fires only the most recent callback after a re-configure', () => {
    const first = vi.fn();
    const second = vi.fn();

    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: first,
    });
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: second,
    });

    emitFromNative('project_deleted');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('tears the subscription down when a later configure() omits the callback', () => {
    const first = vi.fn();
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: first,
    });

    sdk.Issuetracker.configure({ apiKey: 'it_dev_x' });

    expect(activeListenerCount()).toBe(0);
    expect(mocks.native.removeListeners).toHaveBeenCalledTimes(1);

    emitFromNative('project_deleted');
    expect(first).not.toHaveBeenCalled();
  });

  it('delivers a terminal reason exactly once even after many re-configures', () => {
    const cb = vi.fn();
    for (let i = 0; i < 4; i++) {
      sdk.Issuetracker.configure({
        apiKey: 'it_dev_x',
        onConfigurationError: cb,
      });
    }

    emitFromNative('api_key_revoked');

    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('TERMINATED is one-way as far as JS is concerned', () => {
  it('exposes no API that could clear or resume the terminated state', () => {
    // Recovery is an explicit host-app re-init (in practice an app
    // relaunch), never a JS-callable reset. If a reset/resume ever gets
    // added, ADR-0003 Decision 9 has to be revisited first.
    expect(Object.keys(sdk.Issuetracker).sort()).toEqual([
      'clearIdentity',
      'clearTesterToken',
      'configure',
      'identify',
      'recordAction',
      'report',
      'setTesterToken',
      'showOnboarding',
      'testCrash',
    ]);
  });

  it('does not call back into native when a terminal reason arrives', () => {
    // No retry, no re-configure, no "clear terminated" round trip — the
    // native LifecycleStore is the authority and JS must not poke it.
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: vi.fn(),
    });
    mocks.native.configure.mockClear();

    emitFromNative('project_deleted');

    for (const [name, fn] of Object.entries(mocks.native)) {
      if (name === 'addListener' || name === 'removeListeners') continue;
      expect(fn, `native.${name} should not be called`).not.toHaveBeenCalled();
    }
  });

  it('still delegates report() to native after termination', () => {
    // The terminal UI ("Bug reporting is no longer available") is
    // rendered by the native SDK when the user opens the reporting
    // surface. Swallowing report() in JS would leave the tester with a
    // dead button and no explanation.
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: vi.fn(),
    });
    emitFromNative('project_deleted');

    sdk.Issuetracker.report();

    expect(mocks.native.report).toHaveBeenCalledTimes(1);
  });

  it('holds no JS-side state that survives — or resurrects — across a simulated restart', async () => {
    // Plain counters, not vi.fn(): loadSdk() clears mock history, and
    // the point of this test is what survives that boundary.
    let beforeCalls = 0;
    let afterCalls = 0;

    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: () => {
        beforeCalls++;
      },
    });
    emitFromNative('project_deleted');
    expect(beforeCalls).toBe(1);

    // Fresh module registry == fresh JS process. The persisted
    // TERMINATED marker lives in UserDefaults / SharedPreferences on
    // the native side, so JS starts blank: no stale listener survives,
    // and no callback fires until native says so again.
    const restarted = await loadSdk();
    restarted.Issuetracker.configure({
      apiKey: 'it_dev_x',
      onConfigurationError: () => {
        afterCalls++;
      },
    });

    expect(activeListenerCount()).toBe(1);
    expect(afterCalls).toBe(0);

    // ...and once the rehydrated native state re-emits, the new
    // callback — and only the new one — hears it.
    emitFromNative('project_deleted');
    expect(afterCalls).toBe(1);
    expect(beforeCalls).toBe(1);
  });

  it('forwards a changed API key verbatim without any terminated-state bookkeeping of its own', () => {
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_old',
      onConfigurationError: vi.fn(),
    });
    emitFromNative('project_deleted');

    sdk.Issuetracker.configure({
      apiKey: 'it_prod_new',
      onConfigurationError: vi.fn(),
    });

    expect(lastConfigureArgs()[CONFIGURE_ARG.apiKey]).toBe('it_prod_new');
    expect(mocks.native.configure).toHaveBeenCalledTimes(2);
  });
});

describe('configure() argument passthrough', () => {
  it('applies the documented defaults', () => {
    sdk.Issuetracker.configure({ apiKey: 'it_dev_x' });

    const args = lastConfigureArgs();
    expect(args[CONFIGURE_ARG.apiKey]).toBe('it_dev_x');
    expect(args[CONFIGURE_ARG.shakeToReport]).toBe(true);
    expect(args[CONFIGURE_ARG.longPressToReport]).toBe(true);
    expect(args[CONFIGURE_ARG.accessibilityAction]).toBe(false);
    expect(args[CONFIGURE_ARG.showReportButton]).toBe(false);
    expect(args[CONFIGURE_ARG.enableCrashReporting]).toBe(true);
    expect(args[CONFIGURE_ARG.showOnboarding]).toBe(false);
    expect(args[CONFIGURE_ARG.terminatedTitle]).toBeNull();
    expect(args[CONFIGURE_ARG.terminatedSubtitle]).toBeNull();
    expect(args[CONFIGURE_ARG.terminatedCloseLabel]).toBeNull();
  });

  it('forwards explicitly disabled triggers', () => {
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      shakeToReport: false,
      longPressToReport: false,
      showReportButton: false,
      accessibilityAction: false,
    });

    const args = lastConfigureArgs();
    expect(args[CONFIGURE_ARG.shakeToReport]).toBe(false);
    expect(args[CONFIGURE_ARG.longPressToReport]).toBe(false);
    expect(args[CONFIGURE_ARG.showReportButton]).toBe(false);
    expect(args[CONFIGURE_ARG.accessibilityAction]).toBe(false);
  });

  it('passes terminal-UI overrides through field by field, nulling the ones left out', () => {
    sdk.Issuetracker.configure({
      apiKey: 'it_dev_x',
      terminatedUI: { title: 'Rapportering er avslått' },
    });

    const args = lastConfigureArgs();
    expect(args[CONFIGURE_ARG.terminatedTitle]).toBe('Rapportering er avslått');
    expect(args[CONFIGURE_ARG.terminatedSubtitle]).toBeNull();
    expect(args[CONFIGURE_ARG.terminatedCloseLabel]).toBeNull();
  });
});

describe('native bridge parity', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (relative: string) =>
    readFileSync(join(here, '..', relative), 'utf8');

  const facade = read('src/index.tsx');
  const kotlin = read(
    'android/src/main/java/com/issuetracker/sdkreactnative/SdkReactNativeModule.kt'
  );
  const objc = read('ios/SdkReactNative.mm');
  const header = read('ios/SdkReactNative.h');

  // The three copies of the event name are the whole bridge. A typo in
  // any one of them means the host callback silently never fires — the
  // exact failure mode ADR-0003 Decision 9 is meant to make observable.
  it('uses the same event-name literal in JS, Kotlin and Obj-C', () => {
    expect(facade).toContain(`const EVENT_NAME = '${EVENT_NAME}'`);
    expect(kotlin).toContain(`"${EVENT_NAME}"`);
    expect(objc).toContain(`@"${EVENT_NAME}"`);
  });

  it('declares the event in the iOS RCTEventEmitter surface', () => {
    expect(header).toContain('RCTEventEmitter');
    expect(objc).toMatch(/supportedEvents/);
    expect(objc).toMatch(
      /sendEventWithName:IssuetrackerEventConfigurationError/
    );
  });

  it('implements the addListener / removeListeners pair NativeEventEmitter needs on Android', () => {
    expect(kotlin).toMatch(/override fun addListener\(eventName: String\)/);
    expect(kotlin).toMatch(/override fun removeListeners\(count: Double\)/);
  });

  it('emits the reason rawValue, guarded against a torn-down React instance', () => {
    expect(kotlin).toContain('reason.rawValue');
    expect(kotlin).toContain('hasActiveReactInstance()');
  });
});
