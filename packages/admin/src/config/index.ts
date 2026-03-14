export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string || '/api/admin/v1',
  appTitle: import.meta.env.VITE_APP_TITLE as string || 'ThinkAgent Admin',
} as const;
