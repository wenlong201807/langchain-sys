import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import AdminLayout from '@/components/layout/AdminLayout';
import AuthRoute from './auth-route';
import { routeConfigs } from './route-config';
import LoginPage from '@/pages/login';

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <AuthRoute>
                <AdminLayout />
              </AuthRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            {routeConfigs.map((route) => (
              <Route
                key={route.path}
                path={route.path.replace(/^\//, '')}
                element={
                  route.permission ? (
                    <AuthRoute permission={route.permission}>
                      <route.component />
                    </AuthRoute>
                  ) : (
                    <route.component />
                  )
                }
              />
            ))}
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
