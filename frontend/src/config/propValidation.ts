/**
 * PropTypes Validation Configuration
 * Use these validators in your components to catch type mismatches early
 */

export const ComponentPropTypes = {
  // Text-related components
  TEXT_CHILDREN: {
    children: 'string | number | null | undefined',
  },

  TEXT_INPUT_PROPS: {
    placeholder: 'string | null | undefined',
    value: 'string | null | undefined',
    defaultValue: 'string | null | undefined',
  },

  // Common component props
  BUTTON_PROPS: {
    onPress: 'function',
    title: 'string',
    disabled: 'boolean',
  },

  IMAGE_PROPS: {
    source: 'object',
    alt: 'string | null',
  },

  VIEW_PROPS: {
    style: 'object | null',
  },
};

/**
 * Common patterns that cause "Boolean cannot be cast to String"
 */
export const DangerousPatterns = [
  {
    pattern: '<Text>{isActive}</Text>',
    issue: 'Boolean rendered directly',
    fix: '<Text>{isActive ? "Yes" : "No"}</Text>',
  },
  {
    pattern: '<Text>{isLoading && "Loading"}</Text>',
    issue: 'Can return true boolean',
    fix: '<Text>{isLoading ? "Loading" : ""}</Text>',
  },
  {
    pattern: '<TextInput placeholder={isRequired} />',
    issue: 'Boolean placeholder',
    fix: '<TextInput placeholder={isRequired ? "Required" : "Optional"} />',
  },
  {
    pattern: 'await AsyncStorage.setItem("key", booleanValue)',
    issue: 'Boolean stored as-is',
    fix: 'await AsyncStorage.setItem("key", String(booleanValue))',
  },
  {
    pattern: '<View style={{ display: isVisible }} />',
    issue: 'Boolean style value',
    fix: '<View style={{ display: isVisible ? "flex" : "none" }} />',
  },
];

/**
 * Validation rules for common components
 */
export const ValidationRules = {
  Text: {
    rules: [
      'children must be string, number, null, or undefined',
      'children cannot be boolean',
      'children cannot be object (unless React element)',
      'use ternary operator for conditional text',
    ],
    example: `
// ❌ WRONG
<Text>{isActive}</Text>
<Text>{someBoolean && "Text"}</Text>

// ✅ CORRECT
<Text>{isActive ? "Active" : "Inactive"}</Text>
<Text>{someBoolean && "Text"}</Text>  // OK if left side is false
    `,
  },

  TextInput: {
    rules: [
      'placeholder must be string',
      'value must be string',
      'defaultValue must be string',
      'all string props must be string type',
    ],
    example: `
// ❌ WRONG
<TextInput placeholder={isRequired} />
<TextInput value={isLoading} />

// ✅ CORRECT
<TextInput placeholder={isRequired ? "Required" : "Optional"} />
<TextInput value={String(isLoading)} />
    `,
  },

  AsyncStorage: {
    rules: [
      'must store strings only',
      'use String() or JSON.stringify() for non-string values',
      'validate parsed data type after retrieval',
    ],
    example: `
// ❌ WRONG
await AsyncStorage.setItem('isActive', isActive);  // boolean

// ✅ CORRECT
await AsyncStorage.setItem('isActive', String(isActive));
await AsyncStorage.setItem('data', JSON.stringify(data));
    `,
  },

  Styles: {
    rules: [
      'display: must be "flex" | "none" (string)',
      'opacity: must be 0-1 (number)',
      'color: must be string (hex or name)',
      'never pass boolean to style properties',
    ],
    example: `
// ❌ WRONG
<View style={{ display: isVisible }} />  // boolean
<View style={{ opacity: isActive }} />    // boolean

// ✅ CORRECT
<View style={{ display: isVisible ? "flex" : "none" }} />
<View style={{ opacity: isActive ? 1 : 0 }} />
    `,
  },
};

/**
 * Quick debugging checklist
 */
export const DebugChecklist = [
  '[ ] Check all <Text> components - no boolean children',
  '[ ] Check all <TextInput> - placeholder and value are strings',
  '[ ] Check all style properties - correct types',
  '[ ] Check AsyncStorage data - properly serialized',
  '[ ] Check conditional rendering - using ternary for strings',
  '[ ] Use SafeText and SafeTextInput components',
  '[ ] Use ErrorBoundary to catch errors',
  '[ ] Enable React Native Debugger',
  '[ ] Check browser console for warnings',
  '[ ] Run TypeScript type checking',
];

