import { Stack } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();

  return (
    <Stack 
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.text,
        },
        headerShadowVisible: false,
        presentation: 'modal',
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}>
      <Stack.Screen 
        name="add-feed" 
        options={{ 
          title: 'Add Feed',
        }} 
      />
      <Stack.Screen 
        name="add-topic" 
        options={{ 
          title: 'Add Topic',
        }} 
      />
      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          title: 'Edit Profile',
        }}
      />
      <Stack.Screen 
        name="create-event" 
        options={{ 
          title: 'Create Event',
        }}
      />
      <Stack.Screen 
        name="manage-topics" 
        options={{ 
          title: 'Manage Topics',
        }
        }
      />
    </Stack>
  );
}