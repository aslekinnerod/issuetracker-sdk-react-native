require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SdkReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/aslekinnerod/issuetracker-sdk-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  # Native iOS SDK that this wrapper bridges to. The example app's
  # Podfile pins it to a local path for development:
  #   pod 'IssuetrackerSDK', :path => '../../../sdk-ios'
  s.dependency "IssuetrackerSDK", "~> 0.4"

  install_modules_dependencies(s)
end
