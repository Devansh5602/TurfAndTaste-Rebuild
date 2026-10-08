import { AuthStack, CustomerStack } from './types';
import { useAuth } from '../context/AuthContext';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { FacilitiesScreen } from '../screens/customer/FacilitiesScreen';
import { FacilityDetailScreen } from '../screens/customer/FacilityDetailScreen';
import { BookingScreen } from '../screens/customer/BookingScreen';
import { BookingDetailScreen } from '../screens/customer/BookingDetailScreen';
import { PaymentScreen } from '../screens/customer/PaymentScreen';
import { MyBookingsScreen } from '../screens/customer/MyBookingsScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';
import { LoadingState } from '@turf-and-taste/ui-native';
import { View } from 'react-native';

export function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

export function CustomerNavigator() {
  return (
    <CustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerStack.Screen name="Home" component={HomeScreen} />
      <CustomerStack.Screen name="Facilities" component={FacilitiesScreen} />
      <CustomerStack.Screen name="FacilityDetail" component={FacilityDetailScreen} />
      <CustomerStack.Screen name="Booking" component={BookingScreen} />
      <CustomerStack.Screen name="MyBookings" component={MyBookingsScreen} />
      <CustomerStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <CustomerStack.Screen name="Payment" component={PaymentScreen} />
      <CustomerStack.Screen name="Profile" component={ProfileScreen} />
    </CustomerStack.Navigator>
  );
}

/**
 * Route guard.
 *
 * Auth initialization must finish before any redirect decision: while
 * `loading` is true (initial session hydration only) we render the session
 * restore state instead of a navigator, so a valid restored session never
 * flashes the Sign In screens.
 *
 * The session alone selects the root navigator. Swapping whole navigators on
 * session change gives deterministic entry routes — Home after login,
 * Welcome after logout — with no redirect loops and no dependency on
 * in-flight action state (sign-in actions never set `loading`).
 */
export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingState label="Restoring session..." />
      </View>
    );
  }

  return session ? <CustomerNavigator /> : <AuthNavigator />;
}
