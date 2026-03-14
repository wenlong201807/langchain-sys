<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  disabled?: boolean;
  isStreaming?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
  stop: [];
}>();

const inputValue = ref('');

function handleSend(): void {
  const content = inputValue.value.trim();
  if (!content) return;
  emit('send', content);
  inputValue.value = '';
}

function handleStop(): void {
  emit('stop');
}

function handleConfirm(): void {
  handleSend();
}
</script>

<template>
  <view class="chat-input-wrapper">
    <view class="input-row">
      <input
        v-model="inputValue"
        class="text-input"
        :placeholder="disabled ? 'AI 正在回复中...' : '输入你的问题...'"
        :disabled="disabled"
        confirm-type="send"
        @confirm="handleConfirm"
      />
      <view
        v-if="isStreaming"
        class="btn-stop"
        @tap="handleStop"
      >
        <text class="btn-stop-text">■</text>
      </view>
      <view
        v-else
        class="btn-send"
        :class="{ 'btn-send-disabled': !inputValue.trim() || disabled }"
        @tap="handleSend"
      >
        <text class="btn-send-text">↑</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-input-wrapper {
  padding: 16rpx 24rpx;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.text-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  background-color: #f5f5f5;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: #333333;
}

.btn-send {
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background-color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-send-text {
  font-size: 36rpx;
  color: #ffffff;
  font-weight: 700;
}

.btn-send-disabled {
  opacity: 0.4;
}

.btn-stop {
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background-color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-stop-text {
  font-size: 28rpx;
  color: #ffffff;
}
</style>
