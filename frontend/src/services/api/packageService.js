import apiClient from './apiClient';

const packageService = {
  // Get packages with search/filter
  async searchPackages(params = {}) {
    try {
      const response = await apiClient.get('/packages/search', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get featured packages
  async getFeaturedPackages() {
    try {
      const response = await apiClient.get('/packages/featured');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get package by ID
  async getPackageById(id) {
    try {
      const response = await apiClient.get(`/packages/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all packages (admin)
  async getAllPackages(params = {}) {
    try {
      const response = await apiClient.get('/packages', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new package (producer)
  async createPackage(packageData) {
    try {
      const response = await apiClient.post('/packages', packageData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update package (producer)
  async updatePackage(id, packageData) {
    try {
      const response = await apiClient.put(`/packages/${id}`, packageData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete package (producer)
  async deletePackage(id) {
    try {
      const response = await apiClient.delete(`/packages/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Toggle package active status
  async togglePackageActive(id, isActive) {
    try {
      const response = await apiClient.patch(`/packages/${id}/toggle-active`, {
        is_active: isActive
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get producer's packages
  async getProducerPackages() {
    try {
      const response = await apiClient.get('/packages/producer');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Upload package images
  async uploadPackageImages(packageId, images) {
    try {
      const formData = new FormData();
      images.forEach((image, index) => {
        formData.append(`images`, image);
      });

      const response = await apiClient.post(
        `/packages/${packageId}/images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete package image
  async deletePackageImage(packageId, imageId) {
    try {
      const response = await apiClient.delete(`/packages/${packageId}/images/${imageId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get package reviews
  async getPackageReviews(packageId, params = {}) {
    try {
      const response = await apiClient.get(`/packages/${packageId}/reviews`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add package to favorites
  async addToFavorites(packageId) {
    try {
      const response = await apiClient.post(`/packages/${packageId}/favorite`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Remove package from favorites
  async removeFromFavorites(packageId) {
    try {
      const response = await apiClient.delete(`/packages/${packageId}/favorite`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user's favorite packages
  async getFavoritePackages() {
    try {
      const response = await apiClient.get('/packages/favorites');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default packageService;