import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getTopics, getUserTopics, subscribeTopic } from '../../lib/topics';
import { getUserTopicFeeds, getUserFeeds, fetchFeedItems, type FeedItem } from '../../lib/feeds';
import type { Topic } from '../../lib/supabase';

export default function DiscoverScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showMyFeeds, setShowMyFeeds] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load topics when session changes
  useEffect(() => {
    if (session?.user) {
      loadTopics();
    }
  }, [session]);

  // Load initial feeds when component mounts and session is available
  useEffect(() => {
    if (session?.user) {
      setLoading(true);
      loadFeeds();
    }
  }, [session]); // Only depend on session, not on selectedTopic or showMyFeeds

  // Handle feed updates when selection changes
  useEffect(() => {
    if (session?.user) {
      setFeedItems([]); // Clear current items immediately
      setLoading(true); // Show loading state right away
      loadFeeds();
    }
  }, [selectedTopic, showMyFeeds]);

  const loadTopics = async () => {
    try {
      if (session?.user) {
        const userTopics = await getUserTopics(session.user.id);
        setTopics(userTopics);
      }
    } catch (err) {
      console.error('Failed to load topics:', err);
    }
  };

  const loadFeeds = async () => {
    try {
      if (session?.user) {
        let selectedFeeds = [];
        
        if (showMyFeeds) {
          // Load feeds the user is directly subscribed to
          const userFeeds = await getUserFeeds(session.user.id);
          selectedFeeds = userFeeds;
        } else {
          // Load feeds from selected topic or all topic feeds
          const topicFeeds = await getUserTopicFeeds(session.user.id);
          selectedFeeds = topicFeeds
            .filter(tf => !selectedTopic || selectedTopic === tf.topic.id)
            .flatMap(tf => tf.feeds);
        }

        const allItems: FeedItem[] = [];
        const feedErrors: string[] = [];

        // Load feeds in parallel and handle errors individually
        const feedPromises = selectedFeeds.map(async (feed) => {
          try {
            const items = await fetchFeedItems(feed);
            allItems.push(...items);
          } catch (err) {
            console.error('Error fetching feed', feed.url, ':', err);
            feedErrors.push(feed.name);
          }
        });

        await Promise.all(feedPromises);

        // Sort by date, newest first
        allItems.sort((a, b) => {
          const dateA = a.isoDate ? new Date(a.isoDate) : new Date(0);
          const dateB = b.isoDate ? new Date(b.isoDate) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        setFeedItems(allItems);
        
        // Only show error if all feeds failed
        if (feedErrors.length === selectedFeeds.length && selectedFeeds.length > 0) {
          setError('Unable to load feeds. Please try again.');
        } else if (feedErrors.length > 0) {
          console.warn('Some feeds failed to load:', feedErrors.join(', '));
          setError(null);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      setError('Failed to load feeds');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleArticlePress = async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (error) {
      console.error('Failed to open article:', error);
    }
  };

  if (topics.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.availableTopicsContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.availableTopicsSubtitle, { color: colors.textSecondary }]}>
            Select a topic that interests you to see relevant content
          </Text>
          
          <FlatList
            data={topics}
            numColumns={2}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.availableTopicCard,
                  { backgroundColor: colors.card },
                  selectedTopic === item.id && styles.availableTopicCardSelected
                ]}
                onPress={() => setSelectedTopic(item.id)}>
                <Text style={styles.availableTopicIcon}>{item.icon}</Text>
                <Text style={[
                  styles.availableTopicName,
                  { color: colors.text },
                  selectedTopic === item.id && styles.availableTopicNameSelected
                ]}>{item.name}</Text>
                <Text style={[
                  styles.availableTopicDescription,
                  { color: colors.textSecondary },
                  selectedTopic === item.id && styles.availableTopicDescriptionSelected
                ]} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.availableTopicsList}
            refreshing={loading}
            onRefresh={loadTopics}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topicsContainer, { 
        backgroundColor: colors.card
      }]}>
        <FlatList 
          data={[
            { id: 'add' },
            { id: 'my-feeds', name: 'My Feeds', icon: '📰' },
            ...topics
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.id === 'add') {
              return (
                <TouchableOpacity
                  style={[styles.addTopicButton, { backgroundColor: colors.background }]}
                  onPress={() => router.push('/modals/add-topic')}>
                  <Ionicons name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
              );
            }
            if (item.id === 'my-feeds') {
              return (
                <TouchableOpacity
                  style={[
                    styles.topicButton,
                    { backgroundColor: colors.background },
                    showMyFeeds && [styles.topicButtonSelected, { backgroundColor: colors.primary }]
                  ]}
                  onPress={() => {
                    setShowMyFeeds(!showMyFeeds);
                    setSelectedTopic(null);
                    setFeedItems([]);
                  }}>
                  <Text style={styles.topicIcon}>{item.icon}</Text>
                  <Text style={[
                    styles.topicText,
                    { color: colors.text }
                  ]}>{item.name}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={[
                  styles.topicButton,
                  { backgroundColor: colors.background },
                  selectedTopic === item.id && [styles.topicButtonSelected, { backgroundColor: colors.primary }]
                ]}
                onPress={() => {
                  setSelectedTopic(selectedTopic === item.id ? null : item.id);
                  setShowMyFeeds(false);
                  setFeedItems([]);
                }}>
                <Text style={styles.topicIcon}>{item.icon}</Text>
                <Text style={[
                  styles.topicText,
                  { color: colors.text }
                ]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.topicsList, { paddingVertical: 8 }]}
        />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadFeeds}>
            <View style={styles.retryButtonContent}>
              <Ionicons name="refresh" size={20} color={colors.card} style={styles.retryIcon} />
              <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          contentContainerStyle={[styles.articlesList, { paddingVertical: 20 }]}
          refreshing={loading}
          onRefresh={loadFeeds}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading articles...
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.articleCard, { backgroundColor: colors.card }]}
              onPress={() => handleArticlePress(item.link)}>
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.articleImage} />
              )}
              <View style={styles.articleContent}>
                <Text style={[styles.articleTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                {item.contentSnippet ? (
                  <Text style={[styles.articleSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.contentSnippet}
                  </Text>
                ) : null}
                <View style={styles.articleMeta}>
                  <Text style={[styles.articleDate, { color: colors.textSecondary }]}>
                    {item.pubDate ? new Date(item.pubDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Date not available'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => {
            // Create a unique hash from the item's properties
            const parts = [
              item.guid || item.link,
              item.isoDate || item.pubDate || '',
              item.title || '',
              Math.random().toString(36).slice(2, 7) // Add a random component
            ];
            return parts.join('_').replace(/[^a-zA-Z0-9-_]/g, '_');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  topicsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topicsList: {
    paddingHorizontal: 20,
  },
  addTopicButton: {
    backgroundColor: '#f1f5f9',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicButtonSelected: {
    backgroundColor: '#818cf8',
  },
  topicIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  topicText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  topicTextSelected: {
    color: '#ffffff',
  },
  articlesList: {
    padding: 20,
    paddingBottom: 40,
  },
  articleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  articleImage: {
    width: '100%',
    height: 200,
  },
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  articleSnippet: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  articleDate: {
    fontSize: 14,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
  loadingContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16
  },
  availableTopicsContainer: {
    flex: 1,
    padding: 20,
  },
  availableTopicsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  availableTopicsSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  availableTopicsList: {
    paddingBottom: 80,
  },
  availableTopicCard: {
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
  availableTopicCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  availableTopicIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  availableTopicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  availableTopicNameSelected: {
    color: '#4f46e5',
  },
  availableTopicDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  availableTopicDescriptionSelected: {
    color: '#4338ca',
  },
});