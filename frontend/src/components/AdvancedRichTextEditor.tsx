import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

// Types for content structure
interface FormattedText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface ContentBlock {
  id: string;
  type: 'paragraph' | 'heading1' | 'heading2' | 'bullet' | 'numbered' | 'table';
  content?: FormattedText[];
  text?: string;
  listIndex?: number;
  table?: {
    rows: number;
    cols: number;
    data: string[][];
    hasHeaderRow?: boolean;
    hasHeaderColumn?: boolean;
  };
}

interface EditorState {
  blocks: ContentBlock[];
  selectedBlockId: string | null;
  selectedTextIndex: number | null;
}

// Toolbar Button Component
const ToolbarButton: React.FC<{
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
  size?: number;
}> = ({ icon, onPress, disabled, color, size = 18 }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.toolbarButton, disabled && styles.toolbarButtonDisabled]}
  >
    <Ionicons name={icon as any} size={size} color={disabled ? '#ccc' : color} />
  </TouchableOpacity>
);

// Table Cell Component
const TableCell: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  borderColor: string;
  textColor: string;
  backgroundColor: string;
  columnWidth: number;
  isLastColumn: boolean;
  isHeader: boolean;
}> = ({ value, onChangeText, borderColor, textColor, backgroundColor, columnWidth, isLastColumn, isHeader }) => (
  <View
    style={[
      styles.tableCellWrapper,
      {
        width: columnWidth,
        borderColor,
        borderRightWidth: isLastColumn ? 0 : 2,
      },
    ]}
  >
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline
      scrollEnabled={true}
      numberOfLines={3}
      style={[
        styles.tableCell,
        isHeader && styles.tableHeaderCell,
        {
          color: textColor,
          backgroundColor,
        },
      ]}
      placeholderTextColor={textColor + '99'}
    />
  </View>
);

// Table Modal Component
const TableModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreate: (rows: number, cols: number) => void;
  colors: any;
}> = ({ visible, onClose, onCreate, colors }) => {
  const [rows, setRows] = useState('3');
  const [cols, setCols] = useState('3');

  const handleCreate = () => {
    const rowNum = parseInt(rows);
    const colNum = parseInt(cols);

    if (isNaN(rowNum) || isNaN(colNum) || rowNum < 1 || colNum < 1) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for rows and columns (minimum 1)');
      return;
    }

    if (rowNum > 20 || colNum > 20) {
      Alert.alert('Too Large', 'Maximum 20 rows and 20 columns allowed');
      return;
    }

    onCreate(rowNum, colNum);
    setRows('3');
    setCols('3');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.tableModalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Insert Table</Text>

          <Text style={[styles.modalLabel, { color: colors.text }]}>Number of Rows</Text>
          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="3"
            placeholderTextColor={colors.textSecondary}
            value={rows}
            onChangeText={setRows}
            keyboardType="number-pad"
            maxLength={2}
          />

          <Text style={[styles.modalLabel, { color: colors.text }]}>Number of Columns</Text>
          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="3"
            placeholderTextColor={colors.textSecondary}
            value={cols}
            onChangeText={setCols}
            keyboardType="number-pad"
            maxLength={2}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalButton, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.modalButtonText, { color: colors.surface }]}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Table Display Component
const TableDisplay: React.FC<{
  table: { rows: number; cols: number; data: string[][]; hasHeaderRow?: boolean; hasHeaderColumn?: boolean };
  onCellChange: (row: number, col: number, text: string) => void;
  colors: any;
}> = ({ table, onCellChange, colors }) => {
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const safeRows = Array.from({ length: table.rows }, (_, rowIndex) => {
    const existingRow = table.data[rowIndex] || [];
    return Array.from({ length: table.cols }, (_, colIndex) => existingRow[colIndex] || '');
  });
  const safeCols = Math.max(1, table.cols);
  const minColumnWidth = 110;
  const baseWidth = Math.max(wrapperWidth, 1);
  const tableWidth = Math.max(baseWidth, safeCols * minColumnWidth);
  const columnWidth = tableWidth / safeCols;

  return (
    <View
      style={styles.tableWrapper}
      onLayout={(event) => {
        const next = Math.floor(event.nativeEvent.layout.width);
        if (next > 0 && next !== wrapperWidth) {
          setWrapperWidth(next);
        }
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        scrollEventThrottle={16}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={[styles.tableContainer, { width: tableWidth }]}>
          {safeRows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[
                styles.tableRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: rowIndex === table.rows - 1 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              {row.map((cell, colIndex) => (
                <TableCell
                  key={`cell-${rowIndex}-${colIndex}`}
                  value={cell}
                  onChangeText={(text) => onCellChange(rowIndex, colIndex, text)}
                  borderColor={colors.border}
                  textColor={colors.text}
                  backgroundColor={
                    (table.hasHeaderRow && rowIndex === 0) || (table.hasHeaderColumn && colIndex === 0)
                      ? colors.surface
                      : colors.card
                  }
                  columnWidth={columnWidth}
                  isLastColumn={colIndex === table.cols - 1}
                  isHeader={
                    (table.hasHeaderRow && rowIndex === 0) || (table.hasHeaderColumn && colIndex === 0)
                  }
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// Formatted Text Display Component
const FormattedTextBlock: React.FC<{
  content: FormattedText[];
  style: any;
  colors: any;
  blockType: string;
}> = ({ content, style, colors, blockType }) => {
  if (!content || content.length === 0) {
    return <Text style={[style, { color: colors.textSecondary }]}>Start typing...</Text>;
  }

  return (
    <Text style={style}>
      {content.map((item, index) => (
        <Text
          key={index}
          style={[
            { color: colors.text },
            item.bold && styles.bold,
            item.italic && styles.italic,
            item.underline && styles.underline,
          ]}
        >
          {item.text}
        </Text>
      ))}
    </Text>
  );
};

// Main Editor Component
const AdvancedRichTextEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onChangeStructured?: (value: string) => void;
  initialStructuredContent?: string;
  placeholder?: string;
  editable?: boolean;
  onPressAttachment?: () => void;
  onPressLink?: () => void;
}> = ({
  value,
  onChange,
  onChangeStructured,
  initialStructuredContent,
  placeholder = 'Start typing...',
  editable = true,
  onPressAttachment,
  onPressLink,
}) => {
  const { colors } = useTheme();
  const getInitialBlocks = useCallback((): ContentBlock[] => {
    if (initialStructuredContent) {
      try {
        const parsed = JSON.parse(initialStructuredContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as ContentBlock[];
        }
      } catch {
        // fall back to plain text value
      }
    }

    return [
      {
        id: '1',
        type: 'paragraph',
        content: value
          ? [{ text: value, bold: false, italic: false, underline: false }]
          : [],
        text: value,
      },
    ];
  }, [initialStructuredContent, value]);

  const [editorState, setEditorState] = useState<EditorState>({
    blocks: getInitialBlocks(),
    selectedBlockId: '1',
    selectedTextIndex: null,
  });

  const [showTableModal, setShowTableModal] = useState(false);
  const currentBlockRef = useRef<TextInput>(null);

  // Helper to generate unique ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Update editor content and notify parent
  const updateEditorState = useCallback(
    (newState: EditorState) => {
      setEditorState(newState);
      // Serialize blocks to plain text for storage
      const plainText = newState.blocks
        .map((block) => {
          if (block.type === 'paragraph' || block.type === 'heading1' || block.type === 'heading2') {
            return block.content?.map((t) => t.text).join('') || '';
          } else if (block.type === 'bullet' || block.type === 'numbered') {
            return block.text || '';
          }
          return '';
        })
        .filter((text) => text.length > 0)
        .join('\n');

      onChange(plainText);
      if (onChangeStructured) {
        onChangeStructured(JSON.stringify(newState.blocks));
      }
    },
    [onChange, onChangeStructured]
  );

  // Handle text input change
  const handleTextChange = (blockId: string, newText: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId) {
        return {
          ...block,
          text: newText,
          content: [{ text: newText, bold: false, italic: false, underline: false }],
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  // Apply formatting
  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    if (!editorState.selectedBlockId) return;

    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === editorState.selectedBlockId && block.content) {
        const updated = block.content.map((item) => ({
          ...item,
          [format]: !item[format as keyof FormattedText],
        }));
        return { ...block, content: updated };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  // Add new block
  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      content: type === 'bullet' || type === 'numbered' ? [] : [{ text: '', bold: false, italic: false, underline: false }],
      text: '',
      listIndex: type === 'numbered' ? editorState.blocks.filter((b) => b.type === 'numbered').length + 1 : 0,
    };

    updateEditorState({
      ...editorState,
      blocks: [...editorState.blocks, newBlock],
      selectedBlockId: newBlock.id,
    });
  };

  // Insert table
  const insertTable = (rows: number, cols: number) => {
    const tableData = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(''));

    const newBlock: ContentBlock = {
      id: generateId(),
      type: 'table',
      table: { rows, cols, data: tableData, hasHeaderRow: false, hasHeaderColumn: false },
    };

    updateEditorState({
      ...editorState,
      blocks: [...editorState.blocks, newBlock],
      selectedBlockId: newBlock.id,
    });
  };

  // Update table cell
  const updateTableCell = (blockId: string, row: number, col: number, text: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId && block.table) {
        const newData = block.table.data.map((r, rIdx) =>
          rIdx === row ? r.map((c, cIdx) => (cIdx === col ? text : c)) : r
        );
        return {
          ...block,
          table: { ...block.table, data: newData },
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  const addTableRow = (blockId: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId && block.table) {
        if (block.table.rows >= 20) {
          return block;
        }
        const newRow = Array(block.table.cols).fill('');
        return {
          ...block,
          table: {
            ...block.table,
            rows: block.table.rows + 1,
            data: [...block.table.data, newRow],
          },
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  const addTableColumn = (blockId: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId && block.table) {
        if (block.table.cols >= 20) {
          return block;
        }
        const newData = block.table.data.map((row) => [...row, '']);
        return {
          ...block,
          table: {
            ...block.table,
            cols: block.table.cols + 1,
            data: newData,
          },
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  const toggleTableHeaderRow = (blockId: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId && block.table) {
        return {
          ...block,
          table: {
            ...block.table,
            hasHeaderRow: !block.table.hasHeaderRow,
          },
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  const toggleTableHeaderColumn = (blockId: string) => {
    const newBlocks = editorState.blocks.map((block) => {
      if (block.id === blockId && block.table) {
        return {
          ...block,
          table: {
            ...block.table,
            hasHeaderColumn: !block.table.hasHeaderColumn,
          },
        };
      }
      return block;
    });

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
    });
  };

  // Delete block
  const deleteBlock = (blockId: string) => {
    const newBlocks = editorState.blocks.filter((b) => b.id !== blockId);
    if (newBlocks.length === 0) {
      newBlocks.push({
        id: generateId(),
        type: 'paragraph',
        content: [{ text: '', bold: false, italic: false, underline: false }],
      });
    }

    updateEditorState({
      ...editorState,
      blocks: newBlocks,
      selectedBlockId: newBlocks[0].id,
    });
  };

  // Render a content block
  const renderBlock = (block: ContentBlock) => {
    const isSelected = block.id === editorState.selectedBlockId;

    if (block.type === 'table' && block.table) {
      return (
        <View
          key={block.id}
          style={[
            styles.blockContainer,
            isSelected && { backgroundColor: colors.surface + '40' },
          ]}
        >
          <TableDisplay
            table={block.table}
            onCellChange={(row, col, text) => updateTableCell(block.id, row, col, text)}
            colors={colors}
          />
          <View style={styles.tableActions}>
            <TouchableOpacity
              onPress={() => addTableRow(block.id)}
              style={[styles.tableActionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tableActionButtonText, { color: colors.textSecondary }]}>+ Row</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => addTableColumn(block.id)}
              style={[styles.tableActionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tableActionButtonText, { color: colors.textSecondary }]}>+ Col</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleTableHeaderRow(block.id)}
              style={[
                styles.tableActionButton,
                {
                  borderColor: colors.border,
                  backgroundColor: block.table.hasHeaderRow ? colors.primary + '20' : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.tableActionButtonText,
                  { color: block.table.hasHeaderRow ? colors.primary : colors.textSecondary },
                ]}
              >
                Header Row
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleTableHeaderColumn(block.id)}
              style={[
                styles.tableActionButton,
                {
                  borderColor: colors.border,
                  backgroundColor: block.table.hasHeaderColumn ? colors.primary + '20' : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.tableActionButtonText,
                  { color: block.table.hasHeaderColumn ? colors.primary : colors.textSecondary },
                ]}
              >
                Header Col
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => deleteBlock(block.id)}
            style={styles.blockDeleteButton}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      );
    }

    let fontSize = 15;
    let fontWeight: any = '400';
    let marginTop = 12;

    if (block.type === 'heading1') {
      fontSize = 24;
      fontWeight = 'bold';
      marginTop = 20;
    } else if (block.type === 'heading2') {
      fontSize = 20;
      fontWeight = '600';
      marginTop = 16;
    }

    return (
      <View
        key={block.id}
        style={[
          styles.blockContainer,
          isSelected && { backgroundColor: colors.surface + '40' },
        ]}
      >
        <View style={styles.blockHeader}>
          {(block.type === 'bullet' || block.type === 'numbered') && (
            <Text style={[styles.listMarker, { color: colors.textSecondary }]}>
              {block.type === 'bullet' ? '•' : `${block.listIndex}.`}
            </Text>
          )}
          <TextInput
            ref={isSelected ? currentBlockRef : null}
            style={[
              styles.blockInput,
              {
                fontSize,
                fontWeight,
                marginTop,
                color: colors.text,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={block.text || ''}
            onChangeText={(text) => handleTextChange(block.id, text)}
            multiline
            editable={editable}
            onFocus={() => setEditorState((prev) => ({ ...prev, selectedBlockId: block.id }))}
          />
        </View>
        <TouchableOpacity
          onPress={() => deleteBlock(block.id)}
          style={styles.blockDeleteButton}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!editable) {
    return (
      <ScrollView style={[styles.editor, { backgroundColor: colors.card }]}>
        {editorState.blocks.map((block) => {
          if (block.type === 'table' && block.table) {
            return (
              <View key={block.id} style={styles.blockContainer}>
                <TableDisplay table={block.table} onCellChange={() => {}} colors={colors} />
              </View>
            );
          }

          let fontSize = 15;
          let fontWeight: any = '400';

          if (block.type === 'heading1') {
            fontSize = 24;
            fontWeight = 'bold';
          } else if (block.type === 'heading2') {
            fontSize = 20;
            fontWeight = '600';
          }

          return (
            <View key={block.id} style={styles.blockContainer}>
              <View style={styles.blockHeader}>
                {(block.type === 'bullet' || block.type === 'numbered') && (
                  <Text style={[styles.listMarker, { color: colors.textSecondary }]}>
                    {block.type === 'bullet' ? '•' : `${block.listIndex}.`}
                  </Text>
                )}
                <Text style={[{ fontSize, fontWeight, color: colors.text }, styles.readonlyText]}>
                  {block.text || ''}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          {/* Text Formatting */}
          <ToolbarButton icon="text" onPress={() => applyFormatting('bold')} color={colors.text} />
          <ToolbarButton icon="pencil" onPress={() => applyFormatting('italic')} color={colors.text} />
          <ToolbarButton
            icon="remove-outline"
            onPress={() => applyFormatting('underline')}
            color={colors.text}
          />

          <View style={[styles.toolbarDivider, { backgroundColor: colors.border }]} />

          {/* Headings */}
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => addBlock('heading1')}
          >
            <Text style={[{ color: colors.text, fontWeight: 'bold', fontSize: 16 }]}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => addBlock('heading2')}
          >
            <Text style={[{ color: colors.text, fontWeight: 'bold', fontSize: 14 }]}>H2</Text>
          </TouchableOpacity>

          <View style={[styles.toolbarDivider, { backgroundColor: colors.border }]} />

          {/* Lists */}
          <ToolbarButton icon="list" onPress={() => addBlock('bullet')} color={colors.text} />
          <ToolbarButton icon="list-circle" onPress={() => addBlock('numbered')} color={colors.text} />

          <View style={[styles.toolbarDivider, { backgroundColor: colors.border }]} />

          {/* Table */}
          <ToolbarButton icon="grid" onPress={() => setShowTableModal(true)} color={colors.text} />

          <View style={[styles.toolbarDivider, { backgroundColor: colors.border }]} />

          {/* Attachments */}
          <ToolbarButton
            icon="document-attach-outline"
            onPress={() => onPressAttachment?.()}
            color={colors.text}
          />
          <ToolbarButton icon="link-outline" onPress={() => onPressLink?.()} color={colors.text} />

          <View style={[styles.toolbarDivider, { backgroundColor: colors.border }]} />

          {/* Paragraph */}
          <ToolbarButton icon="document-text" onPress={() => addBlock('paragraph')} color={colors.text} />
        </ScrollView>
      </View>

      {/* Editor Content */}
      <ScrollView
        style={[styles.editor, { backgroundColor: colors.card }]}
        contentContainerStyle={styles.editorContent}
      >
        {editorState.blocks.map((block) => renderBlock(block))}
      </ScrollView>

      {/* Table Modal */}
      <TableModal
        visible={showTableModal}
        onClose={() => setShowTableModal(false)}
        onCreate={insertTable}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    maxHeight: 60,
  },
  toolbarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  toolbarButton: {
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    height: 36,
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarDivider: {
    width: 1,
    marginVertical: 8,
    marginHorizontal: 4,
  },
  editor: {
    flex: 1,
  },
  editorContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  blockContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  blockInput: {
    flex: 1,
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  listMarker: {
    marginTop: 2,
    fontWeight: '600',
    marginRight: 4,
  },
  blockDeleteButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginTop: 8,
  },
  readonlyText: {
    flex: 1,
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  // Table Styles
  tableWrapper: {
    width: '100%',
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tableScrollContent: {
    flexGrow: 1,
    minWidth: '100%',
  },
  tableContainer: {
    minWidth: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tableCellWrapper: {
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  tableCell: {
    padding: 8,
    height: 56,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  tableHeaderCell: {
    fontWeight: '700',
  },
  tableActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tableActionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tableActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Text Formatting
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableModalContent: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdvancedRichTextEditor;
