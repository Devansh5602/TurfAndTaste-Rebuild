import { z } from 'zod';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInForm = z.infer<typeof signInSchema>;

export function SignInScreen() {
  const navigation = useNavigation<ExtendedNavigationProp>();
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<SignInForm> = async (data) => {
    setSubmitting(true);
    setError(null);
    const error = await signIn(data.email, data.password);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigation.replace('Home');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-6 py-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <PageHeader title="Welcome back" description="Sign in to your Turf & Taste account" />

        {error && <ErrorState title="Sign in failed" description={error} />}

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
                  autoComplete="password"
                  textContentType="password"
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          {error && !errors.email && !errors.password && (
            <ErrorState title="Sign in failed" description={error} />
          )}

          <Button
            label={submitting ? 'Signing in...' : 'Sign in'}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            className="mt-2"
          />
        </Card>

        <View className="items-center gap-3">
          <Text className="text-body-small text-text-secondary">Don't have an account?</Text>
          <Button
            variant="ghost"
            label="Create account"
            onPress={() => navigation.navigate('CreateAccount')}
          />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} className="mt-4">
          <Text className="text-body text-primary underline">Forgot password?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
