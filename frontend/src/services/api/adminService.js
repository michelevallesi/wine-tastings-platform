import apiClient from './apiClient';

const adminService = {
  // Dashboard data
  async getAdminDashboard() {
    try {
      const response = await apiClient.get('/admin/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // User management
  async getAllUsers(params = {}) {
    try {
      const response = await apiClient.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getUserById(id) {
    try {
      const response = await apiClient.get(`/admin/users/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateUserStatus(userId, status) {
    try {
      const response = await apiClient.patch(`/admin/users/${userId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      const response = await apiClient.delete(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Producer management
  async getAllProducers(params = {}) {
    try {
      const response = await apiClient.get('/admin/producers', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async approveProducer(producerId) {
    try {
      const response = await apiClient.patch(`/admin/producers/${producerId}/approve`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async rejectProducer(producerId, reason) {
    try {
      const response = await apiClient.patch(`/admin/producers/${producerId}/reject`, {
        rejection_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async suspendProducer(producerId, reason) {
    try {
      const response = await apiClient.patch(`/admin/producers/${producerId}/suspend`, {
        suspension_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Package management
  async getAllPackages(params = {}) {
    try {
      const response = await apiClient.get('/admin/packages', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async approvePackage(packageId) {
    try {
      const response = await apiClient.patch(`/admin/packages/${packageId}/approve`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async rejectPackage(packageId, reason) {
    try {
      const response = await apiClient.patch(`/admin/packages/${packageId}/reject`, {
        rejection_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deletePackage(packageId) {
    try {
      const response = await apiClient.delete(`/admin/packages/${packageId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Booking management
  async getAllBookings(params = {}) {
    try {
      const response = await apiClient.get('/admin/bookings', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getBookingById(bookingId) {
    try {
      const response = await apiClient.get(`/admin/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async refundBooking(bookingId, amount, reason) {
    try {
      const response = await apiClient.post(`/admin/bookings/${bookingId}/refund`, {
        amount,
        refund_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Review management
  async getAllReviews(params = {}) {
    try {
      const response = await apiClient.get('/admin/reviews', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async approveReview(reviewId) {
    try {
      const response = await apiClient.patch(`/admin/reviews/${reviewId}/approve`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async rejectReview(reviewId, reason) {
    try {
      const response = await apiClient.patch(`/admin/reviews/${reviewId}/reject`, {
        rejection_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteReview(reviewId) {
    try {
      const response = await apiClient.delete(`/admin/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Analytics and reports
  async getAnalytics(params = {}) {
    try {
      const response = await apiClient.get('/admin/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getRevenueReport(params = {}) {
    try {
      const response = await apiClient.get('/admin/reports/revenue', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getUserGrowthReport(params = {}) {
    try {
      const response = await apiClient.get('/admin/reports/user-growth', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPopularPackagesReport(params = {}) {
    try {
      const response = await apiClient.get('/admin/reports/popular-packages', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // System settings
  async getSystemSettings() {
    try {
      const response = await apiClient.get('/admin/settings');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateSystemSettings(settings) {
    try {
      const response = await apiClient.put('/admin/settings', settings);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Notifications
  async getAdminNotifications() {
    try {
      const response = await apiClient.get('/admin/notifications');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async markNotificationRead(notificationId) {
    try {
      const response = await apiClient.patch(`/admin/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async markAllNotificationsRead() {
    try {
      const response = await apiClient.patch('/admin/notifications/read-all');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Content management
  async getFeaturedContent() {
    try {
      const response = await apiClient.get('/admin/featured');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateFeaturedContent(content) {
    try {
      const response = await apiClient.put('/admin/featured', content);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Payment management
  async getPayments(params = {}) {
    try {
      const response = await apiClient.get('/admin/payments', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPaymentById(paymentId) {
    try {
      const response = await apiClient.get(`/admin/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Audit logs
  async getAuditLogs(params = {}) {
    try {
      const response = await apiClient.get('/admin/audit-logs', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Bulk operations
  async bulkDeleteUsers(userIds) {
    try {
      const response = await apiClient.delete('/admin/users/bulk', {
        data: { user_ids: userIds }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async bulkUpdatePackageStatus(packageIds, status) {
    try {
      const response = await apiClient.patch('/admin/packages/bulk-status', {
        package_ids: packageIds,
        status
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Export functions
  async exportUsersData(format = 'csv') {
    try {
      const response = await apiClient.get(`/admin/export/users?format=${format}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async exportBookingsData(params = {}, format = 'csv') {
    try {
      const response = await apiClient.get('/admin/export/bookings', {
        params: { ...params, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async exportRevenueReport(params = {}, format = 'pdf') {
    try {
      const response = await apiClient.get('/admin/export/revenue-report', {
        params: { ...params, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default adminService;