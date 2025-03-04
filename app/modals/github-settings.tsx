import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import GitHubAuth from '../components/GitHubAuth';
import BlogSetup from '../components/BlogSetup';
import { useTheme } from '../../lib/theme';

export default function GitHubSettingsModal() {
  const [loading, setLoading] = useState(true);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [blogs, setBlogs] = useState<any[]>([]);
  const { colors } = useTheme();

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const checkGitHubConnection = async () => {
    try {
      setLoading(true);
      
      // First check if user has a GitHub connection from the database
      const { data: connectionData, error: connectionError } = await supabase
        .from('github_connections')
        .select('github_username')
        .single();
      
      if (connectionError && connectionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        throw connectionError;
      }
      
      if (connectionData) {
        setGithubUsername(connectionData.github_username);
      } else {
        setGithubUsername(null);
        setBlogs([]);
        return; // No connection, so don't try to fetch blogs
      }
      
      // Fetch blogs if connected
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'get-blogs'
        }
      });
      
      if (error) throw error;
      
      if (data?.blogs) {
        setBlogs(data.blogs);
      }
    } catch (error) {
      console.error('Error checking GitHub connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSuccess = (username: string) => {
    setGithubUsername(username);
    Alert.alert('Success', `Connected to GitHub as ${username}`);
    // Refresh connection and blogs
    checkGitHubConnection();
  };

  const handleGitHubError = (error: string) => {
    Alert.alert('Error', `Failed to connect to GitHub: ${error}`);
  };

  const handleBlogSuccess = (blogUrl: string) => {
    Alert.alert('Blog Created', `Your blog has been created successfully! It will be available at ${blogUrl} once GitHub Pages deployment is complete.`);
    checkGitHubConnection();
  };

  const handleBlogError = (error: string) => {
    Alert.alert('Error', `Failed to create blog: ${error}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'GitHub Integration' }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {githubUsername ? (
            <View style={styles.connectedContainer}>
              <Text style={[styles.title, { color: colors.text }]}>Connected to GitHub</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Username: {githubUsername}</Text>
              
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Blogs</Text>
              {blogs.length > 0 ? (
                blogs.map((blog) => (
                  <View key={blog.id} style={[styles.blogItem, { borderColor: colors.border }]}>
                    <Text style={[styles.blogName, { color: colors.text }]}>{blog.repo_name}</Text>
                    <Text style={[styles.blogUrl, { color: colors.primary }]}>{blog.repo_url}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.textSecondary }}>No blogs yet. Create one below to get started!</Text>
              )}
              
              <BlogSetup 
                onSuccess={handleBlogSuccess}
                onError={handleBlogError}
                colors={colors}
              />
              
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>GitHub Connection</Text>
                <GitHubAuth 
                  onSuccess={handleGitHubSuccess}
                  onError={handleGitHubError}
                />
              </View>
            </View>
          ) : (
            <View style={styles.connectContainer}>
              <Text style={[styles.title, { color: colors.text }]}>Connect to GitHub</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Connect your GitHub account to create and manage blogs.
              </Text>
              
              <View style={styles.buttonContainer}>
                <GitHubAuth 
                  onSuccess={handleGitHubSuccess}
                  onError={handleGitHubError}
                />
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
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
    paddingTop: 50,
  },
  connectContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  connectedContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 10,
  },
  sectionContainer: {
    marginTop: 30,
  },
  blogItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  blogName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  blogUrl: {
    fontSize: 14,
    marginTop: 5,
  },
}); 