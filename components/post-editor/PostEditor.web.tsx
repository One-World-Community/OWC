import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { PostEditorProps } from './PostEditor';
import { AntDesign, Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

export default function PostEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  colors,
  onSubmit,
  onCancel,
  onAddImage
}: PostEditorProps) {
  // Reference to the editable div
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [selectedText, setSelectedText] = useState('');
  
  // Initialize the editor content from markdown
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(content);
    }
  }, []);

  // Handle editor content changes
  const handleEditorChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const markdown = htmlToMarkdown(html);
      onContentChange(markdown);
    }
  };

  // Get the current selection in the editor
  const getSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      setSelectedText(selection.toString());
      return selection;
    }
    setSelectedText('');
    return null;
  };

  // Toolbar action handlers
  const formatText = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleEditorChange();
    editorRef.current?.focus();
  };

  const insertHeader = (level: number) => {
    const selection = getSelection();
    if (selection) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();
      const headerEl = document.createElement(`h${level}`);
      headerEl.textContent = selectedText;
      range.deleteContents();
      range.insertNode(headerEl);
      handleEditorChange();
    } else {
      formatText('formatBlock', `<h${level}>`);
    }
  };

  const insertImage = async () => {
    // Simple prompt for image URL in this example
    const imageUrl = prompt('Enter image URL:');
    if (imageUrl) {
      formatText('insertImage', imageUrl);
      if (onAddImage) {
        onAddImage(imageUrl);
      }
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      formatText('createLink', url);
    }
  };

  // Convert markdown to HTML (basic implementation)
  const markdownToHtml = (markdown: string): string => {
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
      // Images
      .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
      // Lists
      .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
      .replace(/^\d\. (.*$)/gim, '<ol><li>$1</li></ol>')
      // Paragraphs
      .replace(/\n$/gim, '<br />')
      .replace(/\n\n/gim, '</p><p>');
    
    return `<p>${html}</p>`;
  };

  // Convert HTML to markdown (basic implementation)
  const htmlToMarkdown = (html: string): string => {
    // Create a temporary div to work with the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Process headers
    Array.from(tempDiv.querySelectorAll('h1')).forEach(h1 => {
      h1.outerHTML = `# ${h1.textContent}\n\n`;
    });
    
    Array.from(tempDiv.querySelectorAll('h2')).forEach(h2 => {
      h2.outerHTML = `## ${h2.textContent}\n\n`;
    });
    
    Array.from(tempDiv.querySelectorAll('h3')).forEach(h3 => {
      h3.outerHTML = `### ${h3.textContent}\n\n`;
    });
    
    // Process bold text
    Array.from(tempDiv.querySelectorAll('strong, b')).forEach(strong => {
      strong.outerHTML = `**${strong.textContent}**`;
    });
    
    // Process italic text
    Array.from(tempDiv.querySelectorAll('em, i')).forEach(em => {
      em.outerHTML = `*${em.textContent}*`;
    });
    
    // Process links
    Array.from(tempDiv.querySelectorAll('a')).forEach(a => {
      a.outerHTML = `[${a.textContent}](${a.getAttribute('href')})`;
    });
    
    // Process images
    Array.from(tempDiv.querySelectorAll('img')).forEach(img => {
      img.outerHTML = `![${img.getAttribute('alt') || ''}](${img.getAttribute('src')})`;
    });
    
    // Process lists
    Array.from(tempDiv.querySelectorAll('ul')).forEach(ul => {
      const items = Array.from(ul.querySelectorAll('li'))
        .map(li => `- ${li.textContent}`)
        .join('\n');
      ul.outerHTML = `${items}\n\n`;
    });
    
    Array.from(tempDiv.querySelectorAll('ol')).forEach(ol => {
      const items = Array.from(ol.querySelectorAll('li'))
        .map((li, index) => `${index + 1}. ${li.textContent}`)
        .join('\n');
      ol.outerHTML = `${items}\n\n`;
    });
    
    // Replace paragraph tags and line breaks
    let markdown = tempDiv.innerHTML
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<br\s*\/?>/g, '\n');
    
    // Clean up any remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');
    
    return markdown.trim();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Cancel and Next buttons */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Post</Text>
        <TouchableOpacity onPress={onSubmit} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, { color: colors.primary }]}>Next</Text>
        </TouchableOpacity>
      </View>
      
      {/* Title input */}
      <TextInput
        style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
        placeholder="Title (Required)"
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={onTitleChange}
      />
      
      {/* Formatting toolbar */}
      {toolbarVisible && (
        <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => formatText('bold')}>
            <FontAwesome name="bold" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => formatText('italic')}>
            <FontAwesome name="italic" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => insertHeader(2)}>
            <Text style={[styles.toolbarText, { color: colors.text }]}>H2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => insertHeader(3)}>
            <Text style={[styles.toolbarText, { color: colors.text }]}>H3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => formatText('insertUnorderedList')}>
            <FontAwesome name="list-ul" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={() => formatText('insertOrderedList')}>
            <FontAwesome name="list-ol" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={insertLink}>
            <FontAwesome name="link" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={insertImage}>
            <FontAwesome name="image" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Content editor */}
      <ScrollView style={styles.scrollContainer}>
        <div
          ref={editorRef}
          contentEditable={true}
          style={{
            minHeight: 300,
            padding: 16,
            color: colors.text,
            lineHeight: 1.5,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 16,
            outline: 'none'
          }}
          onInput={handleEditorChange}
          onFocus={() => setToolbarVisible(true)}
          onBlur={() => getSelection()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    borderBottomWidth: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    margin: 8,
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  toolbarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
