import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Button, ErrorState, PageHeader } from '@turf-and-taste/ui-native';

/**
 * Recoverable state shown when a e-mail confirmation deep link cannot be
 * completed (expired, superseded, malformed, or consumed). It never crashes,
 * never shows raw Supabase error strings, and never navigates on its own —
 * both exits are explicit customer actions.
 *
 * Rendered at the root level by RootNavigator whenever the callback state is
 * `invalid`, so it works from any entry point (cold start from the mail app
 * included). "Resend verification email" appears only when the pending
 * address survived on this device; otherwise only Sign In is offered, since
 * resending an unknown address is impossible.
 */
export function AuthCallbackScreen() {
  const {
    emailConfirmation,
    pendingVerificationEmail,
    resendVerificationEmail,
    dismissEmailConfirmation,
  } = useAuth();
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  if (emailConfirmation.status !== 'invalid') {
    // Defensive: RootNavigator only renders this screen in the invalid state.
    return null;
  }

  const onResend = async () => {
    if (!pendingVerificationEmail || resendPending) return;
    setResendPending(true);
    setResendMessage(null);
    setResendError(null);
    const failure = await resendVerificationEmail(pendingVerificationEmail);
    setResendPending(false);
    if (failure) {
      setResendError(failure.message);
    } else {
      setResendMessage('Verification email sent. Check your inbox.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8">
        <PageHeader
          title="Confirm your email"
          description="Verification is required before you can sign in"
        />

        <ErrorState title={emailConfirmation.title} description={emailConfirmation.message} />

        {resendMessage && <Text className="text-body text-success">{resendMessage}</Text>}
        {resendError && <ErrorState title="Could not resend email" description={resendError} />}

        {pendingVerificationEmail && (
          <Button
            label={resendPending ? 'Sending...' : 'Resend verification email'}
            onPress={() => void onResend()}
            disabled={resendPending}
          />
        )}

        <Button
          variant="outline"
          label="Back to Sign In"
          onPress={() => dismissEmailConfirmation()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
