<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { get } from '../../api/request';
import { useAuthStore } from '../../stores/auth.store';
import type { KnowledgeBase, PageResult } from '../../types';

const authStore = useAuthStore();
const knowledgeBases = ref<KnowledgeBase[]>([]);
const loading = ref(false);

onShow(() => {
  if (authStore.isLoggedIn) {
    loadKnowledgeBases();
  }
});

async function loadKnowledgeBases(): Promise<void> {
  loading.value = true;
  try {
    const result = await get<PageResult<KnowledgeBase>>('/knowledge-bases', {
      page: 1,
      pageSize: 50,
    } as unknown as Record<string, unknown>);
    knowledgeBases.value = result.items;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function handleViewDetail(kb: KnowledgeBase): void {
  uni.showToast({ title: `查看: ${kb.name}`, icon: 'none' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <view class="page-container">
    <view class="header">
      <text class="header-title">知识库</text>
    </view>

    <view v-if="!authStore.isLoggedIn" class="empty-state">
      <text class="empty-icon">📚</text>
      <text class="empty-text">请先登录查看知识库</text>
    </view>

    <view v-else-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="knowledgeBases.length === 0" class="empty-state">
      <text class="empty-icon">📂</text>
      <text class="empty-text">暂无知识库</text>
    </view>

    <scroll-view v-else scroll-y class="kb-list">
      <view
        v-for="kb in knowledgeBases"
        :key="kb.id"
        class="kb-card"
        @tap="handleViewDetail(kb)"
      >
        <view class="kb-header">
          <text class="kb-name text-ellipsis">{{ kb.name }}</text>
          <text class="kb-doc-count">{{ kb.documentCount }} 文档</text>
        </view>
        <text class="kb-description text-ellipsis">{{ kb.description || '暂无描述' }}</text>
        <view class="kb-footer">
          <text class="kb-date">创建于 {{ formatDate(kb.createdAt) }}</text>
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
  padding: 24rpx 32rpx;
  background-color: #ffffff;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.empty-state,
.loading-state {
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

.empty-text,
.loading-text {
  font-size: 28rpx;
  color: #999999;
}

.kb-list {
  flex: 1;
  padding: 16rpx;
}

.kb-card {
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
}

.kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.kb-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #1a1a1a;
  flex: 1;
  min-width: 0;
}

.kb-doc-count {
  font-size: 22rpx;
  color: #4f46e5;
  background-color: #eef2ff;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.kb-description {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 16rpx;
}

.kb-footer {
  display: flex;
  align-items: center;
}

.kb-date {
  font-size: 22rpx;
  color: #bbbbbb;
}
</style>
