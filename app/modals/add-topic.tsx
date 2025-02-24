import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getTopics, subscribeTopic } from '../../lib/topics';
import type { Topic } from '../../lib/supabase';

export default function AddTopicScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const availableTopics = await getTopics();
      setTopics(availableTopics);
    } catch (err) {
      console.error('Failed to load available topics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedTopic && session?.user) {
      try {
        await subscribeTopic(session.user.id, selectedTopic);
        router.back();
      } catch (err) {
        console.error('Failed to subscribe to topic:', err);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Select a topic you'd like to follow
      </Text>
      
      <FlatList
        data={topics}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.topicCard,
              { backgroundColor: colors.card },
              selectedTopic === item.id && [
                styles.topicCardSelected,
                { borderColor: colors.primary }
              ]
            ]}
            onPress={() => setSelectedTopic(item.id)}>
            <Text style={styles.topicIcon}>{item.icon}</Text>
            <Text style={[
              styles.topicName,
              { color: colors.text },
              selectedTopic === item.id && { color: colors.primary }
            ]}>{item.name}</Text>
            <Text style={[
              styles.topicDescription,
              { color: colors.textSecondary },
              selectedTopic === item.id && { color: colors.primary }
            ]} numberOfLines={2}>
              {item.description}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.topicsList}
        refreshing={loading}
        onRefresh={loadTopics}
      />

      <TouchableOpacity 
        style={[
          styles.saveButton,
          { backgroundColor: colors.primary },
          !selectedTopic && [
            styles.saveButtonDisabled,
            { backgroundColor: colors.border }
          ]
        ]}
        disabled={!selectedTopic}
        onPress={handleSave}>
        <Text style={[
          styles.saveButtonText,
          { color: colors.card },
          !selectedTopic && { color: colors.textSecondary }
        ]}>
          {!selectedTopic 
            ? 'Select a topic to continue' 
            : 'Add selected topic'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    padding: 20,
  },
  topicsList: {
    padding: 12,
    paddingBottom: 80,
  },
  topicCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topicCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  topicIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  topicNameSelected: {
    color: '#4f46e5',
  },
  topicDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  topicDescriptionSelected: {
    color: '#4338ca',
  },
  saveButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#94a3b8',
  },
});