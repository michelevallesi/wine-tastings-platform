// Formatting utilities
export const formatCurrency = (amount, currency = 'EUR') => {
  if (typeof amount !== 'number') {
    return '€0,00';
  }
  
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return new Date(date).toLocaleDateString('it-IT', { ...defaultOptions, ...options });
};

export const formatDateTime = (date) => {
  if (!date) return '';
  
  return new Date(date).toLocaleString('it-IT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (time) => {
  if (!time) return '';
  
  // Handle both HH:mm format and full datetime
  if (time.includes('T') || time.includes(' ')) {
    return new Date(time).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return time; // Already in HH:mm format
};

export const formatDuration = (minutes) => {
  if (!minutes) return '';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}min`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}min`;
  }
};

// String utilities
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\\s+/g, '-')           // Replace spaces with -
    .replace(/[^\\w\\-]+/g, '')       // Remove all non-word chars
    .replace(/\\-\\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

// Array utilities
export const groupBy = (array, key) => {
  return array.reduce((result, currentValue) => {
    (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
    return result;
  }, {});
};

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
};

// Validation utilities
export const isValidEmail = (email) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
  return re.test(email);
};

export const isValidPhone = (phone) => {
  // Italian phone number validation
  const re = /^[\\+]?[0-9]{10,15}$/;
  return re.test(phone.replace(/\\s/g, ''));
};

export const isValidPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$/;
  return re.test(password);
};

// Date utilities
export const isDateInPast = (date) => {
  return new Date(date) < new Date();
};

export const isDateInFuture = (date) => {
  return new Date(date) > new Date();
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysDifference = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getTimeSlots = (startTime = '09:00', endTime = '18:00', duration = 120) => {
  const slots = [];
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  
  let current = new Date(start);
  
  while (current < end) {
    const slotEnd = new Date(current.getTime() + duration * 60000);
    if (slotEnd <= end) {
      slots.push({
        start: current.toTimeString().substr(0, 5),
        end: slotEnd.toTimeString().substr(0, 5),
        label: `${current.toTimeString().substr(0, 5)} - ${slotEnd.toTimeString().substr(0, 5)}`,
      });
    }
    current = new Date(current.getTime() + duration * 60000);
  }
  
  return slots;
};

// Status utilities
export const getStatusColor = (status) => {
  const statusColors = {
    pending: 'warning',
    confirmed: 'info',
    processing: 'info',
    completed: 'success',
    cancelled: 'error',
    expired: 'default',
    active: 'success',
    inactive: 'default',
    verified: 'success',
    unverified: 'warning',
    approved: 'success',
    rejected: 'error',
    healthy: 'success',
    warning: 'warning',
    error: 'error',
  };
  
  return statusColors[status] || 'default';
};

export const getStatusLabel = (status) => {
  const statusLabels = {
    pending: 'In Attesa',
    confirmed: 'Confermata',
    processing: 'In Elaborazione',
    completed: 'Completata',
    cancelled: 'Cancellata',
    expired: 'Scaduta',
    active: 'Attivo',
    inactive: 'Inattivo',
    verified: 'Verificato',
    unverified: 'Non Verificato',
    approved: 'Approvato',
    rejected: 'Rifiutato',
    healthy: 'Sano',
    warning: 'Attenzione',
    error: 'Errore',
  };
  
  return statusLabels[status] || status;
};

// URL utilities
export const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.set(key, value);
      }
    }
  });
  
  return searchParams.toString();
};

export const parseQueryString = (search) => {
  const params = new URLSearchParams(search);
  const result = {};
  
  for (const [key, value] of params.entries()) {
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
};

// Image utilities
export const getOptimizedImageUrl = (imageObj, size = 'medium') => {
  if (!imageObj) return '/images/wine-default.jpg';
  
  if (typeof imageObj === 'string') {
    return imageObj;
  }
  
  if (imageObj.variants && imageObj.variants[size]) {
    return imageObj.variants[size];
  }
  
  return imageObj.url || '/images/wine-default.jpg';
};

// Local storage utilities
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
    return false;
  }
};

// Debounce utility
export const createDebounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};