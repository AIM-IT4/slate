# Inline Artifact

`InlineArtifact` renders explicit HTTPS HTML/image/video/audio artifacts, complete managed HTML,
and managed media files inside a conversation. HTML runs in a sandboxed iframe with an opaque
origin, no app bridge, no shared cookies, and no local file access. HTTPS chart libraries can load;
fully embedded HTML also works without a CDN. Remote pages can refuse framing and remain available
through their original file links. Media requires a user gesture and pauses on screen blur/background.

Only the trusted generated media-player wrapper can read a managed local file. Arbitrary chart HTML
never receives that access or a privileged message bridge. A media message can only report an error
or bounded dimensions. The containing message owns external spacing and file/download actions.
Chart gestures belong to the preview viewport; the conversation owns scrolling outside that viewport.
