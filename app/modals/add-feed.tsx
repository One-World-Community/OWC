import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { fetchFeedItems, discoverFeeds, getWebsiteMetadata, type FeedItem } from '../../lib/feeds';
import { supabase } from '../../lib/supabase';

export default function AddFeedScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<FeedItem[]>([]);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<Array<{ url: string; title?: string }>>([]);
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string | null>(null);

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    setDiscoveredFeeds([]);
    setSelectedFeedUrl(null);
    setPreviewItems([]);
    setError(null);

    if (!newUrl.trim()) return;

    // If it's already an RSS feed URL, use it directly
    if (newUrl.includes('/feed') || 
        newUrl.includes('/rss') || 
        newUrl.includes('.xml')) {
      setSelectedFeedUrl(newUrl);
      return;
    }

    // Otherwise, try to discover feeds
    try {
      const feeds = await discoverFeeds(newUrl);
      
      if (feeds.length > 0) {
        setDiscoveredFeeds(feeds);
        setSelectedFeedUrl(feeds[0].url); // Select first feed by default
        
        // If we found exactly one feed, preview it automatically
        if (feeds.length === 1) {
          previewFeed(feeds[0].url);
        }
      } else {
        setError('No RSS feeds found on this website. Please try another URL.');
      }
    } catch (err) {
      console.error('Error discovering feeds:', err);
    }
  };

  const previewFeed = async (feedUrl?: string) => {
    if (!validateUrl(feedUrl || url)) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const items = await fetchFeedItems({ url: feedUrl || url });
      
      if (items.length === 0) {
        throw new Error('No feed items found. Please check the URL and try again.');
      }

      // Extract feed title from the first item if available
      const suggestedName = items[0].title?.split(' - ')[1] || 
                         items[0].title?.split(' | ')[1] ||
                         new URL(feedUrl || url).hostname.replace('www.', '');

      setName(suggestedName || '');
      setPreviewItems(items.slice(0, 5)); // Show first 5 items
      setError(null);

      // Try to get website metadata for better feed information
      const metadata = await getWebsiteMetadata(feedUrl || url);
      if (metadata.title) {
        setName(metadata.title);
      }
      
      setSelectedFeedUrl(feedUrl || url);
    } catch (err) {
      setError('Unable to read feed. Please check the URL and try again.');
      setPreviewItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!session?.user) return;
    
    if (!name.trim()) {
      setError('Please enter a feed name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Insert the new feed
      const { data: feed, error: feedError } = await supabase
        .from('rss_feeds')
        .insert({
          name: name.trim(),
          url: (selectedFeedUrl || url).trim(),
          status: 'active',
        })
        .select()
        .single();

      if (feedError) throw feedError;

      // Subscribe the user to the feed
      const { error: subError } = await supabase
        .from('user_feeds')
        .insert({
          user_id: session.user.id,
          feed_id: feed.id,
        });

      if (subError) throw subError;

      // Return to subscriptions screen
      router.back();
    } catch (err) {
      setError('Failed to add feed. Please try again.');
      console.error('Error adding feed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Feed URL</Text>
          <View style={styles.urlInputContainer}>
            <TextInput
              style={[styles.urlInput, { 
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text
              }]}
              placeholder="https://example.com/feed.xml"
              placeholderTextColor={colors.textSecondary}
              value={url}
              onChangeText={handleUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[
                styles.previewButton,
                { backgroundColor: selectedFeedUrl ? colors.primary : colors.border },
                loading && [styles.previewButtonDisabled, { backgroundColor: colors.border }]
              ]}
              onPress={previewFeed}
              disabled={loading || !url.trim()}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={[styles.previewButtonText, { color: colors.card }]}>
                  Preview
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {discoveredFeeds.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Available Feeds
            </Text>
            <View style={styles.feedOptions}>
              {discoveredFeeds.map((feed, index) => (
                <TouchableOpacity
                  key={feed.url}
                  style={[
                    styles.feedOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedFeedUrl === feed.url && { 
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '10'
                    }
                  ]}
                  onPress={() => {
                    setSelectedFeedUrl(feed.url);
                    previewFeed(feed.url);
                  }}>
                  <Text style={[styles.feedOptionText, { color: colors.text }]}>
                    {feed.title || `Feed ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {previewItems.length > 0 && (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Feed Name</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                placeholder="Enter a name for this feed"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.previewContainer}>
              <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
                Preview Articles
              </Text>
              {previewItems.map((item, index) => (
                <View 
                  key={item.guid || item.link} 
                  style={[
                    styles.previewCard,
                    { 
                      backgroundColor: colors.card,
                      borderColor: colors.border
                    },
                    index < previewItems.length - 1 && styles.previewCardWithMargin
                  ]}>
                  <Text style={[styles.previewItemTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.contentSnippet && (
                    <Text style={[styles.previewItemDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                      {item.contentSnippet}
                    </Text>
                  )}
                  {item.pubDate && (
                    <Text style={[styles.previewItemDate, { color: colors.textSecondary }]}>
                      {new Date(item.pubDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (!url.trim() || !name.trim() || loading) && [
              styles.submitButtonDisabled,
              { backgroundColor: colors.border }
            ]
          ]}
          onPress={handleSubmit}
          disabled={!url.trim() || !name.trim() || loading}>
          <Text style={[styles.submitButtonText, { color: colors.card }]}>
            {loading ? 'Adding Feed...' : 'Add Feed'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 8,
  },
  urlInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewCardWithMargin: {
    marginBottom: 12,
  },
  previewItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  previewItemDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  previewItemDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    color: '#ef4444',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  feedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedOption: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  feedOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});