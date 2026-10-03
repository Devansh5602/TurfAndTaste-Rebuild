# UI kit

Tokens live in `@turf-and-taste/design-tokens`. Web primitives live in `@turf-and-taste/ui-web`. Native primitives live in `@turf-and-taste/ui-native`.

Themes: `clubhouse-ivory` and `midnight-ivory`. Both define the same semantic colors: background, surface, surface-muted, primary, primary-foreground, accent, accent-muted, text-primary, text-secondary, border, success, warning, danger, info, disabled, focus-ring, overlay.

Typography roles: display, h1, h2, h3, title, body, body-small, label, caption. The face is Plus Jakarta Sans.

Touch targets are at least 44px. Phone layouts should hold at 360, 375, 390, 412, and 430 CSS pixels. Respect safe areas, keyboard avoidance, focus rings, and screen-reader names.

Tailwind color utilities use the token name, so body text is `text-text-primary` and brand fill is `bg-primary`. That avoids treating the brand primary as the text color.

## Primitives

| Component | Purpose | Variants / sizes | States | Package | Web | Mobile |
| --- | --- | --- | --- | --- | --- | --- |
| Button | Primary action | primary, secondary, outline, ghost, danger; sm, md, lg | disabled, focus | Radix Slot, CVA | `Button` | `Button` label prop |
| IconButton | Icon-only action | — | disabled, focus | — | requires `label` | requires `label` |
| Card | Grouped surface | — | — | — | `Card` | `Card` |
| Input | Single-line text | — | disabled, focus, invalid | — | `Input` | `Input` |
| TextArea | Multi-line text | — | disabled, focus | — | `TextArea` | `TextArea` |
| Select | Choose one | — | disabled, focus | native `<select>` | `Select` | add when a screen needs it |
| Checkbox | Boolean | checked | focus | Radix Checkbox | `Checkbox` | add with a maintained native checkbox when a form needs it |
| Radio | Single choice in a group | checked | focus | Radix Radio Group | `RadioGroup`, `Radio` | same deferral as checkbox |
| Chip | Compact filter or attribute | — | — | — | `Chip` | use `Badge` until a filter UI exists |
| Badge | Neutral or status label | neutral, success, warning, danger, info | — | — | `Badge` | `Badge` |
| StatusBadge | Status announcement | success, warning, danger, info | — | — | `role="status"` | `StatusBadge` |
| Avatar | Initials | — | — | — | `Avatar` | add with the profile phase |
| FormField | Label, hint, error | — | error | — | `FormField` | compose `Text` and `Input` |
| Divider | Section break | — | — | — | `Divider` | `Divider` |
| PageHeader | Page title | — | — | — | `PageHeader` | `PageHeader` |
| SectionHeader | Section title | — | — | — | `SectionHeader` | `SectionHeader` |
| EmptyState | No data | — | — | — | `EmptyState` | `EmptyState` |
| LoadingState | Pending work | — | — | — | `role="status"` | `accessibilityRole="progressbar"` |
| ErrorState | Recoverable failure | — | — | — | `role="alert"` | `accessibilityRole="alert"` |
| Toast | Transient message | — | — | Sonner / react-native-toast-message | `Toaster`, `toast` | `Toast` |
| Modal | Blocking dialog | — | open, focus trap | Radix Dialog | `Modal` | use the bottom sheet for mobile tasks |
| BottomSheet | Mobile sheet | — | open, closed | `@gorhom/bottom-sheet` | not used | `AppBottomSheet` |
| Skeleton | Loading placeholder | — | — | — | `Skeleton` | `Skeleton` |

Interactive controls expose an accessible name, a visible focus ring on web, and a 44px minimum target. Icon buttons without a text label must set `label` or `accessibilityLabel`.

Forms use React Hook Form and Zod when a real form is introduced. The foundation screens only prove the input primitives.

Do not add a second button, modal, or toast implementation.
