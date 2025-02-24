import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getTopics, getUserTopics, subscribeTopic, unsubscribeTopic } from '../../lib/topics';
import type { Topic } from '../../lib/supabase';

export default function ManageTopicsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [subscribedTopicIds, setSubscribedTopicIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const [topics, userTopics] = await Promise.all([
        getTopics(),
        getUserTopics(session!.user.id),
      ]);
      setAllTopics(topics);
      setSubscribedTopicIds(new Set(userTopics.map(t => t.id)));
    } catch (err) {
      console.error('Failed to load topics:', err);
      setError('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = async (topicId: string) => {
    try {
      if (subscribedTopicIds.has(topicId)) {
        await unsubscribeTopic(session!.user.id, topicId);
        setSubscribedTopicIds(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      } else {
        await subscribeTopic(session!.user.id, topicId);
        setSubscribedTopicIds(prev => new Set([...prev, topicId]));
      }
    } catch (err) {
      console.error('Failed to toggle topic subscription:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadTopics}>
            <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allTopics}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.topicCard,
                { backgroundColor: colors.card },
                subscribedTopicIds.has(item.id) && [
                  styles.topicCardSelected,
                  { borderColor: colors.primary }
                ]
              ]}
              onPress={() => toggleTopic(item.id)}>
              <View style={styles.topicContent}>
                <Text style={styles.topicIcon}>{item.icon}</Text>
                <View style={styles.topicInfo}>
                  <Text style={[styles.topicName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.topicDescription, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={subscribedTopicIds.has(item.id) ? "checkmark-circle" : "add-circle-outline"}
                size={24}
                color={subscribedTopicIds.has(item.id) ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.topicsList}
          refreshing={loading}
          onRefresh={loadTopics}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topicsList: {
    padding: 20,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topicCardSelected: {
    backgroundColor: '#f5f3ff',
  },
  topicContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topicIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});