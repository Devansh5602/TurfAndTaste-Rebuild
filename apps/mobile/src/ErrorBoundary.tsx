import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.setState({ failed: true });
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-title font-semibold text-danger">This screen failed to load</Text>
        <Pressable
          accessibilityRole="button"
          className="mt-4 min-h-11 items-center justify-center rounded-md bg-primary px-4"
          onPress={() => this.setState({ failed: false })}
        >
          <Text className="font-semibold text-primary-foreground">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
