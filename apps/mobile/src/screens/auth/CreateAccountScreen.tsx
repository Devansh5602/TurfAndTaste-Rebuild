import { z } from 'zod';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { ScrollView, SafeAreaView, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ExtendedNavigationProp } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SectionHeader,
  ErrorState,
} from '@turf-and-taste/ui-native';

const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

export function CreateAccountScreen() {
  const navigation = useNavigation<ExtendedNavigationProp>();
  const { signUp, resendVerificationEmail } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when Supabase created the account but requires e-mail verification
  // before it will issue a session. Rendering switches to an explicit
  // verification-required state instead of silently returning anywhere.
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<SignUpForm> = async (data) => {
    setSubmitting(true);
    setError(null);
    const result = await signUp(data.email, data.password, data.fullName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.verificationRequired) {
      setVerificationEmail(data.email);
      return;
    }
    // signedIn: the provider now holds the session and RootNavigator swaps to
    // the customer navigator (initial route Home). No explicit navigation —
    // the auth state transition owns the routing.
  };

  const onResendVerification = async () => {
    if (!verificationEmail || resendPending) return;
    setResendPending(true);
    setResendMessage(null);
    setResendError(null);
    const resendFailure = await resendVerificationEmail(verificationEmail);
    setResendPending(false);
    if (resendFailure) {
      setResendError(resendFailure.message);
    } else {
      setResendMessage('Verification email sent. Check your inbox.');
    }
  };

  if (verificationEmail) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="gap-6 px-6 py-8">
          <PageHeader
            title="Check your email"
            description="Account created. Please verify your email to continue."
          />

          <EmptyState
            title="Verification required"
            description={`We sent a verification link to ${verificationEmail}. Open it on this device, then sign in with your password.`}
          />

          {resendMessage && <Text className="text-body text-success">{resendMessage}</Text>}
          {resendError && <ErrorState title="Could not resend email" description={resendError} />}

          <Button
            label={resendPending ? 'Sending...' : 'Resend verification email'}
            onPress={onResendVerification}
            disabled={resendPending}
          />
          <Button
            variant="outline"
            label="Continue to Sign In"
            onPress={() => navigation.replace('SignIn')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <PageHeader
          title="Create your account"
          description="Join Turf & Taste to book facilities and more"
        />

        <Card>
          <View className="gap-4">
            <SectionHeader title="Full Name" />
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onBlur, onChange, value } }) => (
                <Input
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="John Doe"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  error={errors.fullName?.message}
                />
              )}
            />
          </View>

          <View className="gap-4">
            <SectionHeader title="Email" />
            <Controller
              control={control}
              name="email"
              render={({ field: { onBlur, onChange, value } }) => (
                <Input
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  error={errors.email?.message}
                />
              )}
            />
          </View>

          <View className="gap-4">
            <SectionHeader title="Password" />
            <Controller
              control={control}
              name="password"
              render={({ field: { onBlur, onChange, value } }) => (
                <Input
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          <View className="gap-4">
            <SectionHeader title="Confirm Password" />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onBlur, onChange, value } }) => (
                <Input
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          {error && <ErrorState title="Account creation failed" description={error} />}

          <Button
            label={submitting ? 'Creating account...' : 'Create account'}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            className="mt-2"
          />
        </Card>

        <View className="items-center gap-3">
          <Text className="text-body-small text-text-secondary">Already have an account?</Text>
          <Button variant="ghost" label="Sign in" onPress={() => navigation.navigate('SignIn')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
