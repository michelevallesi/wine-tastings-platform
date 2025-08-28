import apiClient from './apiClient';

const producerService = {
  // Get producer profile
  async getProducerProfile() {
    try {
      const response = await apiClient.get('/producers/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update producer profile
  async updateProducerProfile(profileData) {
    try {
      const response = await apiClient.put('/producers/profile', profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer by ID (public)
  async getProducerById(id) {
    try {
      const response = await apiClient.get(`/producers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer dashboard data
  async getProducerDashboard() {
    try {
      const response = await apiClient.get('/producers/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer analytics
  async getProducerAnalytics(params = {}) {
    try {
      const response = await apiClient.get('/producers/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all producers (public search)
  async searchProducers(params = {}) {
    try {
      const response = await apiClient.get('/producers/search', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get featured producers
  async getFeaturedProducers() {
    try {
      const response = await apiClient.get('/producers/featured');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Upload producer images
  async uploadProducerImages(images) {
    try {
      const formData = new FormData();
      images.forEach((image, index) => {
        formData.append(`images`, image);
      });

      const response = await apiClient.post('/producers/images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete producer image
  async deleteProducerImage(imageId) {
    try {
      const response = await apiClient.delete(`/producers/images/${imageId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer reviews
  async getProducerReviews(producerId, params = {}) {
    try {
      const response = await apiClient.get(`/producers/${producerId}/reviews`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update producer business hours
  async updateBusinessHours(businessHours) {
    try {
      const response = await apiClient.put('/producers/business-hours', {
        business_hours: businessHours
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer notifications
  async getProducerNotifications() {
    try {
      const response = await apiClient.get('/producers/notifications');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Mark notification as read
  async markNotificationRead(notificationId) {
    try {
      const response = await apiClient.patch(`/producers/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer performance metrics
  async getPerformanceMetrics(period = '30d') {
    try {
      const response = await apiClient.get('/producers/performance', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update producer status (admin)
  async updateProducerStatus(producerId, status) {
    try {
      const response = await apiClient.patch(`/producers/${producerId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Request producer verification
  async requestVerification(verificationData) {
    try {
      const response = await apiClient.post('/producers/request-verification', verificationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default producerService;