# Slate 1.2.2

Slate opens the local profile and uses provider API keys. Onboarding skips the former
account step, including when resuming a saved legacy login stage. Settings keeps
local name and avatar controls. Cloud model offers and sign-in controls are no
longer rendered, and legacy login and account callback paths return to chat.
Previously stored organization data is left separate from the local profile.

The Android package reuses Slate 1.2.1 native code and compiled Android resources.
The package update changes the JavaScript bundle and manifest version fields, and
uses the previous Slate signing certificate. No device acceptance test was run.
