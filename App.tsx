import 'react-native-get-random-values';
import React, {useEffect, useState} from 'react';
import {StatusBar, View, ActivityIndicator, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {initDatabase} from './src/database/schema';
import {initNetworkListener} from './src/services/sync';

function App(): React.JSX.Element {
  const [isDbInitialized, setIsDbInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing database...');
        await initDatabase();
        console.log('Database initialized successfully');
        
        // Initialize network listener for auto-sync
        console.log('📶 Initializing network listener for auto-sync...');
        initNetworkListener();
        console.log('✅ Network listener initialized - will auto-sync when online');
        
        setIsDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Still set to true to allow app to run, but log the error
        setIsDbInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while database initializes
  if (!isDbInitialized) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C62828" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default App;