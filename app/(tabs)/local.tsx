import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import LocationAwareFeeds from '../components/LocationAwareFeeds';

export default function LocalScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom
      }
    ]}>
      <Stack.Screen
        options={{
          title: "Local",
          headerShown: false,
        }}
      />
      <LocationAwareFeeds title="Local News and Updates" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 