<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useChatStore } from '../../stores/chat.store';
import MessageBubble from '../../components/chat/MessageBubble.vue';
import ChatInput from '../../components/chat/ChatInput.vue';

const chatStore = useChatStore();
const scrollId = ref('');
const conversationId = ref('');

const messages = computed(() => chatStore.messages);
const isStreaming = computed(() => chatStore.isStreaming);

onLoad((query) => {
  const id = (query as Record<string, string>)?.id;
  if (id) {
    conversationId.value = id;
    chatStore.loadMessages(id);
  }
});

function scrollToBottom(): void {
  nextTick(() => {
    scrollId.value = `msg-${messages.value.length - 1}`;
  });
}

function handleSend(content: string): void {
  if (!content.trim() || isStreaming.value) return;

  chatStore.sendMessage({
    conversationId: conversationId.value,
    content: content.trim(),
  });
  scrollToBottom();
}

function handleStop(): void {
  chatStore.stopStreaming();
}
</script>

<template>
  <view class="chat-page">
    <scroll-view
      scroll-y
      class="message-list"
      :scroll-into-view="scrollId"
      scroll-with-animation
    >
      <view class="message-list-inner">
        <view
          v-for="(msg, index) in messages"
          :key="msg.id"
          :id="`msg-${index}`"
          class="message-wrapper"
        >
          <MessageBubble :message="msg" />
        </view>
        <view v-if="messages.length === 0" class="empty-chat">
          <text class="empty-chat-icon">💡</text>
          <text class="empty-chat-text">有什么我可以帮你的吗？</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-area safe-area-bottom">
      <ChatInput
        :disabled="isStreaming"
        @send="handleSend"
        @stop="handleStop"
        :is-streaming="isStreaming"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.message-list {
  flex: 1;
  padding: 16rpx;
}

.message-list-inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.message-wrapper {
  margin-bottom: 24rpx;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-chat-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-chat-text {
  font-size: 28rpx;
  color: #999999;
}

.input-area {
  background-color: #ffffff;
  border-top: 1rpx solid #eeeeee;
}
</style>
