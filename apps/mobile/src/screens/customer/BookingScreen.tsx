import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClientError,
  createBooking,
  createQuote,
  getAvailability,
  getFacility,
  getFacilityPricing,
  type BookingQuote,
} from '@turf-and-taste/api-client';
import {
  BOOKING_DURATION_HOURS,
  type AddOnKey,
  type BookingDurationHours,
} from '@turf-and-taste/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Skeleton,
} from '@turf-and-taste/ui-native';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  availabilityErrorView,
  describeAvailabilityErrorForDevLogs,
} from '../../booking/availabilityError';
import { bookingErrorView } from '../../booking/bookingError';
import { traceMobileRequest, traceNavigation } from '../../network/diagnostics';
import type { CustomerStackScreenProps } from '../../navigation/types';

type BookingRoute = CustomerStackScreenProps<'Booking'>['route'];
type BookingNavigation = CustomerStackScreenProps<'Booking'>['navigation'];

export function BookingScreen() {
  const route = useRoute<BookingRoute>();
  const navigation = useNavigation<BookingNavigation>();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const facilityKey = route.params.facilityKey;
  const [date, setDate] = useState(() => nextBusinessDate(0));
  const [durationHours, setDurationHours] = useState<BookingDurationHours>(
    BOOKING_DURATION_HOURS[0],
  );
  const [addOnKey, setAddOnKey] = useState<AddOnKey | undefined>();
  const [startTime, setStartTime] = useState<string>();
  const [quote, setQuote] = useState<BookingQuote>();
  const [notice, setNotice] = useState<string>();

  const withAuth = async <T,>(request: (url: string, token: string) => Promise<T>) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    if (!apiUrl) throw new Error('The API is not configured.');
    return request(apiUrl, token);
  };

  const facilityQuery = useQuery(
    queryOptions({
      queryKey: ['facility', facilityKey],
      queryFn: () => {
        if (!apiUrl) throw new Error('The API is not configured.');
        return traceMobileRequest('facility.detail', () => getFacility(apiUrl, facilityKey));
      },
      staleTime: 5 * 60_000,
    }),
  );
  const pricingQuery = useQuery(
    queryOptions({
      queryKey: ['facilityPricing', facilityKey],
      queryFn: () => {
        if (!apiUrl) throw new Error('The API is not configured.');
        return traceMobileRequest('facility.pricing', () =>
          getFacilityPricing(apiUrl, facilityKey),
        );
      },
      staleTime: 5 * 60_000,
    }),
  );
  const supportedDurations = useMemo(
    () =>
      BOOKING_DURATION_HOURS.filter((duration) =>
        pricingQuery.data?.some((tier) => tier.duration_hours === duration),
      ),
    [pricingQuery.data],
  );
  useEffect(() => {
    const firstSupported = supportedDurations[0];
    if (firstSupported && !supportedDurations.includes(durationHours)) {
      setDurationHours(firstSupported);
      setStartTime(undefined);
      setQuote(undefined);
      setNotice(undefined);
    }
  }, [durationHours, supportedDurations]);
  const availabilityQuery = useQuery(
    queryOptions({
      queryKey: ['availability', facilityKey, date, durationHours, addOnKey ?? null],
      queryFn: () =>
        traceMobileRequest('booking.availability', () =>
          withAuth((url, token) =>
            getAvailability(url, token, { facilityKey, date, durationHours, addOnKey }),
          ),
        ),
      enabled: supportedDurations.includes(durationHours),
      staleTime: 0,
      // Deterministic client errors (validation, auth, unknown facility) will not
      // change on retry; retry only transport/server failures, at most twice.
      retry: (failureCount, error) =>
        !(error instanceof ApiClientError && [400, 401, 403, 404, 422].includes(error.status)) &&
        failureCount < 2,
    }),
  );

  const invalidateQuote = () => {
    setQuote(undefined);
    setNotice(undefined);
  };
  const quoteMutation = useMutation({
    mutationFn: () => {
      if (!startTime) throw new Error('Select an available time.');
      return traceMobileRequest('booking.quote', () =>
        withAuth((url, token) =>
          createQuote(url, token, { facilityKey, date, startTime, durationHours, addOnKey }),
        ),
      );
    },
    onSuccess: (nextQuote) => {
      setQuote(nextQuote);
      setNotice(undefined);
    },
  });
  const bookingMutation = useMutation({
    mutationFn: () => {
      if (!quote || new Date(quote.expiresAt) <= new Date()) {
        throw new Error('The quote has expired. Refresh the price before continuing.');
      }
      return traceMobileRequest('booking.create', () =>
        withAuth((url, token) =>
          createBooking(url, token, {
            facilityKey: quote.facilityKey,
            date: quote.date,
            startTime: quote.startTime,
            durationHours: quote.durationHours,
            addOnKey: quote.addOnKey,
            quoteId: quote.id,
          }),
        ),
      );
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(['bookings', booking.id], booking);
      void queryClient.invalidateQueries({ queryKey: ['bookings'], exact: true });
      traceNavigation(`Booking -> BookingDetail booking=${booking.id}`);
      navigation.replace('BookingDetail', { bookingId: booking.id });
    },
    onError: (error) => {
      if (
        error instanceof ApiClientError &&
        ['SLOT_CONFLICT', 'QUOTE_EXPIRED'].includes(error.code)
      ) {
        setQuote(undefined);
        setStartTime(undefined);
        void availabilityQuery.refetch();
      }
      setNotice(bookingErrorView(error).description);
    },
  });

  const facility = facilityQuery.data;
  const shootingMachine = facility?.addons.find((addon) => addon.key === 'shooting-machine');
  const mutationError =
    quoteMutation.error instanceof Error ? quoteMutation.error.message : undefined;

  if (facilityQuery.isLoading) return <LoadingBooking />;
  if (facilityQuery.isError || !facility) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="p-6">
          <ErrorState title="Booking unavailable" description="The facility could not be loaded." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-5 px-6 py-8"
        refreshControl={
          <RefreshControl
            refreshing={availabilityQuery.isRefetching}
            onRefresh={() => void availabilityQuery.refetch()}
          />
        }
      >
        <PageHeader title="Book a facility" description={facility.name} />
        {notice ? <ErrorState title="Unable to create booking" description={notice} /> : null}
        {mutationError ? (
          <ErrorState title="Quote unavailable" description={mutationError} />
        ) : null}

        <StepCard number="1" title="Date">
          <View className="flex-row flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const value = nextBusinessDate(offset);
              return (
                <Choice
                  key={value}
                  label={shortDate(value)}
                  selected={date === value}
                  onPress={() => {
                    setDate(value);
                    setStartTime(undefined);
                    invalidateQuote();
                  }}
                />
              );
            })}
          </View>
        </StepCard>

        <StepCard number="2" title="Duration">
          {pricingQuery.isLoading ? (
            <Skeleton />
          ) : pricingQuery.isError ? (
            <View className="gap-3">
              <ErrorState
                title="Durations unavailable"
                description="Pricing could not be loaded. Try again."
              />
              <Button variant="outline" label="Retry" onPress={() => void pricingQuery.refetch()} />
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {supportedDurations.map((duration) => (
                <Choice
                  key={duration}
                  label={`${duration} hour${duration > 1 ? 's' : ''}`}
                  selected={durationHours === duration}
                  onPress={() => {
                    setDurationHours(duration);
                    setStartTime(undefined);
                    invalidateQuote();
                  }}
                />
              ))}
            </View>
          )}
        </StepCard>

        {shootingMachine ? (
          <StepCard number="3" title="Options">
            <Choice
              label="Shooting Machine"
              selected={addOnKey === shootingMachine.key}
              onPress={() => {
                setAddOnKey((current) => (current ? undefined : shootingMachine.key));
                setStartTime(undefined);
                invalidateQuote();
              }}
            />
          </StepCard>
        ) : null}

        <StepCard number={shootingMachine ? '4' : '3'} title="Available times">
          {availabilityQuery.isLoading ? (
            <View className="gap-2">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </View>
          ) : availabilityQuery.isError ? (
            <AvailabilityErrorState
              error={availabilityQuery.error}
              onRetry={() => void availabilityQuery.refetch()}
            />
          ) : availabilityQuery.data?.slots.length ? (
            <View className="flex-row flex-wrap gap-2">
              {availabilityQuery.data.slots.map((slot) => (
                <Choice
                  key={slot.startsAt}
                  label={formatInterval(slot.startsAt, durationHours)}
                  selected={startTime === slot.startTime}
                  onPress={() => {
                    setStartTime(slot.startTime);
                    invalidateQuote();
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No available times for this date"
              description="Try another date, duration, or option."
            />
          )}
        </StepCard>

        <StepCard number={shootingMachine ? '5' : '4'} title="Review">
          <Summary label="Facility" value={facility.name} />
          <Summary label="Date" value={longDate(date)} />
          <Summary
            label="Time"
            value={startTime ? formatLocalInterval(startTime, durationHours) : 'Select a time'}
          />
          <Summary
            label="Duration"
            value={`${durationHours} hour${durationHours > 1 ? 's' : ''}`}
          />
          <Summary label="Add-on" value={addOnKey ? (shootingMachine?.name ?? addOnKey) : 'None'} />
          {quote ? (
            <>
              <Summary
                label="Server quote"
                value={formatMoney(quote.amountPaise, quote.currency)}
              />
              <Text className="text-caption text-text-secondary">
                Valid until{' '}
                {new Date(quote.expiresAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </>
          ) : null}
          {!quote ? (
            <Button
              label={quoteMutation.isPending ? 'Getting quote...' : 'Get server quote'}
              disabled={!startTime || quoteMutation.isPending}
              onPress={() => quoteMutation.mutate()}
            />
          ) : (
            <Button
              label={bookingMutation.isPending ? 'Creating booking...' : 'Create booking'}
              disabled={bookingMutation.isPending}
              onPress={() => bookingMutation.mutate()}
            />
          )}
        </StepCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepCard({
  number,
  title,
  children,
}: {
  number: string | number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <View className="size-8 items-center justify-center rounded-full bg-primary">
            <Text className="font-semibold text-primary-foreground">{number}</Text>
          </View>
          <SectionHeader title={title} />
        </View>
        {children}
      </View>
    </Card>
  );
}
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-md border px-3 ${selected ? 'border-primary bg-primary' : 'border-border bg-surface-muted'}`}
    >
      <Text
        className={`text-body-small font-semibold ${selected ? 'text-primary-foreground' : 'text-text-primary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-body-small text-text-secondary">{label}</Text>
      <Text className="flex-1 text-right text-body font-semibold text-text-primary">{value}</Text>
    </View>
  );
}
function LoadingBooking() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-4 p-6">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </View>
    </SafeAreaView>
  );
}
function AvailabilityErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  useEffect(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(describeAvailabilityErrorForDevLogs(error));
    }
  }, [error]);
  const view = availabilityErrorView(error);
  return (
    <View className="gap-3">
      <ErrorState title={view.title} description={view.description} />
      {view.canRetry ? <Button variant="outline" label="Retry" onPress={onRetry} /> : null}
    </View>
  );
}
function nextBusinessDate(offset: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const date = new Date(Date.now() + offset * 86_400_000);
  return formatter.format(date);
}
function shortDate(value: string) {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
  });
}
function longDate(value: string) {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
function formatInstantTime(value: Date) {
  return value.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function formatInterval(startsAt: string, durationHours: BookingDurationHours) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return `${formatInstantTime(start)} – ${formatInstantTime(end)}`;
}
function formatLocalInterval(value: string, durationHours: BookingDurationHours) {
  const [hour = '0', minute = '00'] = value.split(':');
  const start = new Date(2000, 0, 1, Number(hour), Number(minute));
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  const options = { hour: 'numeric', minute: '2-digit' } as const;
  return `${start.toLocaleTimeString('en-IN', options)} – ${end.toLocaleTimeString('en-IN', options)}`;
}
function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100);
}
