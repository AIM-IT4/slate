"""Inspect the built release's effective Android manifest, not just source configuration."""
import argparse
import hashlib
import json
from pathlib import Path

from loguru import logger

logger.remove()
from androguard.core.apk import APK


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    apk = APK(str(args.apk))
    namespace = "{http://schemas.android.com/apk/res/android}"
    application = apk.get_android_manifest_xml().find("application")
    metadata = {
        item.get(namespace + "name"): item.get(namespace + "value")
        for item in application.findall("meta-data")
    }
    blocked = {
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.REQUEST_INSTALL_PACKAGES",
        "android.permission.WRITE_EXTERNAL_STORAGE",
    }
    authorities = [
        item.get(namespace + "authorities", "")
        for item in application.findall("provider")
    ]
    checks = {
        "own_package": apk.get_package() == "com.desk2quant.slate",
        "release_version": apk.get_androidversion_name() == "1.2.3",
        "not_debuggable": application.get(namespace + "debuggable", "false") == "false",
        "system_backup_disabled": application.get(namespace + "allowBackup") == "false",
        "cleartext_disabled": application.get(namespace + "usesCleartextTraffic") == "false",
        "blocked_permissions_absent": not blocked.intersection(apk.get_permissions()),
        "ota_disabled": metadata.get("expo.modules.updates.ENABLED") == "false",
        "crash_reporting_disabled": metadata.get("CherryCrashReportingEnabled") == "false",
        "apk_installer_disabled": metadata.get("expo.modules.appupdate.APK_UPDATES_ENABLED", "false") == "false",
        "no_upstream_provider_authorities": all("com.cherryai.cherrystudio_app" not in value for value in authorities),
        "v2_signing_block_present": apk.is_signed_v2(),
    }
    report = {
        "package": apk.get_package(),
        "version": apk.get_androidversion_name(),
        "min_sdk": apk.get_min_sdk_version(),
        "target_sdk": apk.get_target_sdk_version(),
        "sha256": hashlib.file_digest(args.apk.open("rb"), "sha256").hexdigest(),
        "checks": checks,
        "permissions": sorted(apk.get_permissions()),
        "network_security_config": application.get(namespace + "networkSecurityConfig"),
        "scope": "Static manifest inspection. Run apksigner verify separately. This does not establish runtime security or device compatibility.",
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    failures = [name for name, passed in checks.items() if not passed]
    print(json.dumps({"passed": len(checks) - len(failures), "failed": failures}))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
