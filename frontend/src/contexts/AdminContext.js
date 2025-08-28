import React, { createContext, useContext, useState, useEffect } from 'react';
import adminService from '../services/api/adminService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check if user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const data = await adminService.getAdminDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Errore nel caricamento della dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Load notifications
  const loadNotifications = async () => {
    if (!isAdmin) return;
    
    try {
      const data = await adminService.getAdminNotifications();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notificationId) => {
    try {
      await adminService.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      toast.error('Errore nell\'aggiornamento della notifica');
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await adminService.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );
      toast.success('Tutte le notifiche sono state marcate come lette');
    } catch (error) {
      toast.error('Errore nell\'aggiornamento delle notifiche');
    }
  };

  // User management functions
  const updateUserStatus = async (userId, status) => {
    try {
      await adminService.updateUserStatus(userId, status);
      toast.success('Stato utente aggiornato con successo');
      // Reload dashboard to refresh stats
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'aggiornamento dello stato');
      throw error;
    }
  };

  const deleteUser = async (userId) => {
    try {
      await adminService.deleteUser(userId);
      toast.success('Utente eliminato con successo');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'eliminazione dell\'utente');
      throw error;
    }
  };

  // Producer management functions
  const approveProducer = async (producerId) => {
    try {
      await adminService.approveProducer(producerId);
      toast.success('Produttore approvato con successo');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'approvazione del produttore');
      throw error;
    }
  };

  const rejectProducer = async (producerId, reason) => {
    try {
      await adminService.rejectProducer(producerId, reason);
      toast.success('Produttore rifiutato');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nel rifiuto del produttore');
      throw error;
    }
  };

  const suspendProducer = async (producerId, reason) => {
    try {
      await adminService.suspendProducer(producerId, reason);
      toast.success('Produttore sospeso');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nella sospensione del produttore');
      throw error;
    }
  };

  // Package management functions
  const approvePackage = async (packageId) => {
    try {
      await adminService.approvePackage(packageId);
      toast.success('Esperienza approvata con successo');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'approvazione dell\'esperienza');
      throw error;
    }
  };

  const rejectPackage = async (packageId, reason) => {
    try {
      await adminService.rejectPackage(packageId, reason);
      toast.success('Esperienza rifiutata');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nel rifiuto dell\'esperienza');
      throw error;
    }
  };

  // Review management functions
  const approveReview = async (reviewId) => {
    try {
      await adminService.approveReview(reviewId);
      toast.success('Recensione approvata con successo');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'approvazione della recensione');
      throw error;
    }
  };

  const rejectReview = async (reviewId, reason) => {
    try {
      await adminService.rejectReview(reviewId, reason);
      toast.success('Recensione rifiutata');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nel rifiuto della recensione');
      throw error;
    }
  };

  // Export functions
  const exportData = async (type, params = {}, format = 'csv') => {
    try {
      let blob;
      switch (type) {
        case 'users':
          blob = await adminService.exportUsersData(format);
          break;
        case 'bookings':
          blob = await adminService.exportBookingsData(params, format);
          break;
        case 'revenue':
          blob = await adminService.exportRevenueReport(params, format);
          break;
        default:
          throw new Error('Tipo di export non supportato');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export completato con successo');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Errore nell\'export dei dati');
      throw error;
    }
  };

  // Load data when user becomes admin
  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
      loadNotifications();
    }
  }, [isAdmin]);

  const value = {
    // State
    isAdmin,
    dashboardData,
    notifications,
    loading,

    // Data loading
    loadDashboardData,
    loadNotifications,

    // Notification management
    markNotificationRead,
    markAllNotificationsRead,

    // User management
    updateUserStatus,
    deleteUser,

    // Producer management
    approveProducer,
    rejectProducer,
    suspendProducer,

    // Package management
    approvePackage,
    rejectPackage,

    // Review management
    approveReview,
    rejectReview,

    // Export functions
    exportData,

    // Direct service access for complex operations
    adminService,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export default AdminContext;