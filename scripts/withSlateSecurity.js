const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) => {
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,
      '$1signingConfig null\n            debuggable false',
    );
    return mod;
  });
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing');
    application.$['android:allowBackup'] = 'false';
    application.$['android:usesCleartextTraffic'] = 'false';
    delete application.$['android:debuggable'];
    const blocked = new Set([
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]);
    const permissions = (mod.modResults.manifest['uses-permission'] ?? []).filter(
      (p) => !blocked.has(p.$['android:name']) || p.$['tools:node'] === 'remove',
    );
    for (const name of blocked) {
      if (!permissions.some((p) => p.$['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
      }
    }
    mod.modResults.manifest['uses-permission'] = permissions;
    return mod;
  });
};
