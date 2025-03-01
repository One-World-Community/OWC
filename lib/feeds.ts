import { DOMParser } from 'xmldom';
import { supabase } from './supabase';
import type { RssFeed } from './supabase';
import { load as cheerioLoad } from 'cheerio';

export type FeedItem = {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  categories?: string[];
  isoDate?: string;
  imageUrl?: string;
};

export type FeedMetadata = {
  title?: string;
  description?: string;
  link?: string;
  language?: string;
  copyright?: string;
  pubDate?: string;
  lastBuildDate?: string;
  generator?: string;
  managingEditor?: string;
  webMaster?: string;
};

// Function to get channel-level metadata from a feed
export async function getFeedMetadata(feed: { url: string }): Promise<FeedMetadata> {
  try {
    const xml = await fetchWithCorsProxy(feed.url);
    const doc = parseXML(xml);
    
    // Get channel element
    const channelElements = doc.getElementsByTagName('channel');
    
    if (channelElements.length === 0) {
      // Try Atom format if no RSS channel is found
      return parseAtomFeedMetadata(doc);
    }
    
    const channel = channelElements[0];
    
    return {
      title: getElementText(channel, 'title'),
      description: getElementText(channel, 'description'),
      link: getElementText(channel, 'link'),
      language: getElementText(channel, 'language'),
      copyright: getElementText(channel, 'copyright'),
      pubDate: getElementText(channel, 'pubDate'),
      lastBuildDate: getElementText(channel, 'lastBuildDate'),
      generator: getElementText(channel, 'generator'),
      managingEditor: getElementText(channel, 'managingEditor'),
      webMaster: getElementText(channel, 'webMaster'),
    };
  } catch (error) {
    console.error('Error getting feed metadata:', error);
    return {};
  }
}

// Parse Atom feed metadata
function parseAtomFeedMetadata(doc: Document): FeedMetadata {
  try {
    // For Atom feeds, the feed element is the root
    const feed = doc.documentElement;
    
    if (feed?.tagName !== 'feed') {
      return {};
    }
    
    return {
      title: getElementText(feed, 'title'),
      description: getElementText(feed, 'subtitle') || getElementText(feed, 'summary'),
      link: getLinkFromAtom(feed),
      pubDate: getElementText(feed, 'updated'),
      generator: getElementText(feed, 'generator'),
    };
  } catch (error) {
    console.error('Error parsing Atom feed metadata:', error);
    return {};
  }
}

// Helper to get link from Atom feed
function getLinkFromAtom(feed: Element): string {
  const links = feed.getElementsByTagName('link');
  
  for (let i = 0; i < links.length; i++) {
    const rel = links[i].getAttribute('rel');
    // Prefer self or alternate links
    if (!rel || rel === 'self' || rel === 'alternate') {
      const href = links[i].getAttribute('href');
      if (href) return href;
    }
  }
  
  return '';
}

// Function to discover RSS feeds from a webpage
export async function discoverFeeds(url: string): Promise<Array<{ url: string; title?: string }>> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url.replace(/\/+$/, '')}`;
    const html = await fetchWithCorsProxy(normalizedUrl);
    const $ = cheerioLoad(html);
    const feeds: Array<{ url: string; title?: string }> = [];

    // Look for RSS/Atom feed links in the head
    $('link[type*="rss"], link[type*="atom"], link[type*="xml"]').each((_, element) => {
      const href = $(element).attr('href');
      const title = $(element).attr('title');
      
      if (href) {
        // Handle relative URLs
        const feedUrl = href.startsWith('http') ? 
          href : 
          new URL(href, normalizedUrl).toString();
          
        feeds.push({ 
          url: feedUrl,
          title: title || undefined
        });
      }
    });

    // Look for common feed paths if no feeds found
    if (feeds.length === 0) {
      const commonPaths = [
        '/feed',
        '/feed/',
        '/rss',
        '/rss/',
        '/feed.xml',
        '/rss.xml',
        '/atom.xml',
        '/index.xml',
        '/feeds/posts/default',
        '/blog/feed',
        '/blog/rss',
        '/blog/index.xml',
        '/blog/atom.xml',
        '/rss/index.rss',
        '/atom/index.atom'
      ];

      for (const path of commonPaths) {
        try {
          const feedUrl = new URL(path, normalizedUrl).toString();
          const response = await fetch(feedUrl, {
            method: 'HEAD',
            headers: {
              'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
            }
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && (
              contentType.includes('xml') || 
              contentType.includes('rss') || 
              contentType.includes('atom')
            )) {
              feeds.push({ url: feedUrl });
              break; // Found a valid feed, no need to check other paths
            }
          }
        } catch {
          // Skip invalid feeds
          continue;
        }
      }

      // If still no feeds found, try GitHub specific paths
      if (feeds.length === 0 && normalizedUrl.includes('github.io')) {
        const githubPaths = [
          '/feed.xml',
          '/atom.xml',
          '/rss.xml',
          '/index.xml'
        ];

        for (const path of githubPaths) {
          try {
            const feedUrl = new URL(path, normalizedUrl).toString();
            const response = await fetch(feedUrl);
            if (response.ok) {
              feeds.push({ url: feedUrl });
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
    
    return feeds;
  } catch (error) {
    console.error('Error discovering feeds:', error);
    return [];
  }
}

// Function to get website metadata
export async function getWebsiteMetadata(url: string) {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const html = await fetchWithCorsProxy(normalizedUrl);
    const $ = cheerioLoad(html);
    
    return {
      title: $('title').first().text() || undefined,
      description: $('meta[name="description"]').attr('content') || undefined,
      icon: $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || 
            $('link[rel="apple-touch-icon"]').attr('href') || undefined,
    };
  } catch (error) {
    console.error('Error getting website metadata:', error);
    return {
      title: undefined,
      description: undefined,
      icon: undefined,
    };
  }
}

function parseXML(xmlText: string): Document {
// Custom XML parser for RSS feeds
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: () => {},
    },
  });
  return parser.parseFromString(xmlText, 'text/xml');
}

function getElementText(element: Element | null, tagName: string): string {
  if (!element) return '';
  
  // Handle namespaced elements
  if (tagName.includes(':')) {
    const [namespace, localName] = tagName.split(':');
    const elements = element.getElementsByTagNameNS('*', localName);
    if (elements?.length) {
      return elements[0].textContent || '';
    }
  }

  const elements = element.getElementsByTagName(tagName);
  return elements?.[0]?.textContent || '';
}

function parseDate(dateStr: string): Date | null {
  try {
    // Try parsing various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try RFC822 format (common in RSS)
    const rfc822Date = new Date(dateStr.replace(/([\+\-]\d{4})/, ' UTC$1'));
    if (!isNaN(rfc822Date.getTime())) {
      return rfc822Date;
    }
    
    return null;
  } catch {
    return null;
  }
}

function extractImageUrl(item: Element): string | undefined {
  // Try media:content
  const mediaElements = item.getElementsByTagNameNS('*', 'content');
  for (let i = 0; i < mediaElements.length; i++) {
    const url = mediaElements[i].getAttribute('url');
    if (url) return url;
  }

  // Try enclosure
  const enclosures = item.getElementsByTagName('enclosure');
  for (let i = 0; i < enclosures.length; i++) {
    const type = enclosures[i].getAttribute('type');
    const url = enclosures[i].getAttribute('url');
    if (type?.startsWith('image/') && url) {
      return url;
    }
  }

  // Try content or description for embedded images
  const content = getElementText(item, 'content:encoded') || 
                 getElementText(item, 'content') || 
                 getElementText(item, 'description');
  
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    return imgMatch[1];
  }

  return undefined;
}

async function fetchWithCorsProxy(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneWorldCommunity/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    if (!text.trim()) {
      throw new Error('Empty response');
    }
    
    return text;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

function parseFeedItems(doc: Document): FeedItem[] {
  const items: FeedItem[] = [];
  let entries: Element[] = [];
  
  // Try RSS format first
  const rssItems = doc.getElementsByTagName('item');
  if (rssItems.length > 0) {
    entries = Array.from(rssItems);
  } else {
    // Try Atom format
    const atomEntries = doc.getElementsByTagName('entry');
    entries = Array.from(atomEntries);
  }

  for (const item of entries) {
    try {
      const title = getElementText(item, 'title');
      
      // Handle both RSS and Atom link formats
      
      // Try multiple date fields and formats
      const dateStr = getElementText(item, 'pubDate') || 
                     getElementText(item, 'published') ||
                     getElementText(item, 'date') ||
                     getElementText(item, 'updated') ||
                     getElementText(item, 'dc:date');
                     
      const parsedDate = dateStr ? parseDate(dateStr) : null;
      let link = '';
      const linkElement = item.getElementsByTagName('link')[0];
      if (linkElement) {
        link = linkElement.textContent?.trim() || 
               linkElement.getAttribute('href') || '';
      }

      const pubDate = getElementText(item, 'pubDate') || 
                     getElementText(item, 'published') ||
                     getElementText(item, 'date');
                     
      const content = getElementText(item, 'content:encoded') || 
                     getElementText(item, 'content');
                     
      const contentSnippet = getElementText(item, 'description') || 
                            getElementText(item, 'summary');
                            
      const guid = getElementText(item, 'guid') || link;
      
      const categories = Array.from(item.getElementsByTagName('category'))
        .map(cat => cat.textContent || '')
        .filter(Boolean);
        
      const imageUrl = extractImageUrl(item);

      // Only add items with required fields
      if (title && link) {
        items.push({
          title,
          link,
          pubDate: parsedDate?.toISOString() || undefined,
          content,
          contentSnippet,
          guid,
          categories,
          isoDate: parsedDate?.toISOString(),
          imageUrl,
        });
      }
    } catch (error) {
      console.warn('Error parsing feed item:', error);
      continue;
    }
  }

  return items;
}

export async function fetchFeedItems(feed: RssFeed | { url: string }): Promise<FeedItem[]> {
  try {
    const xmlText = await fetchWithCorsProxy(feed.url);
    const doc = parseXML(xmlText);
    const items = parseFeedItems(doc);
    
    if (items.length === 0) {
      throw new Error('No items found in feed');
    }
    
    // Only update feed status if it's a real feed (has an ID)
    if ('id' in feed) {
      await supabase
        .from('rss_feeds')
        .update({ 
          status: 'active',
          last_fetched_at: new Date().toISOString(),
          last_successful_fetch: new Date().toISOString(),
        })
        .eq('id', feed.id);
    }
    
    return items;
  } catch (error) {
    console.error(`Error fetching feed ${feed.url}:`, error);
    
    // Only update feed status if it's a real feed (has an ID)
    if ('id' in feed) {
      await supabase
        .from('rss_feeds')
        .update({ 
          status: 'error',
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', feed.id);
    }
    
    throw error;
  }
}

export async function getUserFeeds(userId: string) {
  const { data: userFeeds, error } = await supabase
    .from('user_feeds')
    .select(`
      feed_id,
      rss_feeds (
        id,
        name,
        url,
        icon_url,
        topic_id,
        status
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user feeds:', error);
    return [];
  }

  return userFeeds?.map(uf => uf.rss_feeds).filter(Boolean) || [];
}

export async function getUserTopicFeeds(userId: string) {
  const { data: userTopics, error } = await supabase
    .from('user_topics')
    .select(`
      topic_id,
      topics (
        id,
        name,
        icon,
        rss_feeds (
          id,
          name,
          url,
          icon_url,
          status
        )
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user topic feeds:', error);
    return [];
  }

  return userTopics?.map(ut => ({
    topic: ut.topics,
    feeds: ut.topics.rss_feeds.filter((feed: RssFeed) => feed.status === 'active'),
  })) || [];
}

export async function subscribeFeed(userId: string, feedId: string) {
  const { error } = await supabase
    .from('user_feeds')
    .insert({ user_id: userId, feed_id: feedId });
  
  if (error) throw error;
}

export async function unsubscribeFeed(userId: string, feedId: string) {
  const { error } = await supabase
    .from('user_feeds')
    .delete()
    .eq('user_id', userId)
    .eq('feed_id', feedId);
  
  if (error) throw error;
}

// Function to get feeds near a user's location
export async function getNearbyFeeds(options: {
  latitude: number;
  longitude: number;
  radius?: number; // in km
  topicId?: string;
  category?: string; // 'local_news', 'local_politics', 'community', etc.
}) {
  const { latitude, longitude, radius = 50, topicId, category } = options;
  
  try {
    let query = supabase
      .rpc('get_feeds_near_location', {
        lat: latitude,
        lng: longitude,
        radius_km: radius,
        category: category
      });
    
    // Filter by topic if provided
    if (topicId) {
      query = query.eq('topic_id', topicId);
    }
    
    const { data: feeds, error } = await query;
    
    if (error) {
      console.error('Error fetching nearby feeds:', error);
      throw error;
    }
    
    return feeds || [];
  } catch (err) {
    console.error('Error in getNearbyFeeds:', err);
    throw err;
  }
}