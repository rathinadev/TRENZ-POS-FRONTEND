import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Animated, ActivityIndicator} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import StoreIcon from '../assets/icons/store.svg';
import AnimatedButton from '../components/AnimatedButton';
import type {RootStackParamList} from '../types/business.types';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({navigation}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isReturningUser, setIsReturningUser] = useState(false);

  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trackWelcomeView();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      startAnimations();
    }
  }, [isLoading]);

  const trackWelcomeView = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();

      // Track welcome screen analytics
      const viewCount = (settings?.welcome_screen_view_count || 0) + 1;
      const timestamp = new Date().toISOString();
      const isFirstView = viewCount === 1;

      // Check if returning user
      setIsReturningUser(viewCount > 1);

      // Save analytics
      const saveData: {
        welcome_screen_view_count: number;
        last_welcome_view_date: string;
        first_welcome_view_date?: string;
      } = {
        welcome_screen_view_count: viewCount,
        last_welcome_view_date: timestamp,
      };

      // Save first view date only on first visit
      if (isFirstView) {
        saveData.first_welcome_view_date = timestamp;
      }

      await saveBusinessSettings(saveData);
    } catch (error) {
      console.error('Failed to track welcome view:', error);
      // Continue anyway
    } finally {
      setIsLoading(false);
    }
  };

  const startAnimations = () => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(titleTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(450),
      Animated.parallel([
        Animated.spring(subtitleTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.spring(buttonsTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleCreateBusiness = async () => {
    try {
      // Track which option was selected
      await saveBusinessSettings({
        onboarding_path: 'create_new',
        onboarding_started_date: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to track onboarding path:', error);
      // Continue anyway
    }
    navigation.navigate('BusinessSetup1');
  };

  const handleJoinBusiness = async () => {
    try {
      // Track which option was selected
      await saveBusinessSettings({
        onboarding_path: 'join_existing',
        onboarding_started_date: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to track onboarding path:', error);
      // Continue anyway
    }
    navigation.navigate('JoinBusiness');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: iconOpacity,
              transform: [{scale: iconScale}],
            },
          ]}>
          <StoreIcon width={80} height={80} />
        </Animated.View>

        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{translateY: titleTranslateY}],
            },
          ]}>
          <Text style={styles.title}>
            {isReturningUser ? 'Welcome Back' : 'Welcome'}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.subtitleContainer,
            {
              opacity: subtitleOpacity,
              transform: [{translateY: subtitleTranslateY}],
            },
          ]}>
          <Text style={styles.subtitle}>
            {isReturningUser 
              ? 'Continue setting up your POS system' 
              : 'Get started with your POS system'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.buttonsContainer,
          {
            opacity: buttonsOpacity,
            transform: [{translateY: buttonsTranslateY}],
          },
        ]}>
        <AnimatedButton
          title="Create New Business"
          onPress={handleCreateBusiness}
          variant="primary"
        />
        <AnimatedButton
          title="Join Existing Business"
          onPress={handleJoinBusiness}
          variant="secondary"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    paddingTop: 265,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  contentContainer: {
    width: '100%',
    height: 162,
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  titleContainer: {
    width: '100%',
    height: 42,
    marginBottom: 0,
  },
  title: {
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 42,
    textAlign: 'center',
    letterSpacing: 0.38,
    color: '#333333',
  },
  subtitleContainer: {
    width: '100%',
    height: 24,
  },
  subtitle: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: -0.31,
    color: '#666666',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
});

export default WelcomeScreen;