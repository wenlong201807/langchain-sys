<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { useAuthStore } from './stores/auth.store';

onLaunch(() => {
  const authStore = useAuthStore();
  authStore.initialize();
});

onShow(() => {
  console.log('[App] onShow');
});

onHide(() => {
  console.log('[App] onHide');
});
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
