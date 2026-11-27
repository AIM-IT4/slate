# Slate 1.2.1

The Editorial draft screen uses bundled Playfair Display Bold for the headline and
wordmark. The Slate wordmark appears before provider setup. Existing conversations
continue to show their agent identity.

The Android update reuses the native binaries and compiled resources of Slate
1.2.0. The packaging process replaces the JavaScript bytecode, adds the font and
its license, and increments the manifest version. The signing certificate must
match Slate 1.2.0 for installation over the current app.

The origin restrictions, redirect checks, and backup scrubbing remain in the
source. The APK is subject to signature, alignment, and package-content checks.
A physical-device visual check was unavailable.
