import { queryOptions, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getBookings, type Booking } from '@turf-and-taste/api-client';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@turf-and-taste/ui-native';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { CustomerStackScreenProps } from '../../navigation/types';

export function MyBookingsScreen() {
  const navigation = useNavigation<CustomerStackScreenProps<'MyBookings'>['navigation']>();
  const { getAccessToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const query = useQuery(
    queryOptions({
      queryKey: ['bookings'],
      queryFn: async () => {
        const token = await getAccessToken();
        if (!token) throw new Error('Your session has expired.');
        if (!apiUrl) throw new Error('The API is not configured.');
        return getBookings(apiUrl, token);
      },
    }),
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
      >
        <PageHeader
          title="My Bookings"
          description="Your upcoming and previous facility bookings"
        />
        {query.isLoading ? (
          <View className="gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </View>
        ) : query.isError ? (
          <View className="gap-3">
            <ErrorState
              title="Bookings unavailable"
              description="Check your connection and try again."
            />
            <Button variant="outline" label="Retry" onPress={() => void query.refetch()} />
          </View>
        ) : query.data?.length ? (
          <View className="gap-3">
            {query.data.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No bookings yet"
            description="Create a booking from any facility detail screen."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const facility = booking.items[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View booking ${booking.id.slice(0, 8)}`}
      onPress={onPress}
    >
      <Card>
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-title font-semibold text-text-primary">
                {facility?.facilityName ?? 'Facility booking'}
              </Text>
              <Text className="mt-1 text-body-small text-text-secondary">
                {formatDateTime(booking.startsAt)}
              </Text>
            </View>
            <StatusBadge label={formatStatus(booking.status)} />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">
              {booking.durationHours} hour{booking.durationHours > 1 ? 's' : ''}
            </Text>
            <Text className="text-body font-semibold text-text-primary">
              {formatMoney(booking.quotedAmountPaise, booking.currency)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
function formatStatus(value: Booking['status']) {
  return value === 'pending' ? 'Awaiting payment' : value.replace('_', ' ');
}
function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100);
}
