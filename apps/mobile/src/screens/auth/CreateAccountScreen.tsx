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
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    navigation.replace(result.signedIn ? 'Home' : 'SignIn');
  };

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

        {error && <ErrorState title="Account creation failed" description={error} />}

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

          {error &&
            !errors.fullName &&
            !errors.email &&
            !errors.password &&
            !errors.confirmPassword && (
              <ErrorState title="Account creation failed" description={error} />
            )}

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
