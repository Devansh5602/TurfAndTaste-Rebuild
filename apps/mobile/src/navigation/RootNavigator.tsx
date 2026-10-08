import { AuthStack, CustomerStack, type AuthStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { AuthCallbackScreen } from '../screens/auth/AuthCallbackScreen';
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

export function AuthNavigator({
  initialRouteName,
}: {
  initialRouteName?: keyof AuthStackParamList;
} = {}) {
  return (
    <AuthStack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
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
 *
 * The e-mail confirmation callback is the only exception with its own
 * root-level states: `processing` while a deep link is being exchanged and
 * `invalid` for the branded recoverable state. Both are driven exclusively
 * by URL arrival and user action, so they cannot loop; once a session
 * exists the customer navigator wins unconditionally.
 */
export function RootNavigator() {
  const { session, loading, emailConfirmation } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingState label="Restoring session..." />
      </View>
    );
  }

  if (session) {
    return <CustomerNavigator />;
  }

  if (emailConfirmation.status === 'processing') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingState label="Completing verification..." />
      </View>
    );
  }

  if (emailConfirmation.status === 'invalid') {
    return <AuthCallbackScreen />;
  }

  // signInEntry: remount the auth stack directly on Sign In (fresh mount, so
  // initialRouteName applies). Every other signed-out state starts at Welcome.
  return (
    <AuthNavigator
      initialRouteName={emailConfirmation.status === 'signInEntry' ? 'SignIn' : undefined}
    />
  );
}
