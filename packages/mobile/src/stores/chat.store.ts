import { defineStore } from 'pinia';
import { ref } from 'vue';
import { get, post, del } from '../api/request';
import { createSSEConnection } from '../utils/sse';
import type {
  Conversation,
  Message,
  SendMessageParams,
  PageResult,
  SSEEvent,
} from '../types';

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([]);
  const currentConversation = ref<Conversation | null>(null);
  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);
  const loading = ref(false);

  let sseConnection: { abort: () => void } | null = null;

  async function loadConversations(page = 1, pageSize = 20): Promise<void> {
    loading.value = true;
    try {
      const result = await get<PageResult<Conversation>>('/conversations', {
        page,
        pageSize,
      } as unknown as Record<string, unknown>);
      if (page === 1) {
        conversations.value = result.items;
      } else {
        conversations.value.push(...result.items);
      }
    } finally {
      loading.value = false;
    }
  }

  async function createConversation(title?: string): Promise<Conversation> {
    const conversation = await post<Conversation>('/conversations', {
      title: title ?? '新对话',
    });
    conversations.value.unshift(conversation);
    currentConversation.value = conversation;
    messages.value = [];
    return conversation;
  }

  async function deleteConversation(id: string): Promise<void> {
    await del(`/conversations/${id}`);
    conversations.value = conversations.value.filter((c) => c.id !== id);
    if (currentConversation.value?.id === id) {
      currentConversation.value = null;
      messages.value = [];
    }
  }

  async function loadMessages(
    conversationId: string,
    page = 1,
    pageSize = 50,
  ): Promise<void> {
    loading.value = true;
    try {
      const result = await get<PageResult<Message>>(
        `/conversations/${conversationId}/messages`,
        { page, pageSize } as unknown as Record<string, unknown>,
      );
      if (page === 1) {
        messages.value = result.items;
      } else {
        messages.value = [...result.items, ...messages.value];
      }
    } finally {
      loading.value = false;
    }
  }

  async function selectConversation(conversation: Conversation): Promise<void> {
    currentConversation.value = conversation;
    await loadMessages(conversation.id);
  }

  function sendMessage(params: SendMessageParams): void {
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: params.conversationId,
      role: 'user',
      content: params.content,
      createdAt: new Date().toISOString(),
    };
    messages.value.push(userMessage);

    const assistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      conversationId: params.conversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };
    messages.value.push(assistantMessage);
    isStreaming.value = true;

    sseConnection = createSSEConnection({
      url: `/conversations/${params.conversationId}/chat`,
      body: {
        content: params.content,
        ...(params.knowledgeBaseIds?.length
          ? { knowledgeBaseIds: params.knowledgeBaseIds }
          : {}),
      },
      onMessage(event: SSEEvent) {
        if (event.event === 'done' || event.data === '[DONE]') {
          assistantMessage.isStreaming = false;
          isStreaming.value = false;
          return;
        }

        try {
          const payload = JSON.parse(event.data) as {
            id?: string;
            content?: string;
            userMessageId?: string;
          };

          if (payload.userMessageId) {
            userMessage.id = payload.userMessageId;
          }
          if (payload.id) {
            assistantMessage.id = payload.id;
          }
          if (payload.content) {
            assistantMessage.content += payload.content;
          }
        } catch {
          assistantMessage.content += event.data;
        }
      },
      onError() {
        assistantMessage.isStreaming = false;
        isStreaming.value = false;
        uni.showToast({ title: '发送失败，请重试', icon: 'none' });
      },
      onComplete() {
        assistantMessage.isStreaming = false;
        isStreaming.value = false;
      },
    });
  }

  function stopStreaming(): void {
    sseConnection?.abort();
    sseConnection = null;
    isStreaming.value = false;

    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg?.isStreaming) {
      lastMsg.isStreaming = false;
    }
  }

  function $reset(): void {
    stopStreaming();
    conversations.value = [];
    currentConversation.value = null;
    messages.value = [];
    loading.value = false;
  }

  return {
    conversations,
    currentConversation,
    messages,
    isStreaming,
    loading,
    loadConversations,
    createConversation,
    deleteConversation,
    loadMessages,
    selectConversation,
    sendMessage,
    stopStreaming,
    $reset,
  };
});
