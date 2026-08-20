# Issuetracker SDK for React Native

Drop-in issue reporter for React Native apps. TurboModule wrapper around
the native iOS and Android SDKs — all UI, screenshot capture, shake
detection, and crash reporting runs on the native side.

## Install

```bash
yarn add @issuetracker/sdk-react-native
cd ios && pod install
```

## Quickstart

```tsx
import { useEffect } from 'react';
import { Issuetracker } from '@issuetracker/sdk-react-native';

export default function App() {
  useEffect(() => {
    Issuetracker.configure({ apiKey: 'it_...' });
  }, []);
  // ...
}
```

## Accessibility

The default triggers are gestures: shake (`shakeToReport`) and a
two-finger 3-second long-press (`longPressToReport`), both enabled by
default. Gestures alone are not accessible to everyone — WCAG 2.2
2.5.1 (Pointer Gestures) and 2.5.4 (Motion Actuation) require a
single-pointer, non-motion alternative. If you enable either gesture
trigger, you MUST also provide a conventional, single-pointer entry
point. The one-line path (ADR-0008):

```tsx
Issuetracker.configure({
  apiKey: 'it_...',
  accessibilityAction: true, // screen-reader custom action "Report a bug"
  showReportButton: true, // SDK-provided floating report button
});
```

- `accessibilityAction: true` registers a screen-reader custom action
  ("Report a bug") whenever VoiceOver / TalkBack is running — the
  population most likely to be locked out of both gestures, since the
  OS screen reader claims shake and multi-finger gestures. No visible
  chrome for anyone else.
- `showReportButton: true` renders a small SDK-provided floating
  button, covering sighted motor-impaired users who can't shake or
  long-press.

Alternatively (or additionally), wire your own visible button or menu
item to `Issuetracker.report()` — that also satisfies the
requirement, and gives you full control over placement and styling.
You SHOULD also offer a user-facing setting to turn shake detection
off (some users trigger it accidentally due to tremors, or use their
device in motion). Apply it by calling `Issuetracker.configure()`
again with `shakeToReport: false` — reconfiguration takes effect
immediately, no restart needed.

The example app's "Report a bug" button demonstrates the programmatic
trigger.

## Full documentation

API reference, configuration options, triggers, TERMINATED behavior, and
troubleshooting — see **[docs.issuetracker.no/sdk/react-native](https://docs.issuetracker.no/sdk/react-native)**.

## Requirements

- React Native 0.74+ (TurboModule support)
- iOS 16.0+ / Android 8.0+

## License

MIT
