import ActivityIcon from '@cherrystudio/app-icons/icons/activity';
import { Button } from '@cherrystudio/ui/components';
import { useIsFocused, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery } from '@/frontend/data';
import { useCurrentTime } from '@/frontend/hooks/useCurrentTime';
import { formatAiUsageCost } from '@/frontend/utils/aiUsage';

/** Recorded usage for the current local day; the existing usage screen owns the breakdown. */
export function ChatInputUsageTile() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const now = useCurrentTime(isFocused);
  const dayStart = startOfDay(now);
  const query = useMemo(() => {
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { from: dayStart, to: tomorrow.getTime() - 1, limit: 1, metric: 'tokens' as const };
  }, [dayStart]);
  const { data, isError } = useQuery('/ai-usage-records/timeline', {
    enabled: isFocused,
    query,
  });
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const tokens = data
    ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
        data.buckets.reduce((total, bucket) => total + bucket.totalTokens, 0),
      )
    : '—';
  const costs = data?.costTotals
    .map(({ currency, total }) => formatAiUsageCost(total, currency, locale))
    .join(' · ');
  const label = `${t('aiUsage.today')} · ${tokens} ${t('aiUsage.tokens')}${costs ? ` · ${costs}` : ''}`;

  return (
    <View className="max-w-full self-start">
      <Button
        accessibilityLabel={`${t('aiUsage.title')}. ${isError && !data ? t('aiUsage.loadError') : label}`}
        accessibilityRole="link"
        onPress={() => router.push('/home/ai-usage')}
        size="sm"
        shape="pill"
        hitSlop={6}
        testID="chat-usage-stats"
        variant="tonal"
      >
        <ActivityIcon className="size-4 text-muted-foreground" />
        <Button.Label numberOfLines={1}>
          {isError && !data ? t('aiUsage.title') : label}
        </Button.Label>
      </Button>
    </View>
  );
}

function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
