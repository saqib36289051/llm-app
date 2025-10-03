import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LLAMA3_2_1B_QLORA, Message, useLLM } from "react-native-executorch";
import { SafeAreaView } from "react-native-safe-area-context";

const SYSTEM_PROMPT = `You are a Computer Science (CS) assistant. You must strictly stay within the domain of Computer Science, programming, software engineering, algorithms, data structures, operating systems, databases, networking, artificial intelligence, and related technical fields.
❌ Do not answer or engage in questions outside Computer Science (e.g., politics, religion, personal advice, gossip, etc.). 
Instead, politely refuse with a short message like: "I'm only able to answer Computer Science related questions."
✅ For CS-related questions that involve code, always provide code snippets in properly formatted blocks using markdown, for example:
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\``;

const Chat = () => {
  const llm = useLLM({
    model: LLAMA3_2_1B_QLORA,
  });

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "assistant",
      content: "Hello! I'm your CS assistant. How can I help you today?",
    },
  ]);
  const previousIsGenerating = useRef(llm.isGenerating);
  const completedResponse = useRef("");

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  // Handle when generation completes - optimized to only check isGenerating changes
  useEffect(() => {
    try {
      if (previousIsGenerating.current && !llm.isGenerating) {
        // Generation just finished, add the response to messages
        if (llm.response && llm.response !== completedResponse.current) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant" as const,
              content: llm.response,
            },
          ]);
          completedResponse.current = llm.response;
        }
      }
      previousIsGenerating.current = llm.isGenerating;
    } catch (error) {
      console.error("Error handling generation completion:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.isGenerating]);

  // Memoize display messages to prevent recalculation on every render
  const displayMessages = useMemo(() => {
    const filtered = messages.filter((msg) => msg.role !== "system");
    if (llm.response && llm.isGenerating) {
      // Show streaming response while generating
      return [...filtered, {
        role: "assistant" as const,
        content: llm.response,
      }];
    }
    return filtered;
  }, [messages, llm.response, llm.isGenerating]);

  const renderCodeBlock = (code: string, language: string) => {
    return (
      <View style={[styles.codeBlock, { backgroundColor: "#1e1e1e" }]}>
        <View style={styles.codeHeader}>
          <ThemedText style={styles.codeLanguage}>{language}</ThemedText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ThemedText
            style={[styles.codeText, { fontFamily: "monospace" }]}
            lightColor="#d4d4d4"
            darkColor="#d4d4d4"
          >
            {code}
          </ThemedText>
        </ScrollView>
      </View>
    );
  };

  const renderMessageContent = (content: string, isUser: boolean = false) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.substring(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: "code",
        language: match[1] || "code",
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex),
      });
    }

    if (parts.length === 0) {
      parts.push({ type: "text", content });
    }

    return parts.map((part, index) => {
      if (part.type === "code") {
        return (
          <View key={index}>
            {renderCodeBlock(part.content, part.language || "code")}
          </View>
        );
      }
      return (
        <ThemedText 
          key={index} 
          style={styles.messageText}
          lightColor={isUser ? "#fff" : undefined}
          darkColor={isUser ? "#fff" : undefined}
        >
          {part.content}
        </ThemedText>
      );
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!item || !item.content) return null;
    
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageContainer,
          isUser
            ? styles.userMessageContainer
            : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: "#2a2a2a" }]
              : [
                  styles.assistantBubble,
                  {
                    backgroundColor: backgroundColor === "#fff" ? "#f0f0f0" : "#2a2a2a",
                  },
                ],
          ]}
        >
          {!isUser && (
            <View style={styles.assistantHeader}>
              <Ionicons
                name="sparkles"
                size={16}
                color={tintColor}
                style={styles.assistantIcon}
              />
              <ThemedText style={styles.assistantLabel}>Assistant</ThemedText>
            </View>
          )}
          {renderMessageContent(item.content, isUser)}
        </View>
      </View>
    );
  };

  const handleSendMessage = () => {
    try {
      if (!inputText.trim() || llm.isGenerating || !llm.isReady) return;

      const userMessage: Message = {
        role: "user",
        content: inputText.trim(),
      };

      // Add user message to chat
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Clear input
      setInputText("");

      // Generate response with all conversation history
      llm.generate(updatedMessages);
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally show error to user
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Loading Modal */}
      <Modal
        visible={!llm.isReady}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: backgroundColor === "#fff" ? "#fff" : "#1e1e1e" }
          ]}>
            {llm.error ? (
              <>
                <Ionicons name="alert-circle" size={40} color="#ff3b30" />
                <View style={styles.modalTextContainer}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Error Loading Model
                  </ThemedText>
                  <ThemedText style={styles.modalProgress}>
                    Please restart the app
                  </ThemedText>
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={tintColor} />
                <View style={styles.modalTextContainer}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Loading Model
                  </ThemedText>
                  <ThemedText style={styles.modalProgress}>
                    {Math.round(llm.downloadProgress * 100)}%
                  </ThemedText>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <ThemedView style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="chatbubbles" size={24} color={tintColor} />
            <ThemedText type="subtitle" style={styles.headerTitle}>
              CS Assistant
            </ThemedText>
          </View>
        </ThemedView>

        {/* Messages List */}
        <FlatList
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          inverted={false}
        />

        {/* Input Area */}
        <ThemedView
          style={[
            styles.inputContainer,
            { borderTopColor: backgroundColor === "#fff" ? "#e0e0e0" : "#333" },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                {
                  color: textColor,
                  backgroundColor:
                    backgroundColor === "#fff" ? "#f5f5f5" : "#2a2a2a",
                },
              ]}
              placeholder={
                llm.isGenerating
                  ? "Generating response..."
                  : "Ask me anything about CS..."
              }
              placeholderTextColor={
                backgroundColor === "#fff" ? "#999" : "#666"
              }
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!llm.isGenerating && llm.isReady}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: tintColor,
                  opacity:
                    !inputText.trim() || llm.isGenerating || !llm.isReady
                      ? 0.5
                      : 1,
                },
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || llm.isGenerating || !llm.isReady}
            >
              {llm.isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    height: 120,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  modalProgress: {
    fontSize: 16,
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
  },
  downloadingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffa50033",
  },
  downloadingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  messagesList: {
    padding: 16,
    gap: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  userMessageContainer: {
    justifyContent: "flex-end",
  },
  assistantMessageContainer: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "90%",
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  assistantIcon: {
    marginRight: 2,
  },
  assistantLabel: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  codeBlock: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  codeLanguage: {
    fontSize: 12,
    fontWeight: "600",
    color: "#61dafb",
  },
  codeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Chat;
