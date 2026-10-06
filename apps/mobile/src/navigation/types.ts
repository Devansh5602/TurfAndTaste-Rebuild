import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import type { FacilityKey } from '@turf-and-taste/types';

export type RootStackParamList = {
  // Auth Stack
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;

  // Customer App
  Home: undefined;
  Facilities: undefined;
  FacilityDetail: { facilityKey: FacilityKey };
  Profile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
};

export type CustomerStackParamList = {
  Home: undefined;
  Facilities: undefined;
  FacilityDetail: { facilityKey: FacilityKey };
  Profile: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type CustomerStackScreenProps<T extends keyof CustomerStackParamList> =
  NativeStackScreenProps<CustomerStackParamList, T>;

// Extended navigation prop with replace method
export type ExtendedNavigationProp = NativeStackNavigationProp<RootStackParamList> & {
  replace: (name: keyof RootStackParamList, params?: Record<string, unknown>) => void;
};

export const RootStack = createNativeStackNavigator<RootStackParamList>();
export const AuthStack = createNativeStackNavigator<AuthStackParamList>();
export const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();
