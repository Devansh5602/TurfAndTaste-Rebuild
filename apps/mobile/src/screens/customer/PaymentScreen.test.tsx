import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  createPaymentOrder,
  getBooking,
  getPaymentOrder,
  getRazorpayKeyId,
  verifyPayment,
  type Booking,
  type PaymentOrder,
} from '@turf-and-taste/api-client';
import { ThemeProvider } from '@turf-and-taste/ui-native';
import { Alert } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { PaymentScreen } from './PaymentScreen';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const replace = jest.fn();
  return {
    useNavigation: () => ({ navigate, replace }),
    useRoute: () => ({ params: { bookingId: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66' } }),
    __testNavigation: { navigate, replace },
  };
});

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: jest.fn().mockResolvedValue('customer-token') }),
}));

jest.mock('@turf-and-taste/api-client', () => ({
  createPaymentOrder: jest.fn(),
  getBooking: jest.fn(),
  getPaymentOrder: jest.fn(),
  getRazorpayKeyId: jest.fn(),
  verifyPayment: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  __esModule: true,
  default: { open: jest.fn() },
}));

const bookingId = '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66';
const api = {
  createPaymentOrder: createPaymentOrder as unknown as jest.Mock,
  getBooking: getBooking as unknown as jest.Mock,
  getPaymentOrder: getPaymentOrder as unknown as jest.Mock,
  getRazorpayKeyId: getRazorpayKeyId as unknown as jest.Mock,
  verifyPayment: verifyPayment as unknown as jest.Mock,
};
const checkout = RazorpayCheckout as unknown as { open: jest.Mock };
const { __testNavigation } = jest.requireMock('@react-navigation/native') as {
  __testNavigation: { navigate: jest.Mock; replace: jest.Mock };
};

const storage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
};

function pendingBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: bookingId,
    customerProfileId: 'customer-1',
    status: 'pending',
    startsAt: '2026-10-12T14:00:00.000Z',
    durationHours: 1,
    quotedAmountPaise: 50000,
    currency: 'INR',
    quoteExpiresAt: '2026-10-07T14:00:00.000Z',
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        bookingId,
        facilityId: 'facility-1',
        facilityKey: 'box-cricket',
        facilityName: 'Box Cricket',
        addonId: null,
        addonKey: null,
        addonName: null,
        amountPaise: 50000,
      },
    ],
    ...overrides,
  };
}

function serverOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 'payment-order-1',
    bookingId,
    provider: 'razorpay',
    providerOrderId: 'order_test_1',
    amountPaise: 50000,
    currency: 'INR',
    status: 'created',
    createdAt: '2026-10-07T10:00:00.000Z',
    ...overrides,
  };
}

function renderPaymentScreen() {
  const queryClient = new QueryClient({
    // gcTime 0 keeps the query-cache timer from holding the test process open.
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { gcTime: 0, retry: false },
    },
  });
  return render(
    <ThemeProvider storage={storage}>
      <QueryClientProvider client={queryClient}>
        <PaymentScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.createPaymentOrder.mockReset();
  api.getBooking.mockReset();
  api.getPaymentOrder.mockReset();
  api.getRazorpayKeyId.mockReset();
  api.verifyPayment.mockReset();
  checkout.open.mockReset();

  api.getBooking.mockResolvedValue(pendingBooking());
  api.getRazorpayKeyId.mockResolvedValue('rzp_test_key');
  api.getPaymentOrder.mockResolvedValue(null);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PaymentScreen checkout boundary', () => {
  it('shows the server total, then sends the raw checkout result for verification', async () => {
    api.createPaymentOrder.mockResolvedValue(serverOrder());
    checkout.open.mockResolvedValue({
      razorpay_payment_id: 'pay_test_1',
      razorpay_order_id: 'order_test_1',
      razorpay_signature: 'signature',
    });
    api.verifyPayment.mockResolvedValue({
      id: 'payment-1',
      paymentOrderId: 'payment-order-1',
      provider: 'razorpay',
      providerPaymentId: 'pay_test_1',
      status: 'captured',
      verifiedAt: '2026-10-07T10:05:00.000Z',
      createdAt: '2026-10-07T10:05:00.000Z',
    });

    renderPaymentScreen();
    await screen.findByText('Pay Now', {}, { timeout: 5000 });
    expect(screen.getByText('₹500.00')).toBeTruthy();
    expect(screen.getByText(/No real money will be charged/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Pay Now'));

    await waitFor(() => expect(api.createPaymentOrder).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    // The client only ever sends the booking id; the amount stays server-side.
    expect(api.createPaymentOrder.mock.calls[0]?.[2]).toBe(bookingId);

    await waitFor(
      () =>
        expect(api.verifyPayment).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
          providerOrderId: 'order_test_1',
          providerPaymentId: 'pay_test_1',
          signature: 'signature',
        }),
      { timeout: 5000 },
    );
    // Confirmation is handed back from the server, then the booking is reloaded.
    await waitFor(
      () => expect(__testNavigation.replace).toHaveBeenCalledWith('BookingDetail', { bookingId }),
      { timeout: 5000 },
    );
    expect(api.getBooking.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps a cancelled checkout on the pending booking without verifying', async () => {
    api.createPaymentOrder.mockResolvedValue(serverOrder());
    checkout.open.mockRejectedValue({ description: 'Payment cancelled by user' });

    renderPaymentScreen();
    await screen.findByText('Pay Now', {}, { timeout: 5000 });
    fireEvent.press(screen.getByLabelText('Pay Now'));

    await waitFor(
      () => expect(Alert.alert).toHaveBeenCalledWith('Payment Cancelled', expect.any(String)),
      { timeout: 5000 },
    );

    // No checkout result is ever sent to the server, and nothing is confirmed.
    expect(api.verifyPayment).not.toHaveBeenCalled();
    expect(__testNavigation.replace).not.toHaveBeenCalled();
    // The screen recovers and offers the outstanding order again.
    expect(await screen.findByText('Proceed to Payment', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('recovers from a failed payment-status read', async () => {
    api.getPaymentOrder.mockRejectedValueOnce(new Error('server error'));

    renderPaymentScreen();
    await screen.findByText('Payment Status Unavailable', {}, { timeout: 5000 });

    fireEvent.press(screen.getByLabelText('Retry'));

    await waitFor(() => expect(api.getPaymentOrder).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(await screen.findByText('Pay Now', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('hides payment for a booking the server already confirmed', async () => {
    api.getBooking.mockResolvedValue(pendingBooking({ status: 'confirmed' }));

    renderPaymentScreen();
    await screen.findByText('This booking has been paid and confirmed.', {}, { timeout: 5000 });

    // No payment action is offered for a booking the server already settled.
    expect(screen.queryByLabelText('Pay Now')).toBeNull();
    expect(screen.queryByLabelText('Proceed to Payment')).toBeNull();
    expect(screen.queryByText('Ready to complete your booking payment.')).toBeNull();
    fireEvent.press(screen.getByLabelText('View Booking Details'));
    expect(__testNavigation.replace).toHaveBeenCalledWith('BookingDetail', { bookingId });
    expect(api.createPaymentOrder).not.toHaveBeenCalled();
  });
});
