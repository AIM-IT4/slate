import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { withUniwind } from 'uniwind';

import { escapeArtifactAttribute } from '@/frontend/utils/inlineArtifacts';

const MediaWebView = withUniwind(WebView);
export type InlineMediaSource =
  | { kind: 'remote'; uri: string }
  | { kind: 'managed'; uri: string }
  | { kind: 'embedded-audio'; uri: string };

export function InlineMediaPreview({
  source,
  media,
  onFailure,
}: {
  source: InlineMediaSource;
  media: 'video' | 'audio';
  onFailure: () => void;
}) {
  const web = useRef<WebView>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const pause = useCallback(() => {
    web.current?.injectJavaScript(
      "document.querySelectorAll('video,audio').forEach(function(m){m.pause()}); true;",
    );
  }, []);
  useFocusEffect(useCallback(() => pause, [pause]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);
  const local = source.kind === 'managed' && source.uri.startsWith('file://');
  const baseUrl = local ? source.uri.slice(0, source.uri.lastIndexOf('/') + 1) : undefined;
  const escaped = escapeArtifactAttribute(source.uri);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:transparent;width:100vw;height:100vh;overflow:hidden"><${media} controls playsinline preload="metadata" style="width:100%;height:100%;object-fit:contain" src="${escaped}"></${media}><script>var m=document.querySelector('${media}');m.addEventListener('loadedmetadata',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'dimensions',width:this.videoWidth,height:this.videoHeight}));});m.addEventListener('error',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'media-error'}));});</script></body></html>`;
  return (
    <View
      className="w-full overflow-hidden rounded-md bg-secondary"
      style={media === 'audio' ? { height: 72 } : { aspectRatio: ratio }}
      testID={`artifact-inline-${media}`}
    >
      <MediaWebView
        ref={web}
        source={{ html, ...(baseUrl ? { baseUrl } : {}) }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) =>
          url === 'about:blank' || (local && (url === baseUrl || url === source.uri))
        }
        onMessage={({ nativeEvent }) => {
          try {
            const value = JSON.parse(nativeEvent.data);
            if (value.type === 'media-error') onFailure();
            else if (
              value.type === 'dimensions' &&
              Number.isFinite(value.width) &&
              Number.isFinite(value.height) &&
              value.width > 0 &&
              value.height > 0
            )
              setRatio(Math.min(3, Math.max(0.3, value.width / value.height)));
          } catch {
            /* Ignore malformed messages; this bridge only accepts media status. */
          }
        }}
        onError={onFailure}
        onRenderProcessGone={onFailure}
        onContentProcessDidTerminate={onFailure}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="never"
        allowFileAccess={local}
        allowingReadAccessToURL={local ? source.uri : undefined}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        className="flex-1 bg-secondary"
        containerClassName="flex-1"
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
      />
    </View>
  );
}
