import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { extractFeedFromArticle, fetchFeedItems, type FeedItem } from '../lib/feeds';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function ShareScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedInfo, setFeedInfo] = useState<{
    feedUrl: string | null;
    feedTitle?: string;
    siteTitle?: string;
    siteIcon?: string;
  } | null>(null);
  const [previewItems, setPreviewItems] = useState<FeedItem[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    const processSharedUrl = async () => {
      try {
        // Extract feed from shared article URL
        const articleFeedInfo = await extractFeedFromArticle(url);
        setFeedInfo(articleFeedInfo);

        if (!articleFeedInfo.feedUrl) {
          setError('No feed found for this article');
          setLoading(false);
          return;
        }

        // Check if user is already subscribed to this feed
        if (session?.user) {
          const { data: existingFeed } = await supabase
            .from('rss_feeds')
            .select('id')
            .eq('url', articleFeedInfo.feedUrl)
            .single();

          if (existingFeed) {
            const { data: subscription } = await supabase
              .from('user_feeds')
              .select('id')
              .eq('feed_id', existingFeed.id)
              .eq('user_id', session.user.id)
              .single();

            if (subscription) {
              setSubscribed(true);
            }
          }
        }

        // Get preview items
        try {
          const items = await fetchFeedItems({ url: articleFeedInfo.feedUrl });
          setPreviewItems(items.slice(0, 3)); // Show first 3 items
        } catch (feedError) {
          console.log('Could not fetch feed items:', feedError);
          // We'll still allow subscribing even if preview fails
        }

        setLoading(false);
      } catch (err) {
        console.error('Error processing shared URL:', err);
        setError('Failed to process the shared article');
        setLoading(false);
      }
    };

    processSharedUrl();
  }, [url, session?.user]);

  const handleSubscribe = async () => {
    if (!session?.user || !feedInfo?.feedUrl) return;

    setSubscribing(true);
    setError(null);

    try {
      // First check if the feed already exists
      const { data: existingFeed, error: searchError } = await supabase
        .from('rss_feeds')
        .select('id')
        .eq('url', feedInfo.feedUrl)
        .single();

      let feedId: string;

      if (searchError || !existingFeed) {
        // Feed doesn't exist yet, create it
        const { data: newFeed, error: insertError } = await supabase
          .from('rss_feeds')
          .insert({
            name: feedInfo.feedTitle || feedInfo.siteTitle || 'New Feed',
            url: feedInfo.feedUrl,
            status: 'active',
          })
          .select()
          .single();

        if (insertError || !newFeed) {
          throw new Error('Failed to add feed');
        }

        feedId = newFeed.id;
      } else {
        feedId = existingFeed.id;
      }

      // Now subscribe the user
      const { error: subError } = await supabase
        .from('user_feeds')
        .insert({
          user_id: session.user.id,
          feed_id: feedId,
        });

      if (subError) throw subError;

      setSubscribed(true);
    } catch (err) {
      console.error('Error subscribing to feed:', err);
      setError('Failed to subscribe to feed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Analyzing article...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: colors.card }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {feedInfo?.feedUrl ? (
            <>
              <View style={[styles.feedInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.foundFeedText, { color: colors.textSecondary }]}>
                  Found Feed:
                </Text>
                <Text style={[styles.feedTitle, { color: colors.text }]}>
                  {feedInfo.feedTitle || feedInfo.siteTitle || 'Discovered Feed'}
                </Text>
                
                {previewItems.length > 0 && (
                  <View style={styles.previewContainer}>
                    <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
                      Latest Articles:
                    </Text>
                    {previewItems.map((item) => (
                      <Text 
                        key={item.guid || item.link} 
                        style={[styles.previewItem, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        • {item.title}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {subscribed ? (
                <View style={styles.subscribedContainer}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={[styles.subscribedText, { color: colors.success }]}>
                    You're subscribed to this feed
                  </Text>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/')}>
                    <Text style={[styles.buttonText, { color: colors.card }]}>Go to Feeds</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: colors.primary },
                    subscribing && [styles.buttonDisabled, { backgroundColor: colors.border }]
                  ]}
                  onPress={handleSubscribe}
                  disabled={subscribing}>
                  <Text style={[styles.buttonText, { color: colors.card }]}>
                    {subscribing ? 'Subscribing...' : 'Subscribe to Feed'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.notFoundContainer}>
              <Ionicons name="warning-outline" size={48} color={colors.warning} />
              <Text style={[styles.notFoundText, { color: colors.text }]}>
                No feed found for this article
              </Text>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={() => router.push({
                  pathname: '/modals/add-feed',
                  params: { url: url }
                })}>
                <Text style={[styles.buttonText, { color: colors.card }]}>
                  Try Manual Feed Discovery
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  feedInfoCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  foundFeedText: {
    fontSize: 14,
    marginBottom: 8,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewContainer: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  previewItem: {
    fontSize: 14,
    marginBottom: 6,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscribedContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  subscribedText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  notFoundContainer: {
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  notFoundText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
}); 