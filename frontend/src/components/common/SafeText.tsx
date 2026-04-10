import React from 'react';
import { Text, TextProps } from 'react-native';

/**
 * SafeText - Prevents "Boolean cannot be cast to String" errors
 * Safely converts any value to a valid string before rendering
 */
export const SafeText = React.forwardRef<Text, TextProps & { children?: any }>(
  ({ children, ...props }, ref) => {
    // Convert children to safe string value
    const getSafeChildren = () => {
      if (children === null || children === undefined) {
        return '';
      }

      if (typeof children === 'string' || typeof children === 'number') {
        return children;
      }

      if (typeof children === 'boolean') {
        console.warn(
          '⚠️ SafeText received boolean child:',
          children,
          'Stack trace:',
          new Error().stack
        );
        return '';
      }

      if (Array.isArray(children)) {
        return children
          .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') {
              return child;
            }
            return '';
          })
          .filter((c) => c !== '')
          .join('');
      }

      if (typeof children === 'object') {
        console.warn('⚠️ SafeText received object child:', children);
        return '';
      }

      return String(children);
    };

    const safeContent = getSafeChildren();

    return (
      <Text {...props} ref={ref}>
        {safeContent}
      </Text>
    );
  }
);

SafeText.displayName = 'SafeText';

