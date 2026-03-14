<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{
  text: string;
}>();

const displayText = ref('');
const showCursor = ref(true);
let cursorTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => props.text,
  (newText) => {
    displayText.value = newText;
  },
  { immediate: true },
);

cursorTimer = setInterval(() => {
  showCursor.value = !showCursor.value;
}, 500);

onUnmounted(() => {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
});
</script>

<template>
  <view class="streaming-text">
    <text class="content-text">{{ displayText }}</text>
    <text v-if="showCursor" class="cursor">▎</text>
  </view>
</template>

<style lang="scss" scoped>
.streaming-text {
  display: inline;
}

.content-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: #333333;
}

.cursor {
  font-size: 28rpx;
  color: #4f46e5;
  animation: none;
}
</style>
