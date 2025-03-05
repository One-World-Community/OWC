import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Alert,
  Keyboard,
  InputAccessoryView,
  Animated
} from 'react-native';
import { AntDesign, Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { PostEditorProps } from './PostEditor';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';

// Interface for text selection
interface Selection {
  start: number;
  end: number;
}

export default function PostEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  colors,
  onSubmit,
  onCancel,
  onAddImage,
  insets
}: PostEditorProps) {
  const [editorValue, setEditorValue] = useState(content);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const contentRef = useRef<TextInput>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeModal, setActiveModal] = useState<'link' | 'image' | null>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [contentFocused, setContentFocused] = useState(false);
  const toolbarPosition = useRef(new Animated.Value(0)).current;
  
  // For Android - track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Apply changes to parent component
  useEffect(() => {
    onContentChange(editorValue);
  }, [editorValue]);

  // Format helpers
  const getSelectedText = (): string => {
    return editorValue.substring(selection.start, selection.end);
  };

  const replaceText = (replacement: string): void => {
    const newText = 
      editorValue.substring(0, selection.start) + 
      replacement + 
      editorValue.substring(selection.end);
    
    setEditorValue(newText);
    
    // After replacing, update selection position
    const newPosition = selection.start + replacement.length;
    setSelection({ start: newPosition, end: newPosition });
  };

  const insertAround = (prefix: string, suffix: string): void => {
    const selectedText = getSelectedText();
    const replacement = `${prefix}${selectedText}${suffix}`;
    replaceText(replacement);
  };

  // Formatting handlers
  const handleBold = () => {
    insertAround('**', '**');
  };

  const handleItalic = () => {
    insertAround('*', '*');
  };

  const handleHeader = (level: number) => {
    const prefix = '#'.repeat(level) + ' ';
    const selectedText = getSelectedText();
    
    // Get line start position
    let lineStart = selection.start;
    while (lineStart > 0 && editorValue[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Get line end position
    let lineEnd = selection.end;
    while (lineEnd < editorValue.length && editorValue[lineEnd] !== '\n') {
      lineEnd++;
    }
    
    // Replace the entire line
    const newText = 
      editorValue.substring(0, lineStart) + 
      prefix + editorValue.substring(lineStart, lineEnd).replace(/^#+\s/, '') + 
      editorValue.substring(lineEnd);
    
    setEditorValue(newText);
  };

  const handleUnorderedList = () => {
    const selectedText = getSelectedText();
    const lines = selectedText.split('\n');
    const newLines = lines.map(line => line.trim() ? `- ${line}` : line);
    replaceText(newLines.join('\n'));
  };

  const handleOrderedList = () => {
    const selectedText = getSelectedText();
    const lines = selectedText.split('\n');
    const newLines = lines.map((line, index) => 
      line.trim() ? `${index + 1}. ${line}` : line
    );
    replaceText(newLines.join('\n'));
  };

  const openLinkModal = () => {
    const selectedText = getSelectedText();
    setLinkText(selectedText);
    setLinkUrl('');
    setActiveModal('link');
    setModalVisible(true);
  };

  const insertLink = () => {
    const markdownLink = `[${linkText}](${linkUrl})`;
    replaceText(markdownLink);
    setModalVisible(false);
  };

  const openImageModal = () => {
    setImageAlt('');
    setImageUrl('');
    setActiveModal('image');
    setModalVisible(true);
  };

  const insertImage = () => {
    const markdownImage = `![${imageAlt}](${imageUrl})`;
    replaceText(markdownImage);
    if (onAddImage) {
      onAddImage(imageUrl);
    }
    setModalVisible(false);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
  
      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error picking image', 'Please try again');
    }
  };

  // Render the formatting toolbar
  const renderToolbar = () => (
    <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.toolbarButton} onPress={handleBold}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="bold" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="bold" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={handleItalic}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="italic" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="italic" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => handleHeader(2)}>
        <Text style={[styles.toolbarText, { color: colors.text }]}>H2</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={() => handleHeader(3)}>
        <Text style={[styles.toolbarText, { color: colors.text }]}>H3</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={handleUnorderedList}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="list.bullet" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="list-ul" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={handleOrderedList}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="list.number" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="list-ol" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={openLinkModal}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="link" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="link" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolbarButton} onPress={openImageModal}>
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="photo" 
            style={styles.symbolStyle} 
            tintColor={colors.text}
          />
        ) : (
          <FontAwesome name="image" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets?.top ?? 0}
    >
      {/* Header with Cancel and Next buttons */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New post</Text>
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
      
      {/* Content editor */}
      <ScrollView style={styles.scrollContainer}>
        <TextInput
          ref={contentRef}
          style={[styles.contentInput, { color: colors.text }]}
          multiline
          value={editorValue}
          onChangeText={setEditorValue}
          placeholder="Start writing..."
          placeholderTextColor={colors.textSecondary}
          onSelectionChange={(event) => {
            setSelection(event.nativeEvent.selection);
          }}
          onFocus={() => setContentFocused(true)}
          onBlur={() => setContentFocused(false)}
          inputAccessoryViewID="formatting-toolbar"
        />
      </ScrollView>
      
      {/* iOS InputAccessoryView toolbar */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="formatting-toolbar">
          {renderToolbar()}
        </InputAccessoryView>
      )}
      
      {/* Android toolbar that appears when keyboard is visible */}
      {Platform.OS === 'android' && keyboardVisible && contentFocused && (
        <View style={styles.androidToolbarContainer}>
          {renderToolbar()}
        </View>
      )}
      
      {/* Modal for links and images */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <Pressable 
            style={[styles.modalView, { backgroundColor: colors.card }]}
            onPress={e => e.stopPropagation()}
          >
            {activeModal === 'link' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Link</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Link text"
                  placeholderTextColor={colors.textSecondary}
                  value={linkText}
                  onChangeText={setLinkText}
                />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="URL"
                  placeholderTextColor={colors.textSecondary}
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, { borderColor: colors.border }]} 
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={{ color: colors.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, { backgroundColor: colors.primary }]} 
                    onPress={insertLink}
                  >
                    <Text style={{ color: '#fff' }}>Insert Link</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {activeModal === 'image' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Image</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Alt text (description)"
                  placeholderTextColor={colors.textSecondary}
                  value={imageAlt}
                  onChangeText={setImageAlt}
                />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Image URL"
                  placeholderTextColor={colors.textSecondary}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                />
                <TouchableOpacity 
                  style={[styles.pickImageButton, { borderColor: colors.border }]} 
                  onPress={pickImage}
                >
                  <Text style={{ color: colors.text }}>Pick from device</Text>
                </TouchableOpacity>
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, { borderColor: colors.border }]} 
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={{ color: colors.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, { backgroundColor: colors.primary }]} 
                    onPress={insertImage}
                  >
                    <Text style={{ color: '#fff' }}>Insert Image</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
  contentInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 300,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 8,
    borderTopWidth: 1,
  },
  androidToolbarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  symbolStyle: {
    height: 18,
    width: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    borderRadius: 5,
    padding: 10,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
  },
  pickImageButton: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
});
