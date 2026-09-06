require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SdkReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # Must match IssuetrackerSDK's minimum (iOS 16.0); cannot use
  # RN's default min_ios_version_supported (15.1) because the
  # native SDK we depend on requires 16.0.
  s.platforms    = { :ios => "16.0" }
  s.source       = { :git => "https://github.com/aslekinnerod/issuetracker-sdk-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  # Native iOS SDK that this wrapper bridges to. The example app's
  # Podfile pins it to a local path for development:
  #   pod 'IssuetrackerSDK', :path => '../../../sdk-ios'
  # 0.6.0: tester attestation (ADR-0005) — setTesterToken/clearTesterToken.
  #
  # Three components on purpose: `~> 0.6.0` means >= 0.6.0, < 0.7.0,
  # while `~> 0.6` would mean >= 0.6, < 1.0 — i.e. it would silently
  # absorb 0.7, a release that (a) is expected, per the ADR-0008 TODOs
  # in ios/IssuetrackerSdkBridge.swift, and (b) is free to break API on
  # a 0.x line. Android pins the same underlying SDK exactly, in
  # android/build.gradle; scripts/check-native-parity.mjs fails CI if the
  # two ever disagree, so bump both in one commit.
  s.dependency "IssuetrackerSDK", "~> 0.6.0"

  install_modules_dependencies(s)
end
