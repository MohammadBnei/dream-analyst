# Atomic Design Architecture

This project follows the **Atomic Design** methodology for organizing frontend components. This approach creates a clear hierarchy from basic building blocks to complex compositions.

## Directory Structure

```
src/lib/client/components/
├── atoms/           # Basic building blocks (buttons, inputs, etc.)
├── molecules/       # Simple component combinations
├── organisms/       # Complex, reusable component sections
└── [legacy]/        # Old components (to be refactored)
```

## Component Hierarchy

### **Atoms** (`/atoms`)
Basic UI elements that can't be broken down further. These are the foundational building blocks.

- **Alert.svelte** - Dismissible alert boxes with variants (info, success, warning, error)
- **Badge.svelte** - Status badges with color variants
- **Button.svelte** - Buttons with variants (primary, secondary, ghost, etc.) and sizes
- **Icon.svelte** - SVG icon system with predefined icons
- **Input.svelte** - Text input fields with validation states
- **Link.svelte** - Styled anchor links with internal/external support
- **Select.svelte** - Dropdown select component
- **Spinner.svelte** - Loading spinners with different styles
- **TextArea.svelte** - Multi-line text input

**Usage Example:**
```svelte
<script>
  import { Button, Input, Alert } from '$lib/client/components/atoms';
</script>

<Button variant="primary" size="lg" onclick={handleClick}>
  Click Me
</Button>
```

### **Molecules** (`/molecules`)
Simple combinations of atoms that form discrete UI components.

- **ErrorAlert.svelte** - Error message display with dismissal
- **FormField.svelte** - Form field wrapper with label, hint, and error states
- **IconButton.svelte** - Button with icon (combines Button + Icon)
- **SearchBar.svelte** - Search input with submit and reset (combines Input + Button)
- **SortControl.svelte** - Dual select dropdowns for sorting
- **StatusIndicator.svelte** - Dream status badge (uses Badge atom)
- **ThemeToggle.svelte** - Dark/light mode switcher

**Usage Example:**
```svelte
<script>
  import { FormField, SearchBar } from '$lib/client/components/molecules';
  import { Input } from '$lib/client/components/atoms';
</script>

<FormField label="Username" name="username" required>
  <Input type="text" bind:value={username} />
</FormField>
```

### **Organisms** (`/organisms`)
Complex components built from atoms and molecules. These are major page sections.

- **Drawer.svelte** - Mobile navigation drawer
- **DreamCard.svelte** - Individual dream list item with expand/collapse
- **Navbar.svelte** - Main navigation bar
- **Pagination.svelte** - Paginated list controls
- **RichTextInput.svelte** - Advanced textarea with voice recording/transcription
- **SearchAndSort.svelte** - Combined search and sort interface

**Usage Example:**
```svelte
<script>
  import { Navbar, Drawer, Pagination } from '$lib/client/components/organisms';
</script>

<Navbar {isLoggedIn} {isAdmin} />
<Drawer {isLoggedIn} {isAdmin} />
```

## Design Principles

### 1. **Single Responsibility**
Each component has one clear purpose. Atoms handle basic UI, molecules combine atoms for specific tasks, organisms compose complex sections.

### 2. **Prop Consistency**
- All components accept a `class` prop for styling overrides
- Size props use consistent naming: `'xs' | 'sm' | 'md' | 'lg'`
- Variant props describe the component's appearance/behavior

### 3. **Accessibility First**
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Screen reader compatibility

### 4. **DaisyUI Integration**
Components leverage DaisyUI utility classes while maintaining flexibility for custom styling.

### 5. **Type Safety**
- All props are strictly typed
- Exported types for reusable enums (e.g., `IconName`, `ButtonVariant`)
- TypeScript-first approach

## Component API Patterns

### Atoms
```typescript
// Standard atom props
{
  variant?: 'primary' | 'secondary' | ...;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  class?: string;
  children: any;  // Svelte 5 snippet
}
```

### Form Components
```typescript
{
  name?: string;
  id?: string;
  value?: string | number;  // Use $bindable for two-way binding
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}
```

### Event Handlers
Use Svelte 5's `onclick`, `oninput`, etc. instead of directives:
```svelte
<Button onclick={handleClick}>Click</Button>
```

## Svelte 5 Runes

All components use Svelte 5 runes syntax:

- `$props()` for component parameters
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects
- `{@render children()}` instead of `<slot />`

## Migration Strategy

### Old Components
Legacy components in the root `/components` directory should be gradually migrated:

1. **Identify dependencies** - What atoms/molecules does it need?
2. **Create missing atoms/molecules** - Build reusable pieces
3. **Refactor organism** - Compose with new atoms/molecules
4. **Update imports** - Point to new component locations
5. **Test thoroughly** - Ensure behavior is preserved
6. **Remove old component** - Once fully replaced

### Import Best Practices

**Preferred (using index files):**
```svelte
import { Button, Input, Alert } from '$lib/client/components/atoms';
import { FormField, SearchBar } from '$lib/client/components/molecules';
import { Navbar, Pagination } from '$lib/client/components/organisms';
```

**Also valid (direct imports):**
```svelte
import Button from '$lib/client/components/atoms/Button.svelte';
```

## Benefits

1. **Reusability** - Atoms and molecules are highly reusable across pages
2. **Consistency** - UI patterns are enforced through shared components
3. **Maintainability** - Changes to base components cascade automatically
4. **Testability** - Small, focused components are easier to test
5. **Developer Experience** - Clear hierarchy makes it obvious where new components belong
6. **Type Safety** - Centralized type exports prevent duplication

## Future Improvements

- [ ] Add Storybook for component documentation
- [ ] Create visual regression tests
- [ ] Build more specialized molecules for common patterns
- [ ] Refactor remaining legacy components
- [ ] Add component unit tests with Vitest
- [ ] Create design tokens for theming
