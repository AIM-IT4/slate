# Voice

`createVoice` assembles configured dictation, speech and audio-file transcription engines.
`voice/videoAudio` exposes `transcribeVideoAudio(uri, signal)` for a backend-verified managed video.
It does not load the broader voice service or change the selected voice engine.

The video path extracts mono PCM16 windows with the existing native decoder and transcribes them
with bundled multilingual Whisper tiny INT8 weights. `prepareSlateAudio.mjs` downloads the pinned
assets during Android prebuild and verifies every size and SHA-256. The app copies and verifies
these bundled assets into no-backup private storage on first use. Audio is processed locally;
there is no speech API credential or model download on the phone.

Video timestamps identify approximate transcription windows, not word alignment. Signal metrics
are RMS/peak dBFS, clipped-sample percentage and quiet-window percentage; they are not LUFS or a
perceptual music assessment. Audio without recognized speech can still supply these metrics.
Speech recognition can make mistakes with music, overlapping voices or mixed languages.

The shared ASR work slot serializes video processing, SenseVoice, system file transcription and
DeepSeek file transcription. It protects the native recognizer and decoder temporary directory.
Cancellation joins in-flight recognition before releasing resources. Generated WAV windows are
removed after each window, including failures. No-track, failed, unsupported and partial results
remain explicit; only successful complete transcripts receive the completed attachment notice.

Transcript delivery is bounded by text/context budgets and marks partial results. The original video, including its audio track, is uploaded to Slate Execution for visual frame
extraction; local speech recognition does not call an additional speech provider. Device acceptance remains required for the Android asset-copy,
codec and native-recognizer integration; desktop recognition tests do not establish phone behavior.
