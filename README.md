# Issuetracker SDK for React Native

Drop-in issue reporter wrapper for React Native apps. Bridges to the native iOS and Android Issuetracker SDKs — all UI, screenshot capture, shake detection, and crash reporting runs on the native side; this package is a thin TypeScript façade.

## Install

```bash
npm install @issuetracker/sdk-react-native
# or
yarn add @issuetracker/sdk-react-native
```

iOS:
```bash
cd ios && pod install
```

## Usage

```tsx
import { useEffect } from 'react';
import { Issuetracker } from '@issuetracker/sdk-react-native';

export default function App() {
  useEffect(() => {
    Issuetracker.configure({
      apiKey: 'it_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });
  }, []);
  // ...
}
```

That's it. Either gesture brings up the reporter:

| Trigger | Notes |
| --- | --- |
| Shake the device | Accelerometer-based — real devices only, not the simulator/emulator |
| Two-finger long-press for 3 seconds | Anywhere in the app; works in the simulator/emulator too |
| `Issuetracker.report()` | Programmatic, e.g. from a "Report a bug" button |

Both gestures are enabled by default. Disable individually via `shakeToReport: false` or `longPressToReport: false` on `configure({...})`.

The SDK talks to Issuetracker's hosted backend — there is no endpoint to configure. Staging-prefixed keys (`it_staging_…`) are routed to the staging environment automatically; everything else hits production.

## Manual trigger

```tsx
<Button title="Report a bug" onPress={() => Issuetracker.report()} />
```

## API

```ts
Issuetracker.configure({ apiKey, shakeToReport?, longPressToReport?, enableCrashReporting? })
Issuetracker.report()
Issuetracker.identify(name)
Issuetracker.clearIdentity()
Issuetracker.recordAction(action, metadata?)
Issuetracker.testCrash()  // SDK integration testing only
```

## Development

This package depends on the native SDKs (`IssuetrackerSDK` for iOS, `io.issuetracker:sdk` for Android). For local development they're consumed from sibling repos:

**iOS** — `example/ios/Podfile` overrides the dep with a path:
```ruby
pod 'IssuetrackerSDK', :path => '../../../sdk-ios'
```

**Android** — publish the SDK to mavenLocal once, then `example/android/build.gradle` resolves it:
```bash
cd ../sdk-android && ./gradlew :sdk:publishToMavenLocal
```

Then in `example/`:
```bash
yarn
yarn example ios       # or: yarn example android
```

## Platform requirements

- iOS 16+
- Android 8.0+ (API 26)
- React Native 0.74+ (TurboModule support)

## License

MIT
