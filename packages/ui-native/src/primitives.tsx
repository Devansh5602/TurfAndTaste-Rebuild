import { themes } from '@turf-and-taste/design-tokens';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import ToastMessage from 'react-native-toast-message';
import type { ReactNode } from 'react';
import { useAppTheme } from './theme';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';

export function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 items-center justify-center rounded-md bg-primary px-4 disabled:opacity-50"
    >
      <Text className="text-body font-semibold text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress?: PressableProps['onPress'];
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center rounded-md border border-border bg-surface"
    >
      {children}
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-lg border border-border bg-surface p-4">{children}</View>;
}

export function Input(props: TextInputProps) {
  const { theme } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={themes[theme]['text-secondary']}
      className="min-h-11 rounded-md border border-border bg-surface px-3 text-body text-text-primary"
      {...props}
    />
  );
}

export function TextArea(props: TextInputProps) {
  return <Input multiline textAlignVertical="top" className="min-h-28 py-3" {...props} />;
}

export function Badge({ label }: { label: string }) {
  return (
    <View className="self-start rounded-full bg-surface-muted px-3 py-1">
      <Text className="text-caption text-text-primary">{label}</Text>
    </View>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <View accessibilityRole="text" className="self-start rounded-full bg-surface-muted px-3 py-1">
      <Text className="text-caption text-success">{label}</Text>
    </View>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-h1 font-bold text-text-primary">
        {title}
      </Text>
      {description ? <Text className="text-body text-text-secondary">{description}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" className="text-h2 font-semibold text-text-primary">
      {title}
    </Text>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View className="items-center rounded-lg border border-border bg-surface px-6 py-10">
      <Text className="text-title font-semibold text-text-primary">{title}</Text>
      <Text className="mt-2 text-center text-body-small text-text-secondary">{description}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" className="flex-row items-center gap-3">
      <ActivityIndicator />
      <Text className="text-body text-text-secondary">{label}</Text>
    </View>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <View accessibilityRole="alert" className="rounded-lg border border-danger bg-surface p-4">
      <Text className="text-title font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-body-small text-text-secondary">{description}</Text>
    </View>
  );
}

export function Skeleton() {
  return <View className="h-11 rounded-md bg-surface-muted" />;
}

export function Divider() {
  return <View className="h-px bg-border" />;
}

export function AppBottomSheet({ children }: { children: ReactNode }) {
  return (
    <BottomSheet index={-1} enablePanDownToClose snapPoints={['40%']}>
      <BottomSheetView className="bg-surface p-4">{children}</BottomSheetView>
    </BottomSheet>
  );
}

export const Toast = ToastMessage;
