import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';

interface BlogSetupProps {
  onSuccess: (blogUrl: string) => void;
  onError: (error: string) => void;
  colors: any;
}

export default function BlogSetup({ onSuccess, onError, colors }: BlogSetupProps) {
  const [loading, setLoading] = useState(false);
  const [blogName, setBlogName] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [blogDescription, setBlogDescription] = useState('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const setupBlog = async () => {
    // Clear any previous error details
    setErrorDetails(null);

    if (!blogName.trim()) {
      Alert.alert('Error', 'Please enter a blog name');
      return;
    }

    // Simple validation for blog name (should be URL-friendly)
    const safeNameRegex = /^[a-z0-9-]+$/;
    if (!safeNameRegex.test(blogName.trim())) {
      Alert.alert('Error', 'Blog name can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setLoading(true);
      console.log("Setting up blog with name:", blogName.trim());
      
      // Generate a unique name if not provided
      const name = blogName.trim();
      const title = blogTitle.trim() || name;
      const description = blogDescription.trim() || 'My personal blog created with OWC';
      
      console.log("Calling handle-github function with params:", { name, title, description });
      
      // Create blog using the handle-github edge function
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'create-blog',
          params: {
            name,
            description,
            blogTitle: title
          }
        }
      });
      
      console.log("handle-github function response:", { data, error });
      
      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      
      if (data?.success) {
        console.log("Blog created successfully:", data.blog);
        
        // If there's a warning, show it but continue
        if (data.warning) {
          console.warn("Blog creation warning:", data.warning);
          Alert.alert('Warning', `Blog created, but with warning: ${data.warning}`);
        }
        
        // Store the blog URL in user metadata
        try {
          console.log("Updating user metadata with blog URL:", data.blog.github_pages_url);
          const { error: updateError } = await supabase.auth.updateUser({
            data: { blog_url: data.blog.github_pages_url }
          });
          
          if (updateError) {
            console.error('Error updating user metadata:', updateError);
          }
        } catch (metadataError) {
          console.error('Error updating user metadata:', metadataError);
        }
        
        onSuccess(data.blog.github_pages_url);
        setBlogName('');
        setBlogTitle('');
        setBlogDescription('');
      } else {
        // If there's no explicit error but also no success, handle it
        console.error("Blog creation failed without specific error:", data);
        throw new Error('Failed to create blog: Unknown error');
      }
    } catch (error) {
      console.error('Error setting up blog:', error);
      
      // Enhanced error handling to show more details
      let errorMessage = error instanceof Error ? error.message : String(error);
      let details = '';
      
      // Try to extract more details from the error response
      if (error instanceof Error && 'message' in error) {
        try {
          // Handle FunctionsHttpError which might contain JSON response with more details
          const responseData = JSON.parse(errorMessage.split('body: ')[1] || '{}');
          if (responseData.error) {
            errorMessage = responseData.error;
            
            if (responseData.details) {
              details = JSON.stringify(responseData.details, null, 2);
            }
          }
        } catch (parseError) {
          // If can't parse, just use the original message
          console.log("Couldn't parse error details:", parseError);
        }
      }
      
      // Save error details for display
      if (details) {
        setErrorDetails(details);
      }
      
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Create Your Blog</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Set up a new Jekyll blog using our template. This will create a new repository 
        in your GitHub account and set up GitHub Pages for hosting.
      </Text>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Name (Repository Name)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="my-awesome-blog"
          placeholderTextColor={colors.textSecondary}
          value={blogName}
          onChangeText={setBlogName}
          editable={!loading}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Only lowercase letters, numbers, and hyphens allowed
        </Text>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="My Awesome Blog"
          placeholderTextColor={colors.textSecondary}
          value={blogTitle}
          onChangeText={setBlogTitle}
          editable={!loading}
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Description</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="A blog about my awesome thoughts and ideas"
          placeholderTextColor={colors.textSecondary}
          value={blogDescription}
          onChangeText={setBlogDescription}
          multiline
          numberOfLines={3}
          editable={!loading}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
        onPress={setupBlog}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Blog</Text>
        )}
      </TouchableOpacity>
      
      {errorDetails && (
        <ScrollView 
          style={[styles.errorDetails, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
          <Text style={[styles.errorDetailsText, { color: colors.error }]}>
            Error Details:
          </Text>
          <Text style={[styles.errorDetailsContent, { color: colors.error }]}>
            {errorDetails}
          </Text>
        </ScrollView>
      )}
      
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Note: It may take a few minutes for your blog to be fully set up and deployed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
  errorDetails: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 150,
  },
  errorDetailsText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetailsContent: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
}); 