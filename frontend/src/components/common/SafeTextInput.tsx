import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

/**
 * SafeTextInput - Prevents "Boolean cannot be cast to String" errors
 * Ensures placeholder, value, and other string props are always strings
 */
export const SafeTextInput = React.forwardRef<TextInput, TextInputProps>(
  (
    {
      placeholder,
      value,
      defaultValue,
      placeholderTextColor,
      ...props
    },
    ref
  ) => {
    // Convert placeholder to safe string
    const getSafeValue = (val: any, fieldName: string): string => {
      if (val === null || val === undefined) {
        return '';
      }

      if (typeof val === 'string' || typeof val === 'number') {
        return String(val);
      }

      if (typeof val === 'boolean') {
        console.warn(
          `⚠️ SafeTextInput "${fieldName}" received boolean value:`,
          val,
          'Converting to empty string'
        );
        return '';
      }

      console.warn(
        `⚠️ SafeTextInput "${fieldName}" received invalid type:`,
        typeof val,
        'Converting to string'
      );
      return String(val);
    };

    return (
      <TextInput
        ref={ref}
        {...props}
        placeholder={getSafeValue(placeholder, 'placeholder')}
        value={getSafeValue(value, 'value')}
        defaultValue={getSafeValue(defaultValue, 'defaultValue')}
        placeholderTextColor={placeholderTextColor}
      />
    );
  }
);

SafeTextInput.displayName = 'SafeTextInput';

