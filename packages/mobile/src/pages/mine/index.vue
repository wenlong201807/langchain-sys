<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useChatStore } from '../../stores/chat.store';

const authStore = useAuthStore();
const chatStore = useChatStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);
const user = computed(() => authStore.user);

const username = ref('');
const password = ref('');
const loginLoading = ref(false);

async function handleLogin(): Promise<void> {
  if (!username.value.trim() || !password.value.trim()) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }

  loginLoading.value = true;
  try {
    await authStore.login({
      username: username.value.trim(),
      password: password.value,
    });
    uni.showToast({ title: '登录成功', icon: 'success' });
    username.value = '';
    password.value = '';
  } catch {
    uni.showToast({ title: '登录失败，请重试', icon: 'none' });
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout(): void {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        authStore.logout();
        chatStore.$reset();
        uni.showToast({ title: '已退出登录', icon: 'none' });
      }
    },
  });
}

function handleAbout(): void {
  uni.showModal({
    title: 'ThinkAgent',
    content: 'v0.1.0\nAI 智能助手',
    showCancel: false,
  });
}
</script>

<template>
  <view class="page-container">
    <!-- Logged-in state -->
    <view v-if="isLoggedIn" class="profile-section">
      <view class="avatar-wrapper">
        <image
          v-if="user?.avatar"
          :src="user.avatar"
          class="avatar-image"
          mode="aspectFill"
        />
        <view v-else class="avatar-placeholder">
          <text class="avatar-letter">{{ user?.nickname?.charAt(0) || 'U' }}</text>
        </view>
      </view>
      <text class="nickname">{{ user?.nickname || '用户' }}</text>
      <text class="user-email">{{ user?.email || '' }}</text>
    </view>

    <!-- Login form -->
    <view v-else class="login-section">
      <text class="login-title">登录 ThinkAgent</text>
      <input
        v-model="username"
        class="login-input"
        placeholder="请输入账号"
        type="text"
      />
      <input
        v-model="password"
        class="login-input"
        placeholder="请输入密码"
        type="safe-password"
      />
      <view
        class="btn-primary"
        :class="{ 'btn-disabled': loginLoading }"
        @tap="handleLogin"
      >
        <text class="btn-primary-text">{{ loginLoading ? '登录中...' : '登录' }}</text>
      </view>
    </view>

    <!-- Menu items -->
    <view v-if="isLoggedIn" class="menu-section">
      <view class="menu-item" @tap="handleAbout">
        <text class="menu-label">关于</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item menu-item-danger" @tap="handleLogout">
        <text class="menu-label-danger">退出登录</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: #f8f8f8;
}

.profile-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 32rpx 40rpx;
  background-color: #ffffff;
}

.avatar-wrapper {
  width: 128rpx;
  height: 128rpx;
  margin-bottom: 20rpx;
}

.avatar-image {
  width: 128rpx;
  height: 128rpx;
  border-radius: 64rpx;
}

.avatar-placeholder {
  width: 128rpx;
  height: 128rpx;
  border-radius: 64rpx;
  background-color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-letter {
  font-size: 48rpx;
  color: #ffffff;
  font-weight: 600;
}

.nickname {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8rpx;
}

.user-email {
  font-size: 24rpx;
  color: #999999;
}

.login-section {
  padding: 80rpx 48rpx 40rpx;
  background-color: #ffffff;
}

.login-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1a1a1a;
  display: block;
  text-align: center;
  margin-bottom: 60rpx;
}

.login-input {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid #e5e5e5;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #333333;
  background-color: #fafafa;
}

.btn-primary {
  width: 100%;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #4f46e5;
  border-radius: 16rpx;
  margin-top: 16rpx;
}

.btn-primary-text {
  font-size: 30rpx;
  color: #ffffff;
  font-weight: 500;
}

.btn-disabled {
  opacity: 0.6;
}

.menu-section {
  margin-top: 24rpx;
  background-color: #ffffff;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.menu-label {
  font-size: 28rpx;
  color: #333333;
}

.menu-arrow {
  font-size: 32rpx;
  color: #cccccc;
}

.menu-item-danger {
  border-bottom: none;
  justify-content: center;
}

.menu-label-danger {
  font-size: 28rpx;
  color: #ef4444;
}
</style>
