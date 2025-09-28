import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getTopics, getUserTopics, subscribeTopic, unsubscribeTopic } from '../../lib/topics';
import type { Topic } from '../../lib/supabase';

export default function ManageTopicsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [initialTopicIds, setInitialTopicIds] = useState<Set<string>>(new Set());
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const initialIds = new Set(userTopics.map(t => t.id));
      setInitialTopicIds(initialIds);
      setSelectedTopicIds(new Set(initialIds));
    } catch (err) {
      console.error('Failed to load topics:', err);
      setError('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const handleCancel = () => {
    router.back();
  };

  const hasChanges = useMemo(() => {
    if (initialTopicIds.size !== selectedTopicIds.size) return true;
    for (const id of initialTopicIds) {
      if (!selectedTopicIds.has(id)) return true;
    }
    return false;
  }, [initialTopicIds, selectedTopicIds]);

  const handleDone = async () => {
    if (!session?.user) return;
    if (!hasChanges) {
      router.back();
      return;
    }

    try {
      setSaving(true);
      const toSubscribe: string[] = [];
      const toUnsubscribe: string[] = [];

      selectedTopicIds.forEach(id => {
        if (!initialTopicIds.has(id)) {
          toSubscribe.push(id);
        }
      });

      initialTopicIds.forEach(id => {
        if (!selectedTopicIds.has(id)) {
          toUnsubscribe.push(id);
        }
      });

      await Promise.all([
        Promise.all(toSubscribe.map(id => subscribeTopic(session.user.id, id))),
        Promise.all(toUnsubscribe.map(id => unsubscribeTopic(session.user.id, id))),
      ]);

      setInitialTopicIds(new Set(selectedTopicIds));
      router.back();
    } catch (err) {
      console.error('Failed to save topic changes:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.primary}
              />
              <Text
                style={[styles.headerButtonText, { color: colors.primary }]}
              >
                Back
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleDone}
              style={styles.headerButton}
              disabled={saving || !hasChanges}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  {
                    color:
                      saving || !hasChanges
                        ? colors.textSecondary
                        : colors.primary,
                  },
                ]}
              >
                Done
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
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
                selectedTopicIds.has(item.id) && [
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
                name={selectedTopicIds.has(item.id) ? "checkmark-circle" : "add-circle-outline"}
                size={24}
                color={selectedTopicIds.has(item.id) ? colors.primary : colors.textSecondary}
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
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
});