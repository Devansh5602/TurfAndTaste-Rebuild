import { RootStack, AuthStack, CustomerStack } from './types';
import { useAuth } from '../context/AuthContext';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { FacilitiesScreen } from '../screens/customer/FacilitiesScreen';
import { FacilityDetailScreen } from '../screens/customer/FacilityDetailScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';
import { LoadingState } from '@turf-and-taste/ui-native';
import { useEffect, useState } from 'react';
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
      <CustomerStack.Screen name="Profile" component={ProfileScreen} />
    </CustomerStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingState label="Restoring session..." />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <RootStack.Screen name="Home" component={CustomerNavigator} />
          <RootStack.Screen name="Facilities" component={FacilitiesScreen} />
          <RootStack.Screen name="FacilityDetail" component={FacilityDetailScreen} />
          <RootStack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        <>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="SignIn" component={SignInScreen} />
          <RootStack.Screen name="CreateAccount" component={CreateAccountScreen} />
          <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </RootStack.Navigator>
  );
}
