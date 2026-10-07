import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { getBooking, type Booking } from '@turf-and-taste/api-client';
import { ThemeProvider } from '@turf-and-taste/ui-native';
import { BookingDetailScreen } from './BookingDetailScreen';

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
  getBooking: jest.fn(),
}));

const mockGetBooking = getBooking as unknown as jest.Mock;

const storage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
};

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
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
        bookingId: '5c4a7b82-a8a0-4ef9-8c98-68eb36f63f66',
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

function renderBookingDetail() {
  const queryClient = new QueryClient({
    // gcTime 0 keeps the query-cache timer from holding the test process open.
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <ThemeProvider storage={storage}>
      <QueryClientProvider client={queryClient}>
        <BookingDetailScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('BookingDetailScreen payment entry point', () => {
  beforeEach(() => {
    mockGetBooking.mockReset();
    storage.getItem.mockClear();
    storage.setItem.mockClear();
  });

  it('offers payment for a booking that is still awaiting payment', async () => {
    mockGetBooking.mockResolvedValue(booking());

    renderBookingDetail();

    expect(await screen.findByText('Pay Now')).toBeTruthy();
    expect(screen.getByText('Awaiting payment — no payment has been collected.')).toBeTruthy();
    expect(screen.getByText('Awaiting payment')).toBeTruthy();
    expect(screen.queryByText('Payment verified and booking confirmed.')).toBeNull();
  });

  it('hides payment for a booking the server already confirmed', async () => {
    mockGetBooking.mockResolvedValue(booking({ status: 'confirmed' }));

    renderBookingDetail();

    await screen.findByText('Payment verified and booking confirmed.');
    await waitFor(() => expect(screen.queryByText('Pay Now')).toBeNull());
    expect(screen.queryByText('Awaiting payment — no payment has been collected.')).toBeNull();
  });
});
