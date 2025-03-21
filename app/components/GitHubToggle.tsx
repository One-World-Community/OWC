import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface GitHubToggleProps {
  colors: any;
}

export default function GitHubToggle({ colors }: GitHubToggleProps) {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const checkGitHubConnection = async () => {
    try {
      setLoading(true);
      
      // Check if user has a GitHub connection directly from the database
      const { data: connectionData, error: connectionError } = await supabase
        .from('github_connections')
        .select('github_username')
        .single();
      
      if (connectionError && connectionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        throw connectionError;
      }
      
      if (connectionData) {
        setIsConnected(true);
        setUsername(connectionData.github_username);
      } else {
        setIsConnected(false);
        setUsername(null);
      }
    } catch (error) {
      console.error('Error checking GitHub connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const navigateToGitHubSettings = () => {
    router.push('/modals/github-settings');
  };

  const handleRevoke = async () => {
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
                setIsConnected(false);
                setUsername(null);
                Alert.alert('Success', 'GitHub connection has been revoked');
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

  if (loading) {
    return (
      <TouchableOpacity style={styles.menuItem}>
        <View style={styles.menuItemContent}>
          <Ionicons name="logo-github" size={24} color={colors.textSecondary} />
          <Text style={[styles.menuText, { color: colors.text }]}>GitHub</Text>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={navigateToGitHubSettings}>
        <View style={styles.menuItemContent}>
          <Ionicons name="logo-github" size={24} color={colors.textSecondary} />
          <Text style={[styles.menuText, { color: colors.text }]}>
            GitHub {isConnected ? `(${username || 'Connected'})` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
      
      {isConnected && (
        <TouchableOpacity 
          style={[styles.menuItem, styles.subMenuItem]}
          onPress={handleRevoke}>
          <View style={styles.menuItemContent}>
            <Ionicons name="close-circle" size={20} color={colors.error} style={styles.subMenuIcon} />
            <Text style={[styles.menuText, styles.subMenuText, { color: colors.error }]}>
              Disconnect GitHub
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  subMenuItem: {
    paddingVertical: 8,
    paddingLeft: 36,
  },
  subMenuText: {
    fontSize: 14,
  },
  subMenuIcon: {
    marginLeft: 8,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 8,
  },
}); 