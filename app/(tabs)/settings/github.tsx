import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import GitHubAuth from '../../components/GitHubAuth';

export default function GitHubSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [blogs, setBlogs] = useState<any[]>([]);

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const checkGitHubConnection = async () => {
    try {
      setLoading(true);
      
      // Check if user has a GitHub connection
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'get-blogs'
        }
      });
      
      if (error) throw error;
      
      if (data?.blogs?.length > 0) {
        // User has blogs, so they must have a GitHub connection
        setBlogs(data.blogs);
        // We could also fetch the GitHub username here if needed
        setGithubUsername('Connected'); // Placeholder
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
    // Refresh blogs
    checkGitHubConnection();
  };

  const handleGitHubError = (error: string) => {
    Alert.alert('Error', `Failed to connect to GitHub: ${error}`);
  };

  const createNewBlog = async () => {
    try {
      setLoading(true);
      
      // Generate a unique name based on timestamp
      const blogName = `blog-${Date.now()}`;
      
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'create-blog',
          params: {
            name: blogName,
            description: 'My personal blog created with OWC',
            blogTitle: 'My OWC Blog'
          }
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        Alert.alert('Success', `Blog created at ${data.blog.url}`);
        checkGitHubConnection();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to create blog: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'GitHub Integration' }} />
      
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          {githubUsername ? (
            <View style={styles.connectedContainer}>
              <Text style={styles.title}>Connected to GitHub</Text>
              <Text style={styles.subtitle}>Username: {githubUsername}</Text>
              
              <Text style={styles.sectionTitle}>Your Blogs</Text>
              {blogs.length > 0 ? (
                blogs.map((blog) => (
                  <View key={blog.id} style={styles.blogItem}>
                    <Text style={styles.blogName}>{blog.repo_name}</Text>
                    <Text style={styles.blogUrl}>{blog.repo_url}</Text>
                  </View>
                ))
              ) : (
                <Text>No blogs yet. Create one to get started!</Text>
              )}
              
              <View style={styles.buttonContainer}>
                <GitHubAuth 
                  onSuccess={handleGitHubSuccess}
                  onError={handleGitHubError}
                />
              </View>
            </View>
          ) : (
            <View style={styles.connectContainer}>
              <Text style={styles.title}>Connect to GitHub</Text>
              <Text style={styles.subtitle}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  connectContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  connectedContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
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
  blogItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
  },
  blogName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  blogUrl: {
    fontSize: 14,
    color: '#0366d6',
    marginTop: 5,
  },
}); 