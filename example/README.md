# Issuetracker SDK — React Native sample app

A real installable React Native app that exercises every public
surface of the SDK so you can shake-test changes in 30 seconds. Same
feature checklist as the Android, iOS, and Flutter sample apps —
keep them in lockstep when adding capabilities.

## How to run

1. Open `src/App.tsx` and replace the `API_KEY` constant with a real
   key from the Issuetracker admin UI. (Or copy `App.tsx` to
   `App.local.tsx`, gitignore that, and edit there for day-to-day
   work.)

   If you skip this step the build still works but the SDK will fall
   into `invalid_api_key` → TERMINATED on the first report — a useful
   demo path, just not the happy one.

2. Install deps + start Metro:

   ```
   cd sdk-react-native/example
   yarn install
   yarn start
   ```

3. In a second terminal, run on a connected device or simulator:

   ```
   yarn android   # or
   yarn ios
   ```

   For iOS, first time only:

   ```
   bundle install
   bundle exec pod install
   ```

## Feature checklist

Each section in the app maps 1:1 to a surface in the SDK. When you
add a feature, add a section here AND in the sister sample apps so
the four platforms stay comparable.

| Section | What it exercises | SDK API |
|---|---|---|
| **Lifecycle** | Shows the last `onConfigurationError` reason the SDK reported. Has a "Reset" button so you can retry a path that has already fired. | `onConfigurationError` callback on `configure(...)` |
| **Reporting** | One button programmatically opens the reporter. Shake-to-report and two-finger long-press also trigger it. | `Issuetracker.report()` + `shakeToReport` + `longPressToReport` |
| **Identity** | Sets / clears the display name that stamps every report. | `identify(name)` / `clearIdentity()` |
| **Breadcrumbs** | Records up to two action breadcrumbs with optional metadata. The most-recent 5 ride along on every report. | `recordAction(name, metadata?)` |
| **Onboarding** | Re-presents the first-launch trigger introduction popover regardless of whether it has been shown before. | `Issuetracker.showOnboarding()` |
| **TERMINATED-UI i18n** | Toggle a Norwegian translation of the terminal-state strings. Applied immediately — RN re-calls `configure(...)` on toggle so no restart is needed. | `terminatedUI: TerminatedUiStrings` on `configure(...)` |
| **Destructive** | Crash-test button (with confirmation). The next launch picks up the crash and queues a report. | `Issuetracker.testCrash()` |

## Folder layout

```
example/
  README.md                  ← you are here
  package.json               ← deps: @issuetracker/sdk-react-native + @react-native-async-storage/async-storage
  src/
    App.tsx                  ← Issuetracker.configure() + single demo screen
  android/                   ← platform shell (generated)
  ios/                       ← platform shell (generated)
```

The companion sample apps mirror this layout per platform convention:

- `sdk-android/sample-app/` (Compose single screen)
- `sdk-flutter/example/` (Material 3 single screen)
- `sdk-ios/example-app/` (Swift Package + SwiftUI single screen)
- `sdk-web/example/` (existing — extend to match this feature set)

Each sample-app README is the same shape (How to run + Feature
checklist table) so a person can hop between platforms and find the
same affordances.

## Adding a new feature

When the SDK gains a new public surface:

1. Add a section to **this** app (an `XxxSection` component in
   `App.tsx`).
2. Add the row to the **Feature checklist** table above.
3. Replicate to the other three sample apps using the same section
   title + same affordance (button label / toggle label).

## What this app intentionally is NOT

- Not a production reference app — uses `AsyncStorage` for tiny
  state (i18n toggle + last error display), not MMKV / Redux
  Persist / WatermelonDB.
- Not a layout exemplar — single scroll, neutral-grey cards. The
  point is to surface every SDK affordance, not to look pretty.
- Not multi-screen — keeps the surface flat so anyone testing the
  SDK can find every feature without learning a navigation tree.

## RN-specific notes

- The TERMINATED-UI strings are accepted on every `configure(...)`
  call, so the i18n section here re-configures on toggle without an
  app restart. The Android and Flutter sample apps require a restart
  because their `configure(...)` runs in `Application.onCreate` /
  `main()` rather than per-mount.
- `--dart-define`-style build-time env vars don't have an obvious
  React Native equivalent without adding `react-native-config` or
  similar. To avoid the dep, we keep the API key as a const at the
  top of `App.tsx` and recommend the `App.local.tsx` copy pattern
  for day-to-day work.
