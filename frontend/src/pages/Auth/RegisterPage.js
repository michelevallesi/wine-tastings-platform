import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  MenuItem,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LocalBar as WineIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'customer',
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
    setError('');
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Le password non coincidono');
      return false;
    }
    if (formData.password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return false;
    }
    if (!formData.terms) {
      setError('Devi accettare i termini e condizioni');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');

    try {
      const { confirmPassword, terms, ...registerData } = formData;
      await register(registerData);
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.message || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <WineIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Unisciti a VinBooking
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Crea un account e inizia a scoprire degustazioni uniche
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="name"
              label="Nome completo"
              value={formData.name}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
            />

            <TextField
              fullWidth
              name="email"
              type="email"
              label="Email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="email"
              disabled={isLoading}
            />

            <TextField
              fullWidth
              name="phone"
              label="Telefono (opzionale)"
              value={formData.phone}
              onChange={handleChange}
              margin="normal"
              disabled={isLoading}
            />

            <TextField
              select
              fullWidth
              name="role"
              label="Tipo di account"
              value={formData.role}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
              helperText="Seleziona il tipo di account più adatto a te"
            >
              <MenuItem value="customer">Cliente</MenuItem>
              <MenuItem value="producer">Produttore di Vino</MenuItem>
            </TextField>

            <TextField
              fullWidth
              name="password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              label="Conferma Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  name="terms"
                  checked={formData.terms}
                  onChange={handleChange}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  Accetto i{' '}
                  <Link component={RouterLink} to="/terms">
                    Termini e Condizioni
                  </Link>{' '}
                  e la{' '}
                  <Link component={RouterLink} to="/privacy">
                    Privacy Policy
                  </Link>
                </Typography>
              }
              sx={{ mt: 2 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Registrati'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>oppure</Divider>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Hai già un account?{' '}
              <Link
                component={RouterLink}
                to="/login"
                variant="body2"
                fontWeight="medium"
              >
                Accedi
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Info for producers */}
      {formData.role === 'producer' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Account Produttore:</strong> Dopo la registrazione, 
            il tuo account sarà sottoposto a verifica. Riceverai una email 
            di conferma una volta approvato.
          </Typography>
        </Alert>
      )}
    </Container>
  );
};

export default RegisterPage;