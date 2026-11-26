# Slate 1.0.0

A personal Android fork of Cherry Studio Mobile 0.6.3, rebuilt from its published source.

## UI

Light-first white surfaces, cobalt emphasis, labelled bottom navigation, a flat Tools list with direct provider/privacy/appearance shortcuts, new Slate launcher/splash artwork and identity. Original model, MCP, file, image and agent implementations are retained.

## Security changes

Provider API keys, provider auth configuration and MCP headers use device-bound native secure storage with opaque references in SQLite. Personal and enterprise snapshot exports omit these credentials and search-provider overrides. Restores require reconnecting credentials. HTTPS is required for provider URLs; Android cleartext traffic and system backups are disabled. APK self-updates and the upstream Expo update channel are disabled. Sentry, Observe, Insights and product analytics are disabled. Overlay, package-installer and legacy external-write permissions are removed.

This is security hardening, not a guarantee of zero vulnerabilities. Other upstream code, dependencies and connected tools remain in scope for further review. No live-device security test or actual network-capture verification has been completed yet. SecureStore records from replaced references are not currently garbage-collected; use provider-side key revocation for obsolete credentials.

## Build

Install Node 24, pnpm 12.2.1, a full JDK 21 (including javac), Android SDK/platform 37.0 (compile API 37, target API 36), Build Tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Use a build host with at least 16 GB RAM and 25 GB free disk space; low-memory hosts may need to stage native compilation, Metro/Hermes and embedded asset generation separately. Keep upstream patches. Run one dependency installation at a time, as described in docs/guides/development.md.

```sh
git init
pnpm install --frozen-lockfile
node --import tsx packages/design-tokens/scripts/build-native-css.ts
PROFILE=production APK_UPDATES_ENABLED=false DOMESTIC_STORES_ENABLED=false pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

The fork deliberately builds an unsigned release rather than silently using Android's public debug key. Align and sign it with your own keystore using Android Build Tools zipalign/apksigner. Keep your signing key outside the source tree and retain it for future updates. The standalone Gradle route avoids requiring ownership of Cherry's Expo project. The documented upstream EAS route needs a separate project owned by the fork's maintainer.

## Dependency audit and service identity

The 26 November 2026 production npm audit initially reported 82 advisory findings across 18 package names. Patched versions are pinned in pnpm-workspace.yaml; major-version overrides are constrained where needed to preserve existing APIs. The latest scan reports zero known npm advisories across 1,039 production/optional dependency records. This does not cover all Maven/native dependencies or prove the absence of vulnerabilities.

CherryAI starts disabled. The fork does not register CherryIn's official-app OAuth client; its providers can still be configured with API keys. GitHub OAuth requires your own client configuration. Native callback validation includes the fork's Slate scheme, and Notion's dynamic registration can use that scheme.

## Checks

```sh
node node_modules/jest/bin/jest.js --config jest.slate.config.js --runInBand
NODE_OPTIONS=--max-old-space-size=4096 node node_modules/typescript/bin/tsc --noEmit
node --import tsx packages/design-tokens/scripts/check.ts
node --import tsx packages/design-tokens/scripts/check-app-theme.ts
node --import tsx scripts/i18n.ts check
```

The focused security suite uses native-vault mocks and real Node SQLite for snapshot sanitization. It does not test Android Keystore itself. The upstream Jest/Expo preset failed to initialize in this environment; the isolated security configuration avoids that unrelated runtime-polyfill issue.

## Attribution

Based on https://github.com/CherryHQ/cherry-studio-app/tree/v0.6.3. Original copyright notices and LICENSE are retained. Distributed modifications remain subject to AGPL-3.0. This fork is not an official Cherry Studio release.
