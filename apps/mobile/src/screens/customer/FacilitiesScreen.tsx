import { useQuery } from '@tanstack/react-query';
import { getFacilities } from '@turf-and-taste/api-client';
import { useNavigation } from '@react-navigation/native';
import type { ExtendedNavigationProp } from '../../navigation/types';
import { EmptyState, PageHeader, Skeleton } from '@turf-and-taste/ui-native';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, View, Text } from 'react-native';
import type { Facility } from '@turf-and-taste/api-client';

function getFacilityIcon(key: string): string {
  switch (key) {
    case 'box-cricket':
      return '🏏';
    case 'skating-rink':
      return '⛸️';
    case 'pickle-ball':
      return '🏓';
    case 'cricket-green-net':
      return '🏏';
    default:
      return '🏟️';
  }
}

function getFacilityDescription(key: string): string {
  switch (key) {
    case 'box-cricket':
      return 'Indoor box cricket arena';
    case 'skating-rink':
      return 'Indoor skating rink';
    case 'pickle-ball':
      return 'Indoor pickle ball courts';
    case 'cricket-green-net':
      return 'Cricket practice nets';
    default:
      return 'Sports facility';
  }
}

function TouchableFacilityCard({ facility, onPress }: { facility: Facility; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-lg border border-border bg-surface p-4 active:opacity-70"
    >
      <View
        className="size-14 rounded-lg items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
      >
        <Text className="text-2xl font-bold text-text-primary">
          {getFacilityIcon(facility.key)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-title font-semibold text-text-primary">{facility.name}</Text>
        <Text className="text-body-small text-text-secondary mt-1">
          {getFacilityDescription(facility.key)}
        </Text>
      </View>
      <View className="self-start rounded-full bg-surface-muted px-3 py-1">
        <Text className="text-caption font-medium text-text-primary">Available</Text>
      </View>
    </Pressable>
  );
}

export function FacilitiesScreen() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const navigation = useNavigation<ExtendedNavigationProp>();

  const {
    data: facilities,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      if (!apiUrl) throw new Error('Missing API URL');
      return getFacilities(apiUrl);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const content = isLoading ? (
    <View className="gap-3">
      {[1, 2, 3, 4].map((i) => {
        return <Skeleton key={i} className="h-28 w-full" />;
      })}
    </View>
  ) : isError ? (
    <EmptyState
      title="Unable to load facilities"
      description="Pull to refresh or try again later"
    />
  ) : facilities && facilities.length > 0 ? (
    <View className="gap-3">
      {facilities.map((facility: Facility) => {
        return (
          <TouchableFacilityCard
            key={facility.id}
            facility={facility}
            onPress={() => navigation.navigate('FacilityDetail', { facilityKey: facility.key })}
          />
        );
      })}
    </View>
  ) : (
    <EmptyState
      title="No facilities available"
      description="Check back later for available bookings"
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={async () => {
              await refetch();
            }}
          />
        }
      >
        <PageHeader
          title="Facilities"
          description="Browse all available sports facilities at Turf & Taste"
        />

        {content}
      </ScrollView>
    </SafeAreaView>
  );
}
