import { useNavigation } from '@react-navigation/native';
import { Button, Card, ErrorState, PageHeader, SectionHeader } from '@turf-and-taste/ui-native';
import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { ExtendedNavigationProp } from '../../navigation/types';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<ExtendedNavigationProp>();
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setError(null);
    const signOutError = await signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    navigation.replace('Welcome');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-6 py-8">
        <PageHeader title="Account" description="Your signed-in customer account" />

        {error ? <ErrorState title="Unable to sign out" description={error} /> : null}

        <Card>
          <View className="gap-4">
            <SectionHeader title="Signed in as" />
            <Text className="text-body text-text-primary">{user?.email ?? 'Customer'}</Text>
          </View>
        </Card>

        <Button variant="destructive" label="Sign Out" onPress={handleSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
