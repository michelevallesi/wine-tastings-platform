import apiClient from './apiClient';

const bookingService = {
  // Create new booking
  async createBooking(bookingData) {
    try {
      const response = await apiClient.post('/bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user's bookings
  async getUserBookings(params = {}) {
    try {
      const response = await apiClient.get('/bookings', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get booking by ID
  async getBookingById(id) {
    try {
      const response = await apiClient.get(`/bookings/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update booking
  async updateBooking(id, bookingData) {
    try {
      const response = await apiClient.put(`/bookings/${id}`, bookingData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Cancel booking
  async cancelBooking(id, reason = '') {
    try {
      const response = await apiClient.patch(`/bookings/${id}/cancel`, {
        cancellation_reason: reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Confirm booking (producer)
  async confirmBooking(id, notes = '') {
    try {
      const response = await apiClient.patch(`/bookings/${id}/confirm`, {
        notes
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer's bookings
  async getProducerBookings(params = {}) {
    try {
      const response = await apiClient.get('/bookings/producer', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update booking status (producer)
  async updateBookingStatus(id, status, notes = '') {
    try {
      const response = await apiClient.patch(`/bookings/${id}/status`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get booking statistics (producer)
  async getBookingStats(params = {}) {
    try {
      const response = await apiClient.get('/bookings/stats', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Check availability
  async checkAvailability(packageId, date, time) {
    try {
      const response = await apiClient.get(`/packages/${packageId}/availability`, {
        params: { date, time }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get available time slots
  async getAvailableTimeSlots(packageId, date) {
    try {
      const response = await apiClient.get(`/packages/${packageId}/time-slots`, {
        params: { date }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add review to booking
  async addBookingReview(bookingId, reviewData) {
    try {
      const response = await apiClient.post(`/bookings/${bookingId}/review`, reviewData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get booking confirmation details
  async getBookingConfirmation(confirmationCode) {
    try {
      const response = await apiClient.get(`/bookings/confirmation/${confirmationCode}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Resend booking confirmation email
  async resendConfirmation(bookingId) {
    try {
      const response = await apiClient.post(`/bookings/${bookingId}/resend-confirmation`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default bookingService;