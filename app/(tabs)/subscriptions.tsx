import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, Animated, ScrollView, SafeAreaView } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getUserTopics, unsubscribeTopic } from '../../lib/topics';
import { getUserFeeds, unsubscribeFeed } from '../../lib/feeds';
import type { Topic, RssFeed } from '../../lib/supabase';

export default function SubscriptionsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (session?.user) {
      loadSubscriptions();
    }
  }, [session]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const [userTopics, userFeeds] = await Promise.all([
        getUserTopics(session!.user.id),
        getUserFeeds(session!.user.id),
      ]);
      setTopics(userTopics);
      setFeeds(userFeeds);
    } catch (err) {
      setError('Failed to load subscriptions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribeTopic = async (topicId: string) => {
    try {
      await unsubscribeTopic(session!.user.id, topicId);
      setTopics(prev => prev.filter(t => t.id !== topicId));
    } catch (err) {
      console.error('Failed to unsubscribe from topic:', err);
    }
  };

  const handleUnsubscribeFeed = async (feedId: string) => {
    try {
      await unsubscribeFeed(session!.user.id, feedId);
      setFeeds(prev => prev.filter(f => f.id !== feedId));
    } catch (err) {
      console.error('Failed to unsubscribe from feed:', err);
    }
  };

  const handleFeedPress = (feed: RssFeed) => {
    router.push(`/feeds/${feed.id}`);
  };

  const handleImageError = (feedId: string) => {
    setFailedImages(prev => ({
      ...prev,
      [feedId]: true
    }));
  };

  const renderFeedIcon = (feed: RssFeed) => {
    if (failedImages[feed.id]) {
      return (
        <View style={[styles.feedIcon, styles.placeholderIcon]}>
          <Ionicons name="newspaper" size={20} color={colors.textSecondary} />
        </View>
      );
    }
    
    return (
      <Image 
        source={{ uri: feed.icon_url }} 
        style={styles.feedIcon}
        onError={() => handleImageError(feed.id)}
      />
    );
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]} 
          onPress={loadSubscriptions}>
          <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Topics</Text>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => router.push('/modals/manage-topics')}>
                <Ionicons name="settings-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={topics}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.topicCard, { backgroundColor: colors.card }]}>
                  <Text style={styles.topicIcon}>{item.icon}</Text>
                  <Text style={[styles.topicName, { color: colors.text }]}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.topicsList}
            />
          </View>

          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>RSS Feeds</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => router.push('/modals/add-feed')}>
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {feeds.map(item => (
              Platform.OS === 'web' ? (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.feedItem, { backgroundColor: colors.card }]}
                  onPress={() => handleFeedPress(item)}>
                  {renderFeedIcon(item)}
                  <View style={styles.feedInfo}>
                    <Text style={[styles.feedName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.feedUrl, { color: colors.textSecondary }]}>{item.url}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unsubscribeButton}
                    onPress={() => handleUnsubscribeFeed(item.id)}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ) : (
                <Swipeable
                  key={item.id}
                  renderRightActions={(progress, dragX) => {
                    const scale = dragX.interpolate({
                      inputRange: [-100, 0],
                      outputRange: [1, 0],
                      extrapolate: 'clamp',
                    });
                    return (
                      <TouchableOpacity
                        style={styles.deleteAction}
                        onPress={() => handleUnsubscribeFeed(item.id)}>
                        <Animated.View
                          style={[
                            styles.deleteActionContent,
                            { transform: [{ scale }] }
                          ]}>
                          <Ionicons name="trash-outline" size={24} color="#fff" />
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  }}>
                  <TouchableOpacity 
                    style={[styles.feedItem, { backgroundColor: colors.card }]}
                    onPress={() => handleFeedPress(item)}>
                    {renderFeedIcon(item)}
                    <View style={styles.feedInfo}>
                      <Text style={[styles.feedName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.feedUrl, { color: colors.textSecondary }]}>{item.url}</Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              )
            ))}
            
            {loading && (
              <View style={styles.loadingContainer}>
                <Text style={{ color: colors.textSecondary }}>Loading feeds...</Text>
              </View>
            )}
            
            {!loading && feeds.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={{ color: colors.textSecondary }}>No feeds subscribed</Text>
                <TouchableOpacity 
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/modals/add-feed')}>
                  <Text style={{ color: colors.card }}>Add a feed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingTop: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  topicsList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  topicCard: {
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 120,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topicIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  feedIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  placeholderIcon: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  feedName: {
    fontSize: 16,
    fontWeight: '500',
  },
  feedUrl: {
    fontSize: 14,
    marginTop: 2
  },
  unsubscribeButton: {
    padding: 8,
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 100,
  },
  deleteActionContent: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});