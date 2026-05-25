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

## Full documentation

API reference, configuration options, triggers, TERMINATED behavior, and
troubleshooting — see **[docs.issuetracker.no/sdk/react-native](https://docs.issuetracker.no/sdk/react-native)**.

## Requirements

- React Native 0.74+ (TurboModule support)
- iOS 16.0+ / Android 8.0+

## License

MIT
