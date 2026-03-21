import { useEffect, useCallback } from 'react';

/**
 * Hook to validate component props and log warnings for type mismatches
 * Helps catch "Boolean cannot be cast to String" errors early
 */
export const usePropValidation = (
  props: Record<string, any>,
  expectedTypes: Record<string, string | string[]>,
  componentName: string = 'Component'
) => {
  useEffect(() => {
    Object.entries(expectedTypes).forEach(([key, expectedType]) => {
      const value = props[key];
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      const expectedTypes_ = Array.isArray(expectedType)
        ? expectedType
        : [expectedType];

      if (value !== undefined && !expectedTypes_.includes(actualType)) {
        console.warn(
          `⚠️ [${componentName}] Prop "${key}" type mismatch:\n` +
            `   Expected: ${expectedTypes_.join(' | ')}\n` +
            `   Received: ${actualType}\n` +
            `   Value: ${JSON.stringify(value).substring(0, 100)}`
        );
      }
    });
  }, [props, expectedTypes, componentName]);
};

/**
 * Safely convert a value to string, with logging
 */
export const toSafeString = (
  value: any,
  fieldName: string = 'value',
  logWarning: boolean = true
): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    if (logWarning) {
      console.warn(
        `⚠️ Expected string for "${fieldName}", got boolean: ${value}`
      );
    }
    return '';
  }

  if (typeof value === 'object') {
    if (logWarning) {
      console.warn(
        `⚠️ Expected string for "${fieldName}", got object`,
        value
      );
    }
    return '';
  }

  if (logWarning) {
    console.warn(
      `⚠️ Expected string for "${fieldName}", got ${typeof value}:`,
      value
    );
  }

  return String(value);
};

/**
 * Validate that a value is a valid string for React Native components
 */
export const isValidStringProp = (value: any): value is string | number => {
  return typeof value === 'string' || typeof value === 'number';
};

/**
 * Create a validation middleware for props
 */
export const createPropValidator = (expectedTypes: Record<string, string>) => {
  return (props: Record<string, any>) => {
    const errors: string[] = [];

    Object.entries(expectedTypes).forEach(([key, expectedType]) => {
      const value = props[key];
      const actualType = typeof value;

      if (value !== undefined && actualType !== expectedType) {
        errors.push(
          `"${key}" expected ${expectedType}, got ${actualType}: ${JSON.stringify(value).substring(0, 50)}`
        );
      }
    });

    if (errors.length > 0) {
      console.error('❌ Prop validation failed:', errors.join('\n'));
      return false;
    }

    return true;
  };
};

