import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import {
  getFacilities,
  getFacility,
  getFacilityPricing,
  getFacilitySchedule,
  type Facility,
} from '@turf-and-taste/api-client';
import { PROPERTY } from '@turf-and-taste/types';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Skeleton,
} from '@turf-and-taste/ui-native';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import type { ExtendedNavigationProp } from '../../navigation/types';
import { traceMobileRequest, traceNavigation } from '../../network/diagnostics';

export function HomeScreen() {
  const navigation = useNavigation<ExtendedNavigationProp>();
  const queryClient = useQueryClient();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  const facilitiesQuery = queryOptions({
    queryKey: ['facilities'],
    queryFn: async () => {
      if (!apiUrl) throw new Error('Missing API URL');
      return traceMobileRequest('home.facilities', () => getFacilities(apiUrl));
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: facilities, isLoading, isError, isRefetching, refetch } = useQuery(facilitiesQuery);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      >
        <PageHeader
          title={PROPERTY.name}
          description={`${PROPERTY.locality}, ${PROPERTY.region}, ${PROPERTY.country}`}
        />

        <Card>
          <View className="gap-4">
            <SectionHeader title="Our Facilities" />
            {isLoading ? (
              <View className="gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-28 w-full" />
                ))}
              </View>
            ) : isError ? (
              <EmptyState
                title="Unable to load facilities"
                description="Pull to refresh or try again later"
              />
            ) : facilities && facilities.length > 0 ? (
              <View className="gap-3">
                {facilities.map((facility) => (
                  <FacilityCard
                    key={facility.id}
                    facility={facility}
                    onPressIn={() => {
                      if (!apiUrl) return;
                      void Promise.all([
                        queryClient.prefetchQuery({
                          queryKey: ['facility', facility.key],
                          queryFn: () => getFacility(apiUrl, facility.key),
                          staleTime: 5 * 60_000,
                        }),
                        queryClient.prefetchQuery({
                          queryKey: ['facilityPricing', facility.key],
                          queryFn: () => getFacilityPricing(apiUrl, facility.key),
                          staleTime: 5 * 60_000,
                        }),
                        queryClient.prefetchQuery({
                          queryKey: ['facilitySchedule', facility.key],
                          queryFn: () => getFacilitySchedule(apiUrl, facility.key),
                          staleTime: 5 * 60_000,
                        }),
                      ]);
                    }}
                    onPress={() => {
                      traceNavigation(`Home -> FacilityDetail facility=${facility.key}`);
                      navigation.navigate('FacilityDetail', { facilityKey: facility.key });
                    }}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No facilities available"
                description="Check back later for available bookings"
              />
            )}
          </View>
        </Card>

        <Card>
          <View className="gap-4">
            <SectionHeader title="Quick Actions" />
            <View className="flex-row flex-wrap gap-3">
              <Button
                variant="outline"
                label="My Bookings"
                onPress={() => navigation.navigate('MyBookings')}
              />
              <Button
                variant="outline"
                label="Profile"
                onPress={() => navigation.navigate('Profile')}
              />
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function FacilityCard({
  facility,
  onPress,
  onPressIn,
}: {
  facility: Facility;
  onPress: () => void;
  onPressIn: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${facility.name}`}
      onPressIn={onPressIn}
      onPress={onPress}
      className="min-h-11 flex-row items-center rounded-lg border border-border bg-surface-muted p-4 active:opacity-70"
    >
      <View className="flex-1">
        <Text className="text-title font-semibold text-text-primary">{facility.name}</Text>
        <Text className="mt-1 text-body-small text-text-secondary">
          {getFacilityDescription(facility.key)}
        </Text>
      </View>
      <Text className="text-body font-semibold text-primary">View</Text>
    </Pressable>
  );
}

function getFacilityDescription(key: Facility['key']): string {
  switch (key) {
    case 'box-cricket':
      return 'Indoor box cricket arena';
    case 'skating-rink':
      return 'Indoor skating rink';
    case 'pickle-ball':
      return 'Indoor pickle ball courts';
    case 'cricket-green-net':
      return 'Cricket practice nets';
  }
}
