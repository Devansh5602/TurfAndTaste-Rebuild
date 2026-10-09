import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  createBooking,
  createQuote,
  getAvailability,
  getFacility,
  getFacilityPricing,
} from '@turf-and-taste/api-client';
import { ThemeProvider } from '@turf-and-taste/ui-native';
import { BookingScreen } from './BookingScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: { facilityKey: 'box-cricket' } }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: jest.fn().mockResolvedValue('customer-token') }),
}));

jest.mock('@turf-and-taste/api-client', () => {
  // Same class identity the screen and the classifier see, so `instanceof` holds.
  class ApiClientError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.name = 'ApiClientError';
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiClientError,
    createBooking: jest.fn(),
    createQuote: jest.fn(),
    getAvailability: jest.fn(),
    getFacility: jest.fn(),
    getFacilityPricing: jest.fn(),
  };
});

const { ApiClientError } = jest.requireMock('@turf-and-taste/api-client') as {
  ApiClientError: new (
    message: string,
    status: number,
    code: string,
  ) => Error & { status: number; code: string };
};

const api = {
  createBooking: createBooking as unknown as jest.Mock,
  createQuote: createQuote as unknown as jest.Mock,
  getAvailability: getAvailability as unknown as jest.Mock,
  getFacility: getFacility as unknown as jest.Mock,
  getFacilityPricing: getFacilityPricing as unknown as jest.Mock,
};

const storage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
};

const facility = {
  id: 'facility-1',
  key: 'box-cricket' as const,
  name: 'Box Cricket',
  active: true,
  addons: [],
};

const pricing = [
  {
    id: 'tier-1',
    facility_id: 'facility-1',
    addon_id: null,
    duration_hours: 1 as const,
    amount_paise: 80000,
    currency: 'INR',
  },
  {
    id: 'tier-2',
    facility_id: 'facility-1',
    addon_id: null,
    duration_hours: 2 as const,
    amount_paise: 150000,
    currency: 'INR',
  },
];

const slot = { startTime: '06:00', startsAt: '2099-01-01T00:30:00.000Z' };
const mockReplace = jest.fn();
const listing = {
  serverNow: '2098-12-31T18:30:00.000Z',
  businessTimeZone: 'Asia/Kolkata' as const,
  date: '2099-01-01',
  durationHours: 1 as const,
  slots: [slot],
};

function nextBusinessDate(offset: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + offset * 86_400_000),
  );
}
function shortDate(value: string) {
  return new Date(`${value}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
  });
}
function slotLabel(startsAt: string, durationHours = 1) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  const options = {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  } as const;
  return `${start.toLocaleTimeString('en-IN', options)} – ${end.toLocaleTimeString('en-IN', options)}`;
}

function renderBookingScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: 0, staleTime: 0 },
      mutations: { gcTime: 0, retry: false },
    },
  });
  return render(
    <ThemeProvider storage={storage}>
      <QueryClientProvider client={queryClient}>
        <BookingScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.getFacility.mockResolvedValue(facility);
  api.getFacilityPricing.mockResolvedValue(pricing);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookingScreen availability states', () => {
  it('shows a classified server error with retry', async () => {
    api.getAvailability.mockRejectedValue(
      new ApiClientError('Failed to fetch availability.', 500, 'DATABASE_ERROR'),
    );

    renderBookingScreen();

    expect(await screen.findByText('Something went wrong', {}, { timeout: 5_000 })).toBeTruthy();
    expect(
      await screen.findByText(
        'The service is temporarily unavailable. Please try again shortly.',
        {},
        { timeout: 5_000 },
      ),
    ).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('shows a session recovery message for auth failures', async () => {
    api.getAvailability.mockRejectedValue(
      new ApiClientError('Authentication required.', 401, 'UNAUTHENTICATED'),
    );

    renderBookingScreen();

    expect(await screen.findByText('Your session has expired')).toBeTruthy();
    expect(screen.queryByText('Check your internet connection and try again.')).toBeNull();
  });

  it('shows an actionable message for invalid requests', async () => {
    api.getAvailability.mockRejectedValue(
      new ApiClientError('Unknown facility.', 404, 'NOT_FOUND'),
    );

    renderBookingScreen();

    expect(await screen.findByText('This selection cannot be booked')).toBeTruthy();
  });

  it('distinguishes an empty result from a failed request', async () => {
    api.getAvailability.mockResolvedValue({ ...listing, slots: [] });

    renderBookingScreen();

    expect(await screen.findByText('No available times for this date')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders exactly one Review section while availability is loading', async () => {
    api.getAvailability.mockReturnValue(new Promise(() => undefined));

    renderBookingScreen();

    expect(await screen.findByText('Review')).toBeTruthy();
    expect(screen.getAllByText('Review')).toHaveLength(1);
  });

  it('renders real slots and clears the quote when the date changes', async () => {
    api.getAvailability.mockResolvedValue(listing);
    api.createQuote.mockResolvedValue({
      id: 'quote-1',
      facilityKey: 'box-cricket',
      facilityId: 'facility-1',
      date: listing.date,
      startTime: slot.startTime,
      durationHours: 1,
      addOnKey: undefined,
      addonKey: undefined,
      startsAt: slot.startsAt,
      amountPaise: 80000,
      currency: 'INR',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });

    renderBookingScreen();

    const interval = await screen.findByText(slotLabel(slot.startsAt));
    expect(interval).toBeTruthy();
    expect(screen.getAllByText('Review')).toHaveLength(1);
    fireEvent.press(interval);
    fireEvent.press(await screen.findByText('Get server quote'));

    expect(await screen.findByText('Create booking')).toBeTruthy();
    expect(api.createQuote).toHaveBeenCalledWith(
      expect.any(String),
      'customer-token',
      expect.objectContaining({ facilityKey: 'box-cricket', startTime: '06:00', durationHours: 1 }),
    );

    // Changing the date must clear both the selected slot and the server quote.
    fireEvent.press(screen.getByText(shortDate(nextBusinessDate(2))));

    await waitFor(() => {
      expect(screen.queryByText('Create booking')).toBeNull();
      expect(screen.getByText('Get server quote')).toBeTruthy();
    });
  });

  it('submits once with the real quote and navigates with the returned booking id', async () => {
    api.getAvailability.mockResolvedValue(listing);
    api.createQuote.mockResolvedValue({
      id: 'quote-1',
      facilityKey: 'box-cricket',
      facilityId: 'facility-1',
      date: listing.date,
      startTime: slot.startTime,
      durationHours: 1,
      startsAt: slot.startsAt,
      amountPaise: 80000,
      currency: 'INR',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    api.createBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'pending',
      items: [],
    });

    renderBookingScreen();
    fireEvent.press(await screen.findByText(slotLabel(slot.startsAt)));
    fireEvent.press(screen.getByText('Get server quote'));
    fireEvent.press(await screen.findByText('Create booking'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('BookingDetail', { bookingId: 'booking-1' }),
    );
    expect(api.createBooking).toHaveBeenCalledTimes(1);
    expect(api.createBooking).toHaveBeenCalledWith(expect.any(String), 'customer-token', {
      facilityKey: 'box-cricket',
      date: listing.date,
      startTime: '06:00',
      durationHours: 1,
      addOnKey: undefined,
      quoteId: 'quote-1',
    });
  });
});
