<script setup lang="ts">
import { computed } from 'vue';
import StreamingText from './StreamingText.vue';
import type { Message } from '../../types';

const props = defineProps<{
  message: Message;
}>();

const isUser = computed(() => props.message.role === 'user');
const isStreaming = computed(() => props.message.isStreaming === true);
</script>

<template>
  <view class="bubble-row" :class="{ 'bubble-row-user': isUser }">
    <view class="avatar" :class="isUser ? 'avatar-user' : 'avatar-assistant'">
      <text class="avatar-text">{{ isUser ? 'U' : 'AI' }}</text>
    </view>
    <view class="bubble" :class="isUser ? 'bubble-user' : 'bubble-assistant'">
      <StreamingText
        v-if="!isUser && isStreaming"
        :text="message.content"
      />
      <text v-else class="bubble-text">{{ message.content }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.bubble-row-user {
  flex-direction: row-reverse;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-user {
  background-color: #4f46e5;
}

.avatar-assistant {
  background-color: #10b981;
}

.avatar-text {
  font-size: 22rpx;
  color: #ffffff;
  font-weight: 600;
}

.bubble {
  max-width: 75%;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  word-break: break-all;
}

.bubble-user {
  background-color: #4f46e5;
  border-top-right-radius: 4rpx;
}

.bubble-user .bubble-text {
  color: #ffffff;
}

.bubble-assistant {
  background-color: #ffffff;
  border-top-left-radius: 4rpx;
}

.bubble-assistant .bubble-text {
  color: #333333;
}

.bubble-text {
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
