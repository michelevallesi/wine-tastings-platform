import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';

// Components
import Layout from './components/Layout/Layout';
import AdminLayout from './components/Admin/AdminLayout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ErrorFallback from './components/UI/ErrorFallback';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Lazy loaded pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const PackageDetailPage = lazy(() => import('./pages/PackageDetailPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const ProducerPage = lazy(() => import('./pages/ProducerPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminServices = lazy(() => import('./pages/Admin/AdminServices'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminBookings = lazy(() => import('./pages/Admin/AdminBookings'));
const AdminProducers = lazy(() => import('./pages/Admin/AdminProducers'));
const AdminAnalytics = lazy(() => import('./pages/Admin/AdminAnalytics'));
const AdminSettings = lazy(() => import('./pages/Admin/AdminSettings'));

// Producer Dashboard Pages
const ProducerDashboard = lazy(() => import('./pages/Producer/ProducerDashboard'));
const ProducerPackages = lazy(() => import('./pages/Producer/ProducerPackages'));
const ProducerBookings = lazy(() => import('./pages/Producer/ProducerBookings'));
const ProducerAnalytics = lazy(() => import('./pages/Producer/ProducerAnalytics'));
const ProducerProfile = lazy(() => import('./pages/Producer/ProducerProfile'));

// React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Custom Material-UI Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#8B4513', // Saddle Brown
      light: '#A0522D',
      dark: '#654321',
    },
    secondary: {
      main: '#DAA520', // Goldenrod
      light: '#FFD700',
      dark: '#B8860B',
    },
    background: {
      default: '#FFF8F0', // Warm white
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2E2E2E',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
              <AdminProvider>
                <Router>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<Layout />}>
                        <Route index element={<HomePage />} />
                        <Route path="packages" element={<PackagesPage />} />
                        <Route path="packages/:id" element={<PackageDetailPage />} />
                        <Route path="producer/:id" element={<ProducerPage />} />
                        <Route path="login" element={<LoginPage />} />
                        <Route path="register" element={<RegisterPage />} />
                        
                        {/* Protected Customer Routes */}
                        <Route path="booking/:packageId" element={
                          <ProtectedRoute allowedRoles={['customer']}>
                            <BookingPage />
                          </ProtectedRoute>
                        } />
                        <Route path="profile" element={
                          <ProtectedRoute allowedRoles={['customer']}>
                            <ProfilePage />
                          </ProtectedRoute>
                        } />
                        <Route path="my-bookings" element={
                          <ProtectedRoute allowedRoles={['customer']}>
                            <BookingsPage />
                          </ProtectedRoute>
                        } />
                      </Route>

                      {/* Admin Routes */}
                      <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AdminLayout />
                        </ProtectedRoute>
                      }>
                        <Route index element={<AdminDashboard />} />
                        <Route path="services" element={<AdminServices />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="bookings" element={<AdminBookings />} />
                        <Route path="producers" element={<AdminProducers />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="settings" element={<AdminSettings />} />
                      </Route>

                      {/* Producer Routes */}
                      <Route path="/producer-dashboard" element={
                        <ProtectedRoute allowedRoles={['producer']}>
                          <AdminLayout isProducer={true} />
                        </ProtectedRoute>
                      }>
                        <Route index element={<ProducerDashboard />} />
                        <Route path="packages" element={<ProducerPackages />} />
                        <Route path="bookings" element={<ProducerBookings />} />
                        <Route path="analytics" element={<ProducerAnalytics />} />
                        <Route path="profile" element={<ProducerProfile />} />
                      </Route>

                      {/* Catch all route */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </Router>
              </AdminProvider>
            </AuthProvider>
            
            {/* Global Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  theme: {
                    primary: '#4caf50',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  theme: {
                    primary: '#f44336',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;