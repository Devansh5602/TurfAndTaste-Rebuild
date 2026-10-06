import { useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import {
  createPaymentOrder,
  getBooking,
  getRazorpayKeyId,
  verifyPayment,
  getPaymentOrder,
  type PaymentOrder,
} from '@turf-and-taste/api-client';
import { themes } from '@turf-and-taste/design-tokens';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  Skeleton,
  useAppTheme,
} from '@turf-and-taste/ui-native';
import { SafeAreaView, ScrollView, Text, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { CustomerStackScreenProps } from '../../navigation/types';
import RazorpayCheckout from 'react-native-razorpay';

type PaymentRoute = CustomerStackScreenProps<'Payment'>['route'];
type PaymentNavigation = CustomerStackScreenProps<'Payment'>['navigation'];

interface RazorpaySuccessData {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayError {
  code?: number | string;
  description?: string;
}

const ORDER_STATUS_BADGE: Record<
  PaymentOrder['status'] | 'none',
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  none: { label: 'No payment order', variant: 'default' },
  created: { label: 'Awaiting payment', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  expired: { label: 'Expired', variant: 'info' },
  refunded: { label: 'Refunded', variant: 'info' },
};

export function PaymentScreen() {
  const route = useRoute<PaymentRoute>();
  const navigation = useNavigation<PaymentNavigation>();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { theme } = useAppTheme();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const bookingId = route.params.bookingId;
  const [isProcessing, setIsProcessing] = useState(false);

  const withAuth = async <T,>(request: (url: string, token: string) => Promise<T>) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    if (!apiUrl) throw new Error('The API is not configured.');
    return request(apiUrl, token);
  };

  // Booking total comes from the server booking record, never from local math.
  const bookingQuery = useQuery(
    queryOptions({
      queryKey: ['bookings', bookingId],
      queryFn: () => withAuth((url, token) => getBooking(url, token, bookingId)),
      staleTime: 30 * 1000,
    }),
  );

  // The key id is public; the key secret stays on the server.
  const keyQuery = useQuery(
    queryOptions({
      queryKey: ['razorpayKeyId'],
      queryFn: () => withAuth((url, token) => getRazorpayKeyId(url, token)),
      staleTime: 10 * 60 * 1000,
    }),
  );

  // Existing payment order for this booking, if any.
  const paymentOrderQuery = useQuery(
    queryOptions({
      queryKey: ['paymentOrder', bookingId],
      queryFn: () => withAuth((url, token) => getPaymentOrder(url, token, bookingId)),
      enabled: !!bookingId,
      staleTime: 30 * 1000,
    }),
  );

  const paymentOrder = paymentOrderQuery.data ?? null;
  const paymentOrderStatus = paymentOrder?.status ?? 'none';

  const createOrderMutation = useMutation({
    mutationFn: () => withAuth((url, token) => createPaymentOrder(url, token, bookingId)),
    onSuccess: (order) => {
      queryClient.setQueryData(['paymentOrder', bookingId], order);
      launchRazorpayCheckout(order);
    },
    onError: (error) => {
      setIsProcessing(false);
      Alert.alert(
        'Payment Error',
        error instanceof Error ? error.message : 'Failed to create payment order.',
      );
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (input: { providerOrderId: string; providerPaymentId: string; signature: string }) =>
      withAuth((url, token) => verifyPayment(url, token, input)),
    onSuccess: async () => {
      setIsProcessing(false);
      await queryClient.invalidateQueries({ queryKey: ['paymentOrder', bookingId] });
      await queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] });
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigation.replace('BookingDetail', { bookingId });
    },
    onError: (error) => {
      setIsProcessing(false);
      Alert.alert(
        'Verification Failed',
        error instanceof Error
          ? error.message
          : 'Payment verification failed. Please try again or contact support.',
      );
    },
  });


  const handleStartPayment = () => {
    if (!keyQuery.data) {
      Alert.alert('Payment Not Configured', 'Razorpay is not configured. Please contact support.');
      return;
    }
    setIsProcessing(true);
    // Reuse an outstanding provider order instead of creating a duplicate.
    if (paymentOrder && paymentOrder.status === 'created') {
      launchRazorpayCheckout(paymentOrder);
      return;
    }
    createOrderMutation.mutate();
  };

  const launchRazorpayCheckout = (order: PaymentOrder) => {
    if (!keyQuery.data) {
      Alert.alert('Error', 'Razorpay key not available.');
      setIsProcessing(false);
      return;
    }

    const options = {
      description: 'Turf & Taste Booking Payment',
      currency: order.currency,
      key: keyQuery.data,
      amount: order.amountPaise,
      name: 'Turf & Taste',
      order_id: order.providerOrderId,
      theme: {
        color: themes[theme].primary,
      },
    };

    RazorpayCheckout.open(options)
      .then((data: RazorpaySuccessData) => {
        // The client sends the raw checkout result to the server; the server
        // verifies the signature and the captured payment before confirming.
        if (data.razorpay_payment_id && data.razorpay_order_id && data.razorpay_signature) {
          setIsProcessing(true);
          verifyPaymentMutation.mutate({
            providerOrderId: data.razorpay_order_id,
            providerPaymentId: data.razorpay_payment_id,
            signature: data.razorpay_signature,
          });
        } else {
          setIsProcessing(false);
          Alert.alert('Payment Incomplete', 'Payment was not completed. Please try again.');
        }
      })
      .catch((error: RazorpayError) => {
        setIsProcessing(false);
        const description = error.description ?? '';
        if (description.toLowerCase().includes('cancel')) {
          Alert.alert(
            'Payment Cancelled',
            'You cancelled the payment. You can try again when ready.',
          );
        } else {
          Alert.alert(
            'Payment Error',
            description || 'An error occurred during payment. Please try again.',
          );
        }
      });
  };

  const booking = bookingQuery.data ?? null;
  const badge = ORDER_STATUS_BADGE[paymentOrderStatus];

  const amountLabel = useMemo(() => {
    if (paymentOrder) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: paymentOrder.currency,
      }).format(paymentOrder.amountPaise / 100);
    }
    if (booking) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: booking.currency,
      }).format(booking.quotedAmountPaise / 100);
    }
    return null;
  }, [booking, paymentOrder]);

  const isBusy = isProcessing || createOrderMutation.isPending || verifyPaymentMutation.isPending;


  if (keyQuery.isLoading || bookingQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </View>
      </SafeAreaView>
    );
  }

  if (keyQuery.isError || bookingQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <ErrorState
            title="Payment Unavailable"
            description="Unable to load payment details. Please try again."
          />
          <Button
            variant="outline"
            label="Retry"
            onPress={() => {
              void keyQuery.refetch();
              void bookingQuery.refetch();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (paymentOrderQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <ErrorState
            title="Payment Status Unavailable"
            description="Unable to load the payment status for this booking."
          />
          <Button variant="outline" label="Retry" onPress={() => void paymentOrderQuery.refetch()} />
          <Button
            variant="ghost"
            label="Back to Booking"
            onPress={() => navigation.replace('BookingDetail', { bookingId })}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8">
        <PageHeader title="Complete Payment" description="Secure payment via Razorpay Test Mode" />

        <Card>
          <View className="gap-4">
            <View className="flex-row justify-between">
              <Text className="text-body-small text-text-secondary">Booking Reference</Text>
              <Text className="text-body font-semibold text-text-primary">
                {bookingId.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View className="items-center flex-row justify-between">
              <Text className="text-body-small text-text-secondary">Amount</Text>
              {paymentOrderQuery.isLoading ? (
                <LoadingState label="Loading amount..." />
              ) : (
                <Text className="text-title font-bold text-text-primary">{amountLabel ?? '—'}</Text>
              )}
            </View>
            <Badge label={badge.label} variant={badge.variant} />
          </View>
        </Card>

        {isBusy ? (
          <Card>
            <LoadingState label="Processing payment..." />
          </Card>
        ) : paymentOrderStatus === 'paid' ? (
          <Card>
            <View className="gap-3">
              <Text className="text-center text-body text-text-secondary">
                This booking has been paid and confirmed.
              </Text>
              <Button
                label="View Booking Details"
                variant="outline"
                onPress={() => navigation.replace('BookingDetail', { bookingId })}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <View className="gap-3">
              <Text className="text-center text-body text-text-secondary">
                {paymentOrderStatus === 'created'
                  ? 'A payment order has been created. Complete the payment to confirm your booking.'
                  : 'Ready to complete your booking payment.'}
              </Text>
              <Button
                label={paymentOrderStatus === 'created' ? 'Proceed to Payment' : 'Pay Now'}
                onPress={handleStartPayment}
                disabled={isBusy || !keyQuery.data}
              />
            </View>
          </Card>
        )}

        <Card>
          <View className="gap-3">
            <Text className="text-center text-body-small text-text-secondary">
              This is a TEST payment using Razorpay Test Mode. No real money will be charged.
            </Text>
            <Button
              variant="outline"
              label="Back to Booking"
              onPress={() => navigation.replace('BookingDetail', { bookingId })}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
