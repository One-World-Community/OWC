import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, GestureResponderEvent } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import React from 'react';
import { fetchFeedItems, discoverFeeds, getWebsiteMetadata, type FeedItem, getFeedMetadata } from '../../lib/feeds';
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

  const previewFeed = async (feedUrl?: string | GestureResponderEvent) => {
    // Handle both direct string calls and touchable onPress events
    let urlToFetch: string;
    
    if (typeof feedUrl === 'string') {
      urlToFetch = feedUrl;
    } else {
      urlToFetch = url;
    }
    
    if (!urlToFetch.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Try to get channel-level metadata from the feed first
      try {
        const feedMetadata = await getFeedMetadata({ url: urlToFetch });
        
        // If we successfully get feed metadata and it has a title, use it
        if (feedMetadata && feedMetadata.title) {
          setName(feedMetadata.title);
        }
      } catch (metadataErr) {
        // If we can't get feed metadata, we'll fall back to other methods
        console.log('Could not get feed channel metadata:', metadataErr);
      }
      
      const items = await fetchFeedItems({ url: urlToFetch });
      
      // Handle empty feeds gracefully
      if (items.length === 0) {
        setPreviewItems([]);
        
        // If name wasn't set from feed metadata, try website metadata
        if (!name) {
          try {
            const metadata = await getWebsiteMetadata(urlToFetch);
            if (metadata.title) {
              setName(metadata.title);
            } else {
              // If no metadata title, try to extract from URL
              try {
                const feedUrl = new URL(urlToFetch);
                setName(feedUrl.hostname.replace('www.', ''));
              } catch {
                // If URL parsing fails, use a generic name
                setName(urlToFetch.split('/')[0] || 'My Feed');
              }
            }
          } catch (metadataErr) {
            // If metadata fetch fails, use URL for name
            try {
              const feedUrl = new URL(urlToFetch);
              setName(feedUrl.hostname.replace('www.', ''));
            } catch {
              setName(urlToFetch.split('/')[0] || 'My Feed');
            }
          }
        }
      } else {
        // For feeds with items, continue with existing logic
        // Only set name from item if we don't already have one from feed metadata
        if (!name) {
          // Extract feed title from the first item if available
          const suggestedName = items[0].title?.split(' - ')[1] || 
                           items[0].title?.split(' | ')[1] ||
                           new URL(urlToFetch).hostname.replace('www.', '');

          setName(suggestedName || '');
          
          // Try to get website metadata for better feed information
          try {
            const metadata = await getWebsiteMetadata(urlToFetch);
            if (metadata.title) {
              setName(metadata.title);
            }
          } catch (metadataErr) {
            // Ignore metadata errors for feeds with items
          }
        }
        
        setPreviewItems(items.slice(0, 5)); // Show first 5 items
      }
      
      setError(null);
      setSelectedFeedUrl(urlToFetch);
    } catch (err: any) {
      console.error('Feed fetch error:', err);
      
      // Check if this is the "No items found" error which should be treated as a valid empty feed
      if (err.message && (
          err.message.includes('No items found') || 
          err.message.includes('empty feed') || 
          err.message.includes('no items'))) {
        console.log('Detected valid empty feed');
        
        // This is a valid feed, just empty
        setPreviewItems([]);
        
        // If name wasn't set from above, try to extract from feed URL
        if (!name) {
          try {
            const feedUrl = new URL(urlToFetch);
            
            // Try to get channel title again via metadata
            try {
              const feedMetadata = await getFeedMetadata({ url: urlToFetch });
              if (feedMetadata && feedMetadata.title) {
                setName(feedMetadata.title);
              }
            } catch (metadataErr) {
              // Continue to URL-based naming if feed metadata fails
            }
            
            // If still no name, extract from URL
            if (!name) {
              // Try to get name parts from the URL path
              const pathParts = feedUrl.pathname.split('/').filter(Boolean);
              let suggestedName = '';
              
              if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                // Clean up the last part (remove .xml, etc)
                suggestedName = lastPart.replace(/\.(xml|rss|atom)$/i, '');
              }
              
              if (!suggestedName) {
                suggestedName = feedUrl.hostname.replace('www.', '');
              }
              
              setName(suggestedName);
            }
          } catch (urlErr) {
            // If URL parsing fails, use a generic name
            setName(urlToFetch.split('/')[0] || 'My Feed');
          }
        }
        
        setSelectedFeedUrl(urlToFetch);
        setError(null); // Clear any error
        return;
      }
      
      // Try to handle even feeds that might throw errors but are actually valid
      try {
        // This is a fallback - try to extract a name from the URL
        setPreviewItems([]);
        try {
          const feedUrl = new URL(urlToFetch);
          // Check if it contains feed-like segments
          const isLikelyFeed = urlToFetch.includes('rss') || 
                               urlToFetch.includes('feed') || 
                               urlToFetch.includes('atom') ||
                               urlToFetch.includes('xml');
          
          if (isLikelyFeed) {
            // Looks like a valid feed URL but might be empty or have parsing issues
            let suggestedName = '';
            
            // Try to get feed metadata one more time
            try {
              const feedMetadata = await getFeedMetadata({ url: urlToFetch });
              if (feedMetadata && feedMetadata.title) {
                suggestedName = feedMetadata.title;
              }
            } catch (metadataErr) {
              // Continue to URL-based naming if feed metadata fails
            }
            
            // If still no name, get from URL
            if (!suggestedName) {
              // Try to get name parts from the URL path
              const pathParts = feedUrl.pathname.split('/').filter(Boolean);
              if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                // Clean up the last part (remove .xml, etc)
                suggestedName = lastPart.replace(/\.(xml|rss|atom)$/i, '');
              }
              
              if (!suggestedName) {
                suggestedName = feedUrl.hostname.replace('www.', '');
              }
            }
            
            setName(suggestedName);
            setSelectedFeedUrl(urlToFetch);
            setError(null); // Clear error for likely feed URLs
            return;
          }
        } catch (urlErr) {
          // URL parsing failed, continue to show error
        }
        
        // If we got here, it's not a valid feed
        setError('Unable to read feed. Please check the URL and try again.');
        setPreviewItems([]);
      } catch (fallbackErr) {
        setError('Unable to read feed. Please check the URL and try again.');
        setPreviewItems([]);
      }
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

    if (!selectedFeedUrl && !url.trim()) {
      setError('Please enter a feed URL');
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

        {selectedFeedUrl && (
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
        )}

        {previewItems.length > 0 ? (
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
        ) : selectedFeedUrl && (
          <View style={styles.previewContainer}>
            <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
              Feed Information
            </Text>
            <View style={[styles.previewCard, { 
              backgroundColor: colors.card,
              borderColor: colors.border 
            }]}>
              <View style={styles.emptyFeedMessage}>
                <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} style={styles.emptyFeedIcon} />
                <Text style={[styles.previewItemDescription, { color: colors.textSecondary }]}>
                  This feed is currently empty. You can still add it and articles will appear when they become available.
                </Text>
              </View>
            </View>
          </View>
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
  emptyFeedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyFeedIcon: {
    marginBottom: 4,
  },
});