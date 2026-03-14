# ThinkAgent 后台管理系统项目方案 (packages/admin)

## 一、项目概述

- **React 18** SPA (Single Page Application)
- **Vite 5** 构建工具
- **React Router v6** 路由管理
- **Ant Design 5** UI 组件库
- **Zustand** 状态管理
- **TanStack Query + Axios** 数据请求
- **ECharts** Dashboard 图表
- **RBAC** 全链路权限控制
- **三环境**：test、staging、prod

---

## 二、项目目录结构

```
packages/admin/
├── src/
│   ├── main.tsx                    # 入口
│   ├── App.tsx                     # 根组件（含 RouterProvider）
│   ├── router/
│   │   ├── index.tsx               # 路由主入口
│   │   ├── auth-route.tsx          # 权限路由守卫
│   │   └── route-config.ts         # 路由配置
│   ├── pages/
│   │   ├── login/                  # 登录页
│   │   ├── dashboard/              # 仪表盘
│   │   ├── users/                  # 用户管理
│   │   ├── content/                # 内容审核
│   │   ├── knowledge/              # 知识库管理
│   │   ├── subscription/           # 订阅管理
│   │   └── system/                 # 系统配置
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── auth/
│   │   │   ├── AuthButton.tsx
│   │   │   └── AuthWrapper.tsx
│   │   └── common/
│   ├── hooks/
│   │   ├── usePermission.ts
│   │   └── useAdmin.ts
│   ├── stores/
│   │   ├── auth.store.ts
│   │   └── permission.store.ts
│   ├── api/
│   │   ├── request.ts              # Axios 实例与拦截器
│   │   ├── admin-auth.api.ts
│   │   ├── user-mgmt.api.ts
│   │   ├── role.api.ts
│   │   ├── stats.api.ts
│   │   └── ...
│   ├── types/
│   ├── utils/
│   └── config/
│       └── index.ts                # 环境配置
├── .env.test
├── .env.staging
├── .env.production
├── vite.config.ts
└── package.json
```

---

## 三、配置管理

### 3.1 环境变量文件

**`.env.test`**
```env
VITE_API_BASE_URL=https://api-test.thinkagent.ai
VITE_APP_TITLE=ThinkAgent Admin (Test)
```

**`.env.staging`**
```env
VITE_API_BASE_URL=https://api-staging.thinkagent.ai
VITE_APP_TITLE=ThinkAgent Admin (Staging)
```

**`.env.production`**
```env
VITE_API_BASE_URL=https://api.thinkagent.ai
VITE_APP_TITLE=ThinkAgent Admin
```

### 3.2 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'https://api-test.thinkagent.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### 3.3 src/config/index.ts

```typescript
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  appTitle: import.meta.env.VITE_APP_TITLE || 'ThinkAgent Admin',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
};
```

---

## 四、多环境启动

```json
{
  "scripts": {
    "dev": "vite --mode development",
    "build:test": "vite build --mode test",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production",
    "preview": "vite preview"
  }
}
```

---

## 五、RBAC 权限控制方案（核心）

### 5.1 权限数据流

```
Login → API 返回 permissions[] + menus[] → 存入 Zustand → 生成动态路由 → 渲染菜单
```

### 5.2 Permission Store（权限存储）

```typescript
// src/stores/permission.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MenuItem {
  key: string;
  path: string;
  title: string;
  icon?: string;
  children?: MenuItem[];
}

interface PermissionState {
  permissions: string[];
  menus: MenuItem[];
  setPermissions: (permissions: string[]) => void;
  setMenus: (menus: MenuItem[]) => void;
  clear: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set) => ({
      permissions: [],
      menus: [],
      setPermissions: (permissions) => set({ permissions }),
      setMenus: (menus) => set({ menus }),
      clear: () => set({ permissions: [], menus: [] }),
    }),
    { name: 'admin-permission' }
  )
);
```

### 5.3 Auth Store（认证存储）

```typescript
// src/stores/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  setAuth: (token: string, refreshToken: string, user: AdminUser) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user }),
      setToken: (token) => set({ token }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
        }),
    }),
    { name: 'admin-auth' }
  )
);
```

### 5.4 usePermission Hook

```typescript
// src/hooks/usePermission.ts
import { usePermissionStore } from '@/stores/permission.store';

export function usePermission() {
  const { permissions } = usePermissionStore();

  const hasPermission = (code: string): boolean => {
    if (!code) return true;
    return permissions.includes(code);
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    if (!codes?.length) return true;
    return codes.some((code) => permissions.includes(code));
  };

  const hasAllPermissions = (codes: string[]): boolean => {
    if (!codes?.length) return true;
    return codes.every((code) => permissions.includes(code));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
```

### 5.5 Route-level Permission（路由级权限）

```typescript
// src/router/auth-route.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissionStore } from '@/stores/permission.store';

interface AuthRouteProps {
  children: React.ReactNode;
  permission?: string;
}

export function AuthRoute({ children, permission }: AuthRouteProps) {
  const location = useLocation();
  const { token } = useAuthStore();
  const { permissions } = usePermissionStore();

  // 未登录 → 跳转登录
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 需要权限但无权限 → 403
  if (permission && !permissions.includes(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
```

### 5.6 动态路由生成

```typescript
// src/router/route-config.ts
import type { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

export interface RouteConfig extends RouteObject {
  permission?: string;
  children?: RouteConfig[];
}

export const routeConfig: RouteConfig[] = [
  {
    path: '/login',
    element: lazy(() => import('@/pages/login')),
  },
  {
    path: '/403',
    element: lazy(() => import('@/pages/403')),
  },
  {
    path: '/',
    element: lazy(() => import('@/components/layout/AdminLayout')),
    children: [
      {
        path: 'dashboard',
        permission: 'dashboard:view',
        element: lazy(() => import('@/pages/dashboard')),
      },
      {
        path: 'users',
        permission: 'user:view',
        element: lazy(() => import('@/pages/users')),
      },
      {
        path: 'roles',
        permission: 'role:view',
        element: lazy(() => import('@/pages/system/RoleManagement')),
      },
      {
        path: 'content',
        permission: 'content:moderate',
        element: lazy(() => import('@/pages/content')),
      },
      {
        path: 'system/config',
        permission: 'system:config',
        element: lazy(() => import('@/pages/system/Config')),
      },
      {
        path: 'audit',
        permission: 'audit:view',
        element: lazy(() => import('@/pages/system/AuditLogs')),
      },
    ],
  },
];

// 根据权限过滤路由
export function filterRoutesByPermission(
  routes: RouteConfig[],
  permissions: string[]
): RouteConfig[] {
  return routes
    .filter((route) => {
      if (!route.permission) return true;
      return permissions.includes(route.permission);
    })
    .map((route) => ({
      ...route,
      children: route.children
        ? filterRoutesByPermission(route.children, permissions)
        : undefined,
    }))
    .filter((route) => !route.children || route.children.length > 0);
}
```

### 5.7 路由主入口

```typescript
// src/router/index.tsx
import { useMemo } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { Spin } from 'antd';
import { AuthRoute } from './auth-route';
import { routeConfig, filterRoutesByPermission } from './route-config';
import { usePermissionStore } from '@/stores/permission.store';

function wrapWithAuth(routes: typeof routeConfig, permissions: string[]) {
  const filtered = filterRoutesByPermission(routes, permissions);

  return filtered.map((route) => ({
    ...route,
    element: route.path === '/login' ? (
      route.element
    ) : route.children ? (
      <AuthRoute>{route.element}</AuthRoute>
    ) : (
      <AuthRoute permission={route.permission}>{route.element}</AuthRoute>
    ),
    children: route.children?.map((child) => ({
      ...child,
      element: (
        <Suspense fallback={<Spin size="large" />}>
          <AuthRoute permission={child.permission}>{child.element}</AuthRoute>
        </Suspense>
      ),
    })),
  }));
}

export function Router() {
  const { permissions } = usePermissionStore();
  const routes = useMemo(
    () => wrapWithAuth(routeConfig, permissions),
    [permissions]
  );

  const router = createBrowserRouter([
    ...routes,
    { path: '*', element: <Navigate to="/dashboard" replace /> },
  ]);

  return router;
}
```

### 5.8 Menu-level Permission（菜单级权限）

```typescript
// src/components/layout/Sidebar.tsx
import { useMemo } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissionStore } from '@/stores/permission.store';
import { routeConfig, filterRoutesByPermission } from '@/router/route-config';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = usePermissionStore();

  const menuItems = useMemo(() => {
    const filtered = filterRoutesByPermission(routeConfig, permissions);
    const root = filtered.find((r) => r.path === '/');
    if (!root?.children) return [];

    return root.children.map((child) => ({
      key: child.path!,
      label: getMenuLabel(child.path!),
      icon: getMenuIcon(child.path!),
      onClick: () => navigate(`/${child.path}`),
    }));
  }, [permissions, navigate]);

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname.slice(1) || 'dashboard']}
      items={menuItems}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
}

function getMenuLabel(path: string): string {
  const labels: Record<string, string> = {
    dashboard: '仪表盘',
    users: '用户管理',
    roles: '角色权限',
    content: '内容审核',
    'system/config': '系统配置',
    audit: '审计日志',
  };
  return labels[path] || path;
}

function getMenuIcon(path: string) {
  // 返回对应 Ant Design Icon 组件
  return null;
}
```

### 5.9 Button-level Permission（按钮级权限）

```typescript
// src/components/auth/AuthButton.tsx
import { usePermission } from '@/hooks/usePermission';

interface AuthButtonProps {
  permission: string | string[];
  mode?: 'single' | 'any'; // single: 需全部; any: 任一即可
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthButton({
  permission,
  mode = 'single',
  children,
  fallback = null,
}: AuthButtonProps) {
  const { hasPermission, hasAnyPermission } = usePermission();

  const codes = Array.isArray(permission) ? permission : [permission];
  const hasAuth =
    mode === 'any' ? hasAnyPermission(codes) : codes.every(hasPermission);

  if (!hasAuth) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

### 5.10 AuthWrapper（区域级权限包裹）

```typescript
// src/components/auth/AuthWrapper.tsx
import { usePermission } from '@/hooks/usePermission';

interface AuthWrapperProps {
  permission: string | string[];
  mode?: 'single' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthWrapper({
  permission,
  mode = 'single',
  children,
  fallback = null,
}: AuthWrapperProps) {
  const { hasPermission, hasAnyPermission } = usePermission();

  const codes = Array.isArray(permission) ? permission : [permission];
  const hasAuth =
    mode === 'any' ? hasAnyPermission(codes) : codes.every(hasPermission);

  return hasAuth ? <>{children}</> : <>{fallback}</>;
}
```

### 5.11 登录后写入权限

```typescript
// 登录 API 返回示例
interface LoginResponse {
  token: string;
  refreshToken: string;
  user: { id: string; username: string; nickname: string };
  permissions: string[];  // ['dashboard:view', 'user:view', 'user:edit', ...]
  menus: MenuItem[];      // 动态菜单配置
}

// 登录成功后
const { setAuth } = useAuthStore.getState();
const { setPermissions, setMenus } = usePermissionStore.getState();
setAuth(data.token, data.refreshToken, data.user);
setPermissions(data.permissions);
setMenus(data.menus);
```

---

## 六、核心页面设计

### 6.1 Dashboard

- **核心指标卡片**：总用户数、DAU、消息量、收入
- **ECharts 趋势图**：用户增长、消息量趋势
- **实时刷新**：30s 轮询

```typescript
// src/pages/dashboard/index.tsx 核心结构
import { Card, Row, Col, Statistic } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats.api';

export function Dashboard() {
  const { data, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getOverview,
    refetchInterval: 30000,
  });

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="总用户" value={data?.totalUsers} /></Card></Col>
        <Col span={6}><Card><Statistic title="DAU" value={data?.dau} /></Card></Col>
        <Col span={6}><Card><Statistic title="消息量" value={data?.messageCount} /></Card></Col>
        <Col span={6}><Card><Statistic title="收入" value={data?.revenue} prefix="¥" /></Card></Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}><ReactECharts option={userGrowthOption} /></Col>
        <Col span={12}><ReactECharts option={messageVolumeOption} /></Col>
      </Row>
    </div>
  );
}
```

### 6.2 User Management

- 用户列表：搜索、筛选、分页
- 用户详情 Drawer：基本信息 + 使用统计 + 对话记录
- 操作按钮由 AuthButton 控制

```typescript
// 示例：用户列表操作列
<AuthButton permission="user:edit">
  <Button onClick={() => openEdit(user)}>编辑</Button>
</AuthButton>
<AuthButton permission="user:ban">
  <Button danger onClick={() => handleBan(user)}>封禁</Button>
</AuthButton>
```

### 6.3 Role & Permission Management

- 角色列表 + 新建/编辑弹窗
- 权限树（Ant Design Tree + Checkbox）
- 角色分配给管理员

```typescript
// 权限树示例
<Tree
  checkable
  checkedKeys={checkedKeys}
  onCheck={setCheckedKeys}
  treeData={permissionTreeData}
/>
```

### 6.4 Content Moderation

- 审核队列，按状态 Tab 切换
- 消息预览（含上下文）
- 操作按钮：通过、删除、警告、封禁

### 6.5 System Configuration

- 表单式配置编辑
- 动态配置分组：AI、配额、内容安全、公告等

### 6.6 Audit Logs

- 可筛选日志表格
- 变更 diff 查看器（before/after JSON）

---

## 七、Axios 请求层

```typescript
// src/api/request.ts
import axios, { AxiosError } from 'axios';
import { config } from '@/config';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissionStore } from '@/stores/permission.store';
import { message } from 'antd';

const request = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: 附加 JWT
request.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token;
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Response interceptor
request.interceptors.response.use(
  (res) => res.data,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      usePermissionStore.getState().clear();
      window.location.href = '/login';
      return Promise.reject(err);
    }
    if (err.response?.status === 403) {
      message.error('无操作权限');
      return Promise.reject(err);
    }
    message.error(err.message || '请求失败');
    return Promise.reject(err);
  }
);

// Token 刷新逻辑（可选）
async function refreshToken() {
  const { refreshToken } = useAuthStore.getState();
  const res = await axios.post(`${config.apiBaseUrl}/admin/refresh`, {
    refreshToken,
  });
  useAuthStore.getState().setToken(res.data.token);
  return res.data.token;
}
```

---

## 八、部署方案

- Vite 构建输出静态文件：`dist/`
- 部署至 CDN 或 Nginx 静态托管
- Nginx 配置 SPA fallback：

```nginx
server {
  listen 80;
  server_name admin.thinkagent.ai;
  root /var/www/admin;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location /api {
    proxy_pass https://api.thinkagent.ai;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

- 域名：`admin.thinkagent.ai`

---

## 九、安全设计

- Admin SPA 仅通过 VPN/IP 白名单访问
- JWT 短期过期（2h）
- 敏感操作需二次密码确认
- 所有操作记录审计日志
