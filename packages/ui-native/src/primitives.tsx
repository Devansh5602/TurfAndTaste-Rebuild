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

export type ButtonVariant = 'primary' | 'outline' | 'destructive' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-primary-foreground',
    outline: 'border border-border bg-surface text-text-primary',
    destructive: 'bg-danger text-danger-foreground',
    ghost: 'bg-transparent text-text-primary',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-md px-4 ${variantStyles[variant]} ${className} disabled:opacity-50`}
    >
      <Text className="text-body font-semibold">{label}</Text>
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

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      {children}
    </View>
  );
}

interface InputProps extends TextInputProps {
  error?: string;
  label?: string;
}

export function Input({ error, label, className = '', ...props }: InputProps) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-2">
      {label && <Text className="text-body-small font-medium text-text-secondary">{label}</Text>}
      <TextInput
        placeholderTextColor={themes[theme as keyof typeof themes]['text-secondary']}
        className={`min-h-11 rounded-md border border-border bg-surface px-3 text-body text-text-primary ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <Text className="text-body-small text-danger">{error}</Text>}
    </View>
  );
}

export function TextArea({ error, label, className = '', ...props }: InputProps) {
  const { theme } = useAppTheme();
  return (
    <View className="gap-2">
      {label && <Text className="text-body-small font-medium text-text-secondary">{label}</Text>}
      <TextInput
        placeholderTextColor={themes[theme as keyof typeof themes]['text-secondary']}
        className={`min-h-28 py-3 rounded-md border border-border bg-surface px-3 text-body text-text-primary ${error ? 'border-danger' : ''} ${className}`}
        multiline
        textAlignVertical="top"
        {...props}
      />
      {error && <Text className="text-body-small text-danger">{error}</Text>}
    </View>
  );
}

interface BadgeProps {
  label: string;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ label, variant = 'default', className = '' }: BadgeProps) {
  const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'bg-surface-muted text-text-primary',
    secondary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
  };

  const resolvedVariant = variant ?? 'default';
  return (
    <View
      className={`self-start rounded-full px-3 py-1 ${variantStyles[resolvedVariant]} ${className}`}
    >
      <Text className="text-caption font-medium">{label}</Text>
    </View>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <View accessibilityRole="text" className="self-start rounded-full bg-success/10 px-3 py-1">
      <Text className="text-caption font-medium text-success">{label}</Text>
    </View>
  );
}

export function PageHeader({
  title,
  description,
  className = '',
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <View className={`gap-2 ${className}`}>
      <Text accessibilityRole="header" className="text-h1 font-bold text-text-primary">
        {title}
      </Text>
      {description ? <Text className="text-body text-text-secondary">{description}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, className = '' }: { title: string; className?: string }) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-h2 font-semibold text-text-primary ${className}`}
    >
      {title}
    </Text>
  );
}

export function EmptyState({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <View
      className={`items-center rounded-lg border border-border bg-surface px-6 py-10 ${className}`}
    >
      <Text className="text-title font-semibold text-text-primary">{title}</Text>
      <Text className="mt-2 text-center text-body-small text-text-secondary">{description}</Text>
    </View>
  );
}

export function LoadingState({
  label = 'Loading',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <View accessibilityRole="progressbar" className={`flex-row items-center gap-3 ${className}`}>
      <ActivityIndicator />
      <Text className="text-body text-text-secondary">{label}</Text>
    </View>
  );
}

export function ErrorState({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      className={`rounded-lg border border-danger bg-surface p-4 ${className}`}
    >
      <Text className="text-title font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-body-small text-text-secondary">{description}</Text>
    </View>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`h-11 rounded-md bg-surface-muted ${className}`} />;
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-border ${className}`} />;
}

export function AppBottomSheet({ children }: { children: ReactNode }) {
  return (
    <BottomSheet index={-1} enablePanDownToClose snapPoints={['40%']}>
      <BottomSheetView className="bg-surface p-4">{children}</BottomSheetView>
    </BottomSheet>
  );
}

export const Toast = ToastMessage;
