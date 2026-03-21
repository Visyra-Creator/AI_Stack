import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary Component - Catches rendering errors including type mismatches
 * Helps identify "Boolean cannot be cast to String" errors and other rendering issues
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('❌ ERROR BOUNDARY CAUGHT:', error.toString());
    console.error('📍 COMPONENT STACK:', errorInfo.componentStack);

    // Parse error message to identify type mismatches
    if (error.message.includes('Boolean') || error.message.includes('cannot be cast')) {
      console.error(
        '🔴 TYPE MISMATCH DETECTED: Likely Boolean-to-String cast error'
      );
      this.logTypeErrorAnalysis(error);
    }

    this.setState({
      hasError: true,
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logTypeErrorAnalysis(error: Error) {
    console.error('\n📊 ERROR ANALYSIS:');
    console.error('━'.repeat(60));
    console.error('Type: Boolean cannot be cast to String');
    console.error('Location: Usually in Text or TextInput components');
    console.error('\nCommon causes:');
    console.error('1. <Text>{booleanValue}</Text>');
    console.error('2. <TextInput placeholder={booleanValue} />');
    console.error('3. Passing boolean to style properties');
    console.error('4. AsyncStorage storing boolean as-is');
    console.error('━'.repeat(60));
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback
      ) : (
        <View style={styles.container}>
          <ScrollView style={styles.errorContainer}>
            <Text style={styles.title}>❌ Rendering Error</Text>

            {this.state.error && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Error Message:</Text>
                <Text style={styles.errorMessage}>
                  {this.state.error.toString()}
                </Text>
              </View>
            )}

            {this.state.errorInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Component Stack:</Text>
                <Text style={styles.stackTrace}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Debugging Tips:</Text>
              <Text style={styles.tip}>
                • Check Text components - they should not render boolean values
              </Text>
              <Text style={styles.tip}>
                • Check TextInput placeholder and value props - must be strings
              </Text>
              <Text style={styles.tip}>
                • Check style properties - use correct types (string or number)
              </Text>
              <Text style={styles.tip}>
                • Enable React Native Debugger for more details
              </Text>
            </View>

            <Text style={styles.footer}>
              Use SafeText and SafeTextInput components to prevent this error
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  errorContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#C53030',
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7D7',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: '#744210',
    backgroundColor: '#FED7D7',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'Courier New',
  },
  stackTrace: {
    fontSize: 11,
    color: '#744210',
    backgroundColor: '#FED7D7',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'Courier New',
  },
  tip: {
    fontSize: 12,
    color: '#744210',
    marginBottom: 6,
    lineHeight: 18,
  },
  footer: {
    fontSize: 11,
    color: '#C53030',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FED7D7',
    borderRadius: 6,
  },
});

