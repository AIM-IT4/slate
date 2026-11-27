# Slate roadmap

This is a direction for contributions, not a release schedule. Proposed work is not a claim that a feature already exists.

## Available in the current preview

- Android-first React Native interface and bring-your-own-key provider setup.
- OpenAI and Anthropic conversations, agent configuration, and remote MCP connections.
- Remote execution integration and supported inline video playback.
- Video attachment preparation with sampled frames and on-device speech transcription.
- Recorded usage statistics, a daily composer shortcut, and adaptive duration labels.
- Reduced-motion-aware startup and shared interaction behavior.

## Next: make the preview easier to trust and try

- [ ] Publish signed Android release assets with checksums and matching source references.
- [ ] Add a clean, consented screenshot gallery and a short real-device demo.
- [ ] Expand Android device testing for video codecs, audio extraction, long-running tools, keyboard behavior, and memory pressure.
- [ ] Make video-service configuration portable beyond the current fixed Slate Execution integration.
- [ ] Improve setup diagnostics and recovery for remote MCP authentication and tool discovery.

## Then: improve everyday workflows

- [ ] Strengthen accessibility and large-text layouts around the composer and tool results.
- [ ] Improve long-job progress, reconnect behavior, and artifact retention across execution providers.
- [ ] Improve documentation and regression coverage for offline and unreliable-network behavior.
- [ ] Document reproducible release builds and third-party dependency notices more completely.

## Explore

- [ ] Validate a Slate iOS build before announcing iOS support.
- [ ] Evaluate additional providers without making the core setup harder to understand.
- [ ] Explore project-oriented workflows connecting repositories, skills, tools, and generated files.

Have a concrete use case? [Propose it](https://github.com/AIM-IT4/slate/issues/new?template=1_feature_request.yml). Include what you want to accomplish on a phone and what currently gets in the way.
