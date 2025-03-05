import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import GitHubAuth from '../components/GitHubAuth';
import BlogSetup from '../components/BlogSetup';
import { useTheme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

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
      
      // Fetch blogs directly from the user_blogs table
      const { data: userBlogs, error: blogsError } = await supabase
        .from('user_blogs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (blogsError) {
        console.error('Error fetching user blogs:', blogsError);
      }
      
      if (userBlogs && userBlogs.length > 0) {
        setBlogs(userBlogs);
      } else {
        // As a fallback, try the cloud function approach
        try {
          const { data, error } = await supabase.functions.invoke('handle-github', {
            body: {
              action: 'get-blogs'
            }
          });
          
          if (error) throw error;
          
          if (data?.blogs) {
            setBlogs(data.blogs);
          }
        } catch (cloudError) {
          console.error('Error fetching blogs from cloud function:', cloudError);
          // If both approaches fail, at least show what we got from the database
          if (userBlogs) {
            setBlogs(userBlogs);
          }
        }
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

  const handleRevokeGitHub = async () => {
    Alert.alert(
      'Revoke GitHub Access',
      'Are you sure you want to disconnect from GitHub? This will remove your ability to manage blogs.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Call function to revoke GitHub access
              const { data, error } = await supabase.functions.invoke('handle-github', {
                body: {
                  action: 'revoke-access'
                }
              });
              
              if (error) throw error;
              
              if (data?.success) {
                // Clean up local database state
                try {
                  // Remove the GitHub connection
                  await supabase
                    .from('github_connections')
                    .delete()
                    .is('user_id', null);
                    
                  // Note: We don't delete user_blogs records as they 
                  // remain in the database for historical purposes,
                  // but we clear them from the UI state
                  
                  setGithubUsername(null);
                  setBlogs([]);
                  Alert.alert('Success', 'GitHub connection has been revoked');
                } catch (cleanupError) {
                  console.error('Error cleaning up after revocation:', cleanupError);
                  // Still consider it a success if the cloud function succeeded
                  setGithubUsername(null);
                  setBlogs([]);
                  Alert.alert('Success', 'GitHub connection has been revoked, but there was an error cleaning up local data.');
                }
              }
            } catch (error) {
              console.error('Error revoking GitHub access:', error);
              Alert.alert('Error', `Failed to revoke GitHub access: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.revokeButton, { backgroundColor: colors.error }]}
                  onPress={handleRevokeGitHub}
                >
                  <Ionicons name="close-circle" size={20} color="#ffffff" style={styles.buttonIcon} />
                  <Text style={styles.revokeButtonText}>Revoke GitHub Access</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Blog</Text>
              
              {blogs.length > 0 ? (
                <View>
                  {blogs.map((blog) => (
                    <View key={blog.id} style={[styles.blogItem, { borderColor: colors.border }]}>
                      <Text style={[styles.blogName, { color: colors.text }]}>
                        {blog.title || blog.repo_name}
                      </Text>
                      {blog.description && (
                        <Text style={[styles.blogDescription, { color: colors.textSecondary }]}>
                          {blog.description}
                        </Text>
                      )}
                      <Text style={[styles.blogUrl, { color: colors.primary }]}>
                        {blog.site_url || blog.repo_url}
                      </Text>
                      {blog.is_setup_complete === false && (
                        <View style={styles.setupPendingContainer}>
                          <Text style={[styles.setupPendingText, { color: colors.warning }]}>
                            <Ionicons name="time-outline" size={14} color={colors.warning} /> Setup in progress...
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View>
                  <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
                    No blogs yet. Create one below to get started!
                  </Text>
                  
                  <BlogSetup 
                    onSuccess={handleBlogSuccess}
                    onError={handleBlogError}
                    colors={colors}
                  />
                </View>
              )}
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
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 30,
    alignSelf: 'flex-start',
  },
  revokeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 8,
  },
  blogDescription: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  setupPendingContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  setupPendingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
}); 