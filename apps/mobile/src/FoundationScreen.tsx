import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@turf-and-taste/api-client';
import { SEMANTIC_COLOR_KEYS, themes, type ThemeName } from '@turf-and-taste/design-tokens';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  SectionHeader,
  useAppTheme,
} from '@turf-and-taste/ui-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export function FoundationScreen() {
  const { theme, setTheme } = useAppTheme();
  const [note, setNote] = useState('');
  const health = useQuery({
    queryKey: ['health', apiUrl],
    queryFn: () => getHealth(apiUrl),
    enabled: false,
    retry: false,
  });
  const nextTheme: ThemeName = theme === 'clubhouse-ivory' ? 'midnight-ivory' : 'clubhouse-ivory';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8" keyboardShouldPersistTaps="handled">
        <PageHeader
          description="Phase 0 proves the mobile shell, NativeWind tokens, and persistent themes."
          title="Turf & Taste"
        />
        <Card>
          <View className="gap-4">
            <SectionHeader title="Theme" />
            <Badge label={theme} />
            <Button label="Switch theme" onPress={() => setTheme(nextTheme)} />
            <View className="flex-row flex-wrap gap-3">
              {SEMANTIC_COLOR_KEYS.map((key) => (
                <View className="w-[30%] overflow-hidden rounded-md border border-border" key={key}>
                  <View className="h-11" style={{ backgroundColor: themes[theme][key] }} />
                  <Text className="px-2 py-1 text-caption text-text-secondary">{key}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
        <Card>
          <View className="gap-3">
            <SectionHeader title="Input" />
            <Input onChangeText={setNote} placeholder="Local note" value={note} />
          </View>
        </Card>
        <Card>
          <View className="gap-3">
            <SectionHeader title="API client" />
            <Button
              label="Check API health"
              onPress={() => {
                void health.refetch();
              }}
            />
            {health.isError ? (
              <ErrorState description="Start the API to verify the health route." title="API unavailable" />
            ) : null}
          </View>
        </Card>
        <EmptyState
          description="Customer screens begin in later phases."
          title="No product modules yet"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
