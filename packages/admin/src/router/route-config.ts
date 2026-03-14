import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

export interface RouteConfig {
  path: string;
  component: LazyExoticComponent<ComponentType>;
  permission?: string;
  title: string;
  children?: RouteConfig[];
}

const Dashboard = lazy(() => import('@/pages/dashboard'));
const Users = lazy(() => import('@/pages/users'));
const Content = lazy(() => import('@/pages/content'));
const SystemConfig = lazy(() => import('@/pages/system/Config'));
const RoleManagement = lazy(() => import('@/pages/system/RoleManagement'));
const AuditLogs = lazy(() => import('@/pages/system/AuditLogs'));
const Forbidden = lazy(() => import('@/pages/403'));

export const routeConfigs: RouteConfig[] = [
  {
    path: '/dashboard',
    component: Dashboard,
    title: 'Dashboard',
    permission: 'dashboard:view',
  },
  {
    path: '/users',
    component: Users,
    title: 'User Management',
    permission: 'user:view',
  },
  {
    path: '/content',
    component: Content,
    title: 'Content Moderation',
    permission: 'content:view',
  },
  {
    path: '/system/config',
    component: SystemConfig,
    title: 'System Config',
    permission: 'system:config',
  },
  {
    path: '/system/roles',
    component: RoleManagement,
    title: 'Role Management',
    permission: 'system:role',
  },
  {
    path: '/system/audit',
    component: AuditLogs,
    title: 'Audit Logs',
    permission: 'system:audit',
  },
  {
    path: '/403',
    component: Forbidden,
    title: 'Forbidden',
  },
];
