<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { useChatStore } from '../../stores/chat.store';
import { useAuthStore } from '../../stores/auth.store';
import type { Conversation } from '../../types';

const chatStore = useChatStore();
const authStore = useAuthStore();

onShow(() => {
  if (authStore.isLoggedIn) {
    chatStore.loadConversations();
  }
});

function handleNewChat(): void {
  chatStore.createConversation().then((conv) => {
    uni.navigateTo({ url: `/pages/chat/index?id=${conv.id}` });
  });
}

function handleSelectConversation(conversation: Conversation): void {
  chatStore.selectConversation(conversation);
  uni.navigateTo({ url: `/pages/chat/index?id=${conversation.id}` });
}

function handleDeleteConversation(id: string): void {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除吗？',
    success: (res) => {
      if (res.confirm) {
        chatStore.deleteConversation(id);
      }
    },
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
</script>

<template>
  <view class="page-container">
    <view class="header">
      <text class="header-title">对话</text>
      <view class="btn-new" @tap="handleNewChat">
        <text class="btn-new-text">+ 新对话</text>
      </view>
    </view>

    <view v-if="!authStore.isLoggedIn" class="empty-state">
      <text class="empty-icon">💬</text>
      <text class="empty-text">请先登录后开始对话</text>
      <view class="btn-login" @tap="uni.switchTab({ url: '/pages/mine/index' })">
        <text class="btn-login-text">去登录</text>
      </view>
    </view>

    <view v-else-if="chatStore.conversations.length === 0" class="empty-state">
      <text class="empty-icon">🤖</text>
      <text class="empty-text">还没有对话，点击上方开始吧</text>
    </view>

    <scroll-view v-else scroll-y class="conversation-list">
      <view
        v-for="conv in chatStore.conversations"
        :key="conv.id"
        class="conversation-item"
        @tap="handleSelectConversation(conv)"
        @longpress="handleDeleteConversation(conv.id)"
      >
        <view class="conversation-info">
          <text class="conversation-title text-ellipsis">{{ conv.title }}</text>
          <text class="conversation-preview text-ellipsis">{{ conv.lastMessage || '暂无消息' }}</text>
        </view>
        <view class="conversation-meta">
          <text class="conversation-time">{{ formatTime(conv.updatedAt) }}</text>
          <text class="conversation-count">{{ conv.messageCount }}条</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f8f8;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background-color: #ffffff;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.btn-new {
  padding: 12rpx 24rpx;
  background-color: #4f46e5;
  border-radius: 16rpx;
}

.btn-new-text {
  font-size: 26rpx;
  color: #ffffff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 64rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
  margin-bottom: 32rpx;
}

.btn-login {
  padding: 16rpx 48rpx;
  background-color: #4f46e5;
  border-radius: 20rpx;
}

.btn-login-text {
  font-size: 28rpx;
  color: #ffffff;
}

.conversation-list {
  flex: 1;
  padding: 16rpx;
}

.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  margin-bottom: 12rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #1a1a1a;
  display: block;
  margin-bottom: 8rpx;
}

.conversation-preview {
  font-size: 24rpx;
  color: #999999;
  display: block;
}

.conversation-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.conversation-time {
  font-size: 22rpx;
  color: #cccccc;
  margin-bottom: 8rpx;
}

.conversation-count {
  font-size: 20rpx;
  color: #bbbbbb;
}
</style>
