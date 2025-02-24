import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/supabase';

type Stats = {
  topics: number;
  feeds: number;
  events: number;
};

export default function ProfileScreen() {
  const { signOut, session } = useAuth();
  const { mode, setMode, colors, isDark } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ topics: 0, feeds: 0, events: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
      loadStats();
    }
  }, [session]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const [
        { count: topicsCount },
        { count: feedsCount },
        { count: eventsCount }
      ] = await Promise.all([
        supabase
          .from('user_topics')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session!.user.id),
        supabase
          .from('user_feeds')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session!.user.id),
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', session!.user.id)
      ]);

      setStats({
        topics: topicsCount || 0,
        feeds: feedsCount || 0,
        events: eventsCount || 0
      });
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setError(null);
            loadProfile();
            loadStats();
          }}>
          <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      contentContainerStyle={styles.contentContainer}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.profileHeader}>
          <Image
            source={{ 
              uri: profile?.avatar_url || 
                'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'
            }}
            style={styles.profileImage}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>
            {profile?.full_name || 'Anonymous User'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {session?.user.email}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/modals/edit-profile')}>
          <Text style={[styles.editButtonText, { color: colors.card }]}>
            Edit Profile
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {stats.topics}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Topics
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {stats.feeds}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Feeds
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {stats.events}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Events
          </Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemContent}>
            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemContent}>
            <Ionicons name="globe-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.menuText, { color: colors.text }]}>Language</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            const nextMode = mode === 'light' ? 'dark' : 
                           mode === 'dark' ? 'system' : 'light';
            setMode(nextMode);
          }}>
          <View style={styles.menuItemContent}>
            <Ionicons 
              name={mode === 'system' ? 'phone-portrait-outline' : 
                    isDark ? 'moon-outline' : 'sunny-outline'} 
              size={24} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.menuText, { color: colors.text }]}>
              {mode === 'system' ? 'System Theme' :
               mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.menuText, { color: colors.text }]}>Privacy</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.logoutButton, { backgroundColor: colors.error }]} 
        onPress={signOut}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 16,
    marginTop: 4,
  },
  editButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    padding: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
  },
  section: {
    marginTop: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});