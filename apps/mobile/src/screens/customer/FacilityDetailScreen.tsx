import { useQuery, queryOptions } from '@tanstack/react-query';
import { getFacility, getFacilityPricing, getFacilitySchedule } from '@turf-and-taste/api-client';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Skeleton,
} from '@turf-and-taste/ui-native';
import { SafeAreaView, ScrollView, View, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { CustomerStackScreenProps } from '../../navigation/types';

export function FacilityDetailScreen() {
  const { getAccessToken } = useAuth();
  const route = useRoute<CustomerStackScreenProps<'FacilityDetail'>['route']>();
  const facilityKey = route.params.facilityKey;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  const facilityQuery = queryOptions({
    queryKey: ['facility', facilityKey],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      if (!apiUrl) throw new Error('Missing API URL');
      return getFacility(apiUrl, token, facilityKey);
    },
    enabled: !!facilityKey,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: facility,
    isLoading: facilityLoading,
    isError: facilityError,
  } = useQuery(facilityQuery);

  const pricingQuery = queryOptions({
    queryKey: ['facilityPricing', facilityKey],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      if (!apiUrl) throw new Error('Missing API URL');
      return getFacilityPricing(apiUrl, token, facilityKey);
    },
    enabled: !!facilityKey,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pricing } = useQuery(pricingQuery);

  const scheduleQuery = queryOptions({
    queryKey: ['facilitySchedule', facilityKey],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      if (!apiUrl) throw new Error('Missing API URL');
      return getFacilitySchedule(apiUrl, token, facilityKey);
    },
    enabled: !!facilityKey,
    staleTime: 5 * 60 * 1000,
  });

  const { data: schedule } = useQuery(scheduleQuery);

  if (facilityLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="px-6 py-8">
          <PageHeader title="Loading..." description="" />
          <View className="gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (facilityError || !facility) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="px-6 py-8">
          <ErrorState
            title="Facility not found"
            description="This facility doesn't exist or isn't available"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8">
        <PageHeader title={facility.name} description={getFacilityDescription(facility.key)} />

        <Card>
          <View className="gap-4">
            <SectionHeader title="About this facility" />
            <Text className="text-body text-text-secondary">
              {getFacilityLongDescription(facility.key)}
            </Text>

            {facility.addons && facility.addons.length > 0 && (
              <View className="gap-3 mt-4">
                <SectionHeader title="Available Add-ons" />
                <View className="flex-row flex-wrap gap-2">
                  {facility.addons.map((addon) => (
                    <Badge key={addon.id} label={addon.name} />
                  ))}
                </View>
              </View>
            )}
          </View>
        </Card>

        {pricing && pricing.length > 0 && (
          <Card>
            <View className="gap-4">
              <SectionHeader title="Pricing" />
              <Text className="text-body-small text-text-secondary">
                All prices in INR. Add-ons increase the base price.
              </Text>
              <View className="gap-2">
                {pricing.map((tier) => (
                  <PricingRow
                    key={tier.id}
                    duration={tier.duration_hours}
                    amount={tier.amount_paise}
                    addon={tier.addon_id}
                    currency={tier.currency}
                  />
                ))}
              </View>
            </View>
          </Card>
        )}

        {schedule && schedule.length > 0 && (
          <Card>
            <View className="gap-4">
              <SectionHeader title="Operating Hours" />
              <View className="gap-2">
                {schedule.map((s) => (
                  <ScheduleRow
                    key={s.id}
                    weekday={s.weekday}
                    opens={s.opens_at}
                    closes={s.closes_at}
                  />
                ))}
              </View>
            </View>
          </Card>
        )}

        <Card>
          <View className="gap-4">
            <SectionHeader title="Ready to book?" />
            <Text className="text-body text-text-secondary">
              Booking functionality coming in the next phase.
            </Text>
            <Button
              variant="outline"
              label="View availability (coming soon)"
              onPress={() => {}}
              disabled
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PricingRow({
  duration,
  amount,
  addon,
  currency,
}: {
  duration: number;
  amount: number;
  addon: string | null;
  currency: string;
}) {
  const amountInRupees = (amount / 100).toLocaleString('en-IN');
  return (
    <View className="flex-row items-center justify-between py-2 px-3 rounded-md bg-surface-muted">
      <View className="flex-row items-center gap-2">
        <Text className="text-body font-medium text-text-primary">{duration} hour</Text>
        {addon && <Badge label="+ Shooting Machine" variant="secondary" />}
      </View>
      <Text className="text-title font-semibold text-text-primary">
        {currency} {amountInRupees}
      </Text>
    </View>
  );
}

function ScheduleRow({
  weekday,
  opens,
  closes,
}: {
  weekday: number;
  opens: string;
  closes: string;
}) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <View className="flex-row items-center justify-between py-2 px-3 rounded-md bg-surface-muted">
      <Text className="text-body font-medium text-text-primary">{days[weekday]}</Text>
      <Text className="text-body text-text-secondary">
        {formatTime(opens)} - {formatTime(closes)}
      </Text>
    </View>
  );
}

function formatTime(time: string): string {
  const parts = time.split(':');
  const hours = parts[0];
  const minutes = parts[1] ?? '00';
  const h = parseInt(hours ?? '0', 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getFacilityDescription(key: string): string {
  switch (key) {
    case 'box-cricket':
      return 'Indoor box cricket arena with professional lighting and turf';
    case 'skating-rink':
      return 'Indoor skating rink with smooth surface and safety barriers';
    case 'pickle-ball':
      return 'Indoor pickle ball courts with professional court markings';
    case 'cricket-green-net':
      return 'Professional cricket practice nets with bowling machine option';
    default:
      return 'Sports facility';
  }
}

function getFacilityLongDescription(key: string): string {
  switch (key) {
    case 'box-cricket':
      return 'Our indoor box cricket arena features professional-grade artificial turf, LED floodlights, and a fully enclosed playing area. Perfect for casual games or competitive matches. The arena accommodates 6-8 players per side and includes stumps, boundary nets, and scoreboard.';
    case 'skating-rink':
      return 'Our indoor skating rink offers a smooth, polished surface perfect for both beginners and experienced skaters. Safety barriers line the perimeter, and we provide skate rentals in multiple sizes. The rink is climate-controlled for year-round comfort.';
    case 'pickle-ball':
      return 'Our indoor pickle ball courts feature professional-grade court surfaces with official line markings. Courts are available for singles and doubles play. Paddles and balls are available for rent. Suitable for all skill levels.';
    case 'cricket-green-net':
      return 'Our cricket practice facility features multiple net lanes with professional-grade turf wickets. Bowling machines are available as an add-on for batting practice. The facility includes proper lighting, bowling markers, and run-up areas suitable for all levels of practice.';
    default:
      return 'Sports facility at Turf & Taste.';
  }
}
