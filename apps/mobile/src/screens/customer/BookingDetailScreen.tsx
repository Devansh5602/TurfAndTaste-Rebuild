import { queryOptions, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getBooking } from '@turf-and-taste/api-client';
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@turf-and-taste/ui-native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { CustomerStackScreenProps } from '../../navigation/types';

export function BookingDetailScreen() {
  const route = useRoute<CustomerStackScreenProps<'BookingDetail'>['route']>();
  const navigation = useNavigation<CustomerStackScreenProps<'BookingDetail'>['navigation']>();
  const { getAccessToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const query = useQuery(
    queryOptions({
      queryKey: ['bookings', route.params.bookingId],
      queryFn: async () => {
        const token = await getAccessToken();
        if (!token) throw new Error('Your session has expired.');
        if (!apiUrl) throw new Error('The API is not configured.');
        return getBooking(apiUrl, token, route.params.bookingId);
      },
    }),
  );
  if (query.isLoading)
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </View>
      </SafeAreaView>
    );
  if (query.isError || !query.data)
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <ErrorState title="Booking unavailable" description="This booking could not be loaded." />
          <Button variant="outline" label="Retry" onPress={() => void query.refetch()} />
        </View>
      </SafeAreaView>
    );
  const booking = query.data;
  const item = booking.items[0];
  const isPending = booking.status === 'pending';
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8">
        <PageHeader
          title={isPending ? 'Booking Created' : 'Booking Confirmed'}
          description={isPending ? 'Awaiting payment — no payment has been collected.' : 'Payment verified and booking confirmed.'}
        />
        <Card>
          <View className="gap-4">
            <View className="flex-row justify-between">
              <Text className="text-body-small text-text-secondary">Reference</Text>
              <Text className="text-body font-semibold text-text-primary">
                {booking.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <StatusBadge
              label={booking.status === 'pending' ? 'Awaiting payment' : booking.status}
            />
            <Row label="Facility" value={item?.facilityName ?? 'Facility'} />
            <Row
              label="Date & time"
              value={new Date(booking.startsAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            />
            <Row
              label="Duration"
              value={`${booking.durationHours} hour${booking.durationHours > 1 ? 's' : ''}`}
            />
            <Row label="Add-on" value={item?.addonName ?? 'None'} />
            <Row
              label="Server total"
              value={new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: booking.currency,
              }).format(booking.quotedAmountPaise / 100)}
            />
          </View>
        </Card>
        {isPending ? (
          <Button
            label="Pay Now"
            onPress={() => navigation.navigate('Payment', { bookingId: booking.id })}
          />
        ) : null}
        <Button variant="outline" label="View My Bookings" onPress={() => navigation.navigate('MyBookings')} />
      </ScrollView>
    </SafeAreaView>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-body-small text-text-secondary">{label}</Text>
      <Text className="flex-1 text-right text-body font-semibold text-text-primary">{value}</Text>
    </View>
  );
}
