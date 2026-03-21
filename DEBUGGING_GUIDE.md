# Debugging "Boolean Cannot be Cast to String" Error

## Quick Summary
The error occurs when you're passing a boolean value to a component or prop that expects a string.

## Step-by-Step Debugging

### Step 1: Enable Error Boundary
Your app now has an ErrorBoundary that will catch and display the exact error location.

```tsx
// Already added to app/_layout.tsx
<ErrorBoundary>
  <RootLayoutNav />
</ErrorBoundary>
```

### Step 2: Read the Error Message
When the error occurs, you'll see:
- Error message
- Component stack trace
- Debugging tips

### Step 3: Identify the Component
Look for the component mentioned in the stack trace. Usually it's one of:
- A Text component rendering a boolean
- A TextInput with boolean placeholder/value
- A style property with boolean value

### Step 4: Fix Using Safe Components

#### Use SafeText instead of Text
```tsx
import { SafeText } from '@/src/components/common/SafeText';

// ❌ WRONG
<Text>{someBoolean}</Text>

// ✅ CORRECT
<SafeText>{someBoolean}</SafeText>
```

#### Use SafeTextInput instead of TextInput
```tsx
import { SafeTextInput } from '@/src/components/common/SafeTextInput';

// ❌ WRONG
<TextInput placeholder={someBoolean} />

// ✅ CORRECT
<SafeTextInput placeholder={someBoolean} />
```

### Step 5: Fix the Root Cause

#### Problem 1: Boolean in Text Children
```tsx
// ❌ WRONG
const isActive = true;
<Text>{isActive}</Text>

// ✅ CORRECT - Option 1: Ternary
<Text>{isActive ? "Active" : "Inactive"}</Text>

// ✅ CORRECT - Option 2: Convert to string
<Text>{String(isActive)}</Text>

// ✅ CORRECT - Option 3: Use SafeText
<SafeText>{isActive}</SafeText>
```

#### Problem 2: Boolean with Logical AND
```tsx
// ⚠️  RISKY (can return boolean)
<Text>{isLoading && "Loading..."}</Text>

// ✅ CORRECT - Use ternary instead
<Text>{isLoading ? "Loading..." : ""}</Text>

// ✅ CORRECT - Use SafeText
<SafeText>{isLoading && "Loading..."}</SafeText>
```

#### Problem 3: TextInput with Boolean Value
```tsx
// ❌ WRONG
const isRequired = true;
<TextInput placeholder={isRequired} />

// ✅ CORRECT - Option 1: Ternary
<TextInput placeholder={isRequired ? "Required field" : "Optional"} />

// ✅ CORRECT - Option 2: Use SafeTextInput
<SafeTextInput placeholder={isRequired} />
```

#### Problem 4: AsyncStorage Storing Boolean
```tsx
// ❌ WRONG
await AsyncStorage.setItem('isActive', isActive);

// ✅ CORRECT - Option 1: Convert to string
await AsyncStorage.setItem('isActive', String(isActive));

// ✅ CORRECT - Option 2: JSON stringify
await AsyncStorage.setItem('isActive', JSON.stringify({ isActive }));

// ✅ CORRECT - Option 3: Always store strings
const themeSetting = isActive ? 'enabled' : 'disabled';
await AsyncStorage.setItem('theme', themeSetting);
```

#### Problem 5: Boolean in Style Properties
```tsx
// ❌ WRONG
const isVisible = true;
<View style={{ display: isVisible }} />

// ✅ CORRECT - Option 1: Ternary
<View style={{ display: isVisible ? 'flex' : 'none' }} />

// ✅ CORRECT - Option 2: Number for opacity
<View style={{ opacity: isVisible ? 1 : 0 }} />
```

## Using the Validation Hook

```tsx
import { usePropValidation } from '@/src/hooks/usePropValidation';

const MyComponent = ({ title, count, isActive }) => {
  // This will warn if types don't match
  usePropValidation(
    { title, count, isActive },
    {
      title: 'string',
      count: 'number',
      isActive: 'boolean',
    },
    'MyComponent'
  );

  return (
    <View>
      <SafeText>{title}</SafeText>
    </View>
  );
};
```

## Checking React Native Debugger

1. Open Developer Menu:
   - iOS: Cmd + D
   - Android: Cmd + M

2. Select "Show JS Errors"

3. Look for type-related errors

4. The component stack will show which component failed

## Common Files to Check

- `/app/notes.tsx` - Check all Text and TextInput props
- `/app/index.tsx` - Check dashboard components
- `/app/prompts.tsx` - Check rendering logic
- `/src/components/` - Check all custom components
- `/src/context/ThemeContext.tsx` - Already fixed ✓

## Prevention Strategy

### 1. Use TypeScript
Define strict types for all props:
```tsx
interface MyComponentProps {
  title: string;
  count: number;
  isActive: boolean;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, count, isActive }) => {
  // title is guaranteed to be string
  return <SafeText>{title}</SafeText>;
};
```

### 2. Use Safe Components
Always prefer SafeText and SafeTextInput:
```tsx
import { SafeText } from '@/src/components/common/SafeText';
import { SafeTextInput } from '@/src/components/common/SafeTextInput';
```

### 3. Validate Props at Runtime
Use the validation hook or propTypes:
```tsx
import PropTypes from 'prop-types';

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  isActive: PropTypes.bool,
};
```

### 4. Be Careful with Conditional Rendering
Always use ternary operator for text:
```tsx
// ❌ AVOID
{condition && value}  // Can return boolean

// ✅ PREFER
{condition ? value : ''}  // Always string or falsy
```

## If Error Still Occurs

1. **Check the error boundary output** - It shows the exact component
2. **Enable React DevTools** - See component tree
3. **Add console.log() statements** - Log prop values before rendering
4. **Search for similar patterns** - Find other instances of the same issue
5. **Use SearchText tool** - Search for problematic patterns in codebase

## Quick Reference

| Component | Problem | Solution |
|-----------|---------|----------|
| Text | Boolean child | Use ternary or SafeText |
| TextInput | Boolean placeholder | Use ternary or SafeTextInput |
| TextInput | Boolean value | Convert to string |
| Style | Boolean property | Use ternary for string/number |
| AsyncStorage | Boolean value | Use String() or JSON.stringify() |

---

**Remember**: When in doubt, use SafeText and SafeTextInput - they handle all edge cases automatically!

