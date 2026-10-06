import { useNavigation } from '@react-navigation/native';
import { View, SafeAreaView } from 'react-native';
import { Button, PageHeader, Card, EmptyState, SectionHeader } from '@turf-and-taste/ui-native';
import { PROPERTY } from '@turf-and-taste/types';

export function WelcomeScreen() {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6 py-8">
        <PageHeader
          title={PROPERTY.name}
          description={`${PROPERTY.locality}, ${PROPERTY.region}, ${PROPERTY.country}`}
          className="items-center text-center"
        />

        <EmptyState
          title="Your clubhouse for sports & dining"
          description="Book cricket nets, skating rink, pickle ball, and box cricket — all in one place."
        />

        <Card className="w-full mt-8">
          <View className="gap-3">
            <SectionHeader title="Get started" />
            <Button
              label="Create account"
              onPress={() => navigation.navigate('CreateAccount')}
              className="w-full"
            />
            <Button
              variant="outline"
              label="Sign in"
              onPress={() => navigation.navigate('SignIn')}
              className="w-full"
            />
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}
