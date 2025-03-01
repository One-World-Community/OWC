import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { fetchFeedItems, type FeedItem } from '../../lib/feeds';
import { supabase } from '../../lib/supabase';
import { RssFeed } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

export default function FeedDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [feed, setFeed] = useState<RssFeed | null>(null);
  const [articles, setArticles] = useState<FeedItem[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<FeedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadFeedDetails();
    }
  }, [id]);

  useEffect(() => {
    filterArticles();
  }, [searchQuery, articles]);

  const filterArticles = () => {
    if (!searchQuery.trim()) {
      setFilteredArticles(articles);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = articles.filter(article => 
      article.title?.toLowerCase().includes(query) ||
      article.contentSnippet?.toLowerCase().includes(query)
    );
    setFilteredArticles(filtered);
  };

  const loadFeedDetails = async () => {
    try {
      setLoading(true);
      
      const { data: feedData, error: feedError } = await supabase
        .from('rss_feeds')
        .select('*')
        .eq('id', id)
        .single();
      
      if (feedError) throw feedError;
      
      setFeed(feedData as RssFeed);
      
      const items = await fetchFeedItems(feedData as RssFeed);
      setArticles(items);
      setFilteredArticles(items);
    } catch (err) {
      console.error('Error loading feed details:', err);
      setError('Failed to load feed details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenArticle = async (link: string) => {
    await WebBrowser.openBrowserAsync(link);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return '';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (error || !feed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error || 'Feed not found'}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadFeedDetails}>
          <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={{ height: insets.top }} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            {feed.icon_url && (
              <Image source={{ uri: feed.icon_url }} style={styles.feedIcon} />
            )}
            <Text style={[styles.feedName, { color: colors.text }]} numberOfLines={1}>
              {feed.name}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text }]}
          placeholder="Search articles..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <FlatList
        data={filteredArticles}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.articleCard, { backgroundColor: colors.card }]}
            onPress={() => handleOpenArticle(item.link)}>
            {item.imageUrl && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: item.imageUrl }} style={styles.articleImage} />
              </View>
            )}
            <View style={styles.articleContent}>
              <Text style={[styles.articleTitle, { color: colors.text }]}>{item.title}</Text>
              {item.contentSnippet && (
                <Text 
                  style={[styles.articleSnippet, { color: colors.textSecondary }]}
                  numberOfLines={2}>
                  {item.contentSnippet}
                </Text>
              )}
              {item.pubDate && (
                <Text style={[styles.articleDate, { color: colors.textSecondary }]}>
                  {formatDate(item.pubDate)}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        keyExtractor={(item, index) => item.guid || item.link || `article-${index}`}
        contentContainerStyle={[styles.articlesList, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}
        refreshing={loading}
        onRefresh={loadFeedDetails}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No articles found
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
  },
  feedName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  articlesList: {
    padding: 16,
  },
  articleCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    justifyContent: 'center',
  },
  articleImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  articleSnippet: {
    fontSize: 14,
    marginBottom: 4,
  },
  articleDate: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    padding: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});