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
  Input,
  PageHeader,
  SectionHeader,
  ErrorState,
  EmptyState,
} from '@turf-and-taste/ui-native';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<ExtendedNavigationProp>();
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<ForgotPasswordForm> = async (data) => {
    setSubmitting(true);
    setError(null);
    const error = await resetPassword(data.email);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="gap-6 px-6 py-8"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <PageHeader
            title="Check your email"
            description="We've sent a password reset link to your email address"
          />
          <EmptyState
            title="Reset email sent"
            description="Follow the link in the email to create a new password. The link expires in 24 hours."
          />
          <Button label="Back to sign in" onPress={() => navigation.navigate('SignIn')} />
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
          title="Forgot password?"
          description="Enter your email and we'll send you a reset link"
        />

        {error && <ErrorState title="Failed to send reset email" description={error} />}

        <Card>
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

          {error && <ErrorState title="Failed to send reset email" description={error} />}

          <Button
            label={submitting ? 'Sending...' : 'Send reset link'}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            className="mt-2"
          />
        </Card>

        <View className="items-center gap-3">
          <Text className="text-body-small text-text-secondary">Remember your password?</Text>
          <Button variant="ghost" label="Sign in" onPress={() => navigation.navigate('SignIn')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
