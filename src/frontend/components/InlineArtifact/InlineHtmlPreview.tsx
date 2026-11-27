import { WebView } from 'react-native-webview';
import { withUniwind } from 'uniwind';

import { allowInlineHtmlNavigation, inlineHtmlDocument } from '@/frontend/utils/inlineArtifacts';

const HtmlWebView = withUniwind(WebView);

/** Charts own taps, panning and zoom inside their bounded viewport; chat owns the outer scroll. */
export function InlineHtmlPreview({
  source,
  onFailure,
}: {
  source: { html: string } | { uri: string };
  onFailure: () => void;
}) {
  return (
    <HtmlWebView
      source={{ html: inlineHtmlDocument(source) }}
      className="flex-1 bg-background"
      containerClassName="flex-1"
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={({ url, isTopFrame }) =>
        allowInlineHtmlNavigation(url, isTopFrame)
      }
      onError={onFailure}
      onContentProcessDidTerminate={onFailure}
      onRenderProcessGone={onFailure}
      onOpenWindow={() => {}}
      javaScriptEnabled
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      incognito
      mediaPlaybackRequiresUserAction
      allowsInlineMediaPlayback
      scrollEnabled={false}
      nestedScrollEnabled
      testID="artifact-inline-html"
    />
  );
}
