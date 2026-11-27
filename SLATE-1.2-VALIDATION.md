# Slate 1.2.0

The Editorial home uses the existing keyboard-aware composer, a warm surface, a serif heading and the two most recent conversations. The stable signing certificate and increased version code support an in-place update.

Model requests and remote model discovery for OpenAI and Anthropic use their fixed HTTPS origins. The transport blocks redirects, strips transport header overrides, and omits cookies. Backup exports strip API credentials and custom provider headers.

The Android ARM64 release build and release lint passed. Code shrinking was disabled for this release because of build host memory constraints. Seventeen focused security tests passed. APK signatures, the expected bundle digest, and eleven manifest checks were verified. On-device usability and live network behavior are unverified.
