import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQuery, useMutation } from 'react-query';
import { api } from '../services/api/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const steps = ['Dettagli Prenotazione', 'Conferma', 'Pagamento'];

const BookingPage = () => {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeStep, setActiveStep] = useState(0);
  const [bookingData, setBookingData] = useState({
    package_id: packageId,
    booking_date: null,
    booking_time: '',
    participants: 1,
    special_requests: '',
    customer_details: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    }
  });

  const { data: packageData, isLoading } = useQuery(
    ['package', packageId],
    () => api.packages.getById(packageId),
    {
      select: (response) => response.data.package,
    }
  );

  const createBookingMutation = useMutation(
    (data) => api.bookings.create(data),
    {
      onSuccess: (response) => {
        toast.success('Prenotazione creata! Procedi al pagamento.');
        navigate(`/payment/${response.data.booking.id}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nella prenotazione');
      }
    }
  );

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setBookingData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setBookingData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Submit booking
      createBookingMutation.mutate(bookingData);
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalPrice = packageData?.price * bookingData.participants;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Prenota: {packageData?.name}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dettagli della Prenotazione
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Data della degustazione"
                  value={bookingData.booking_date}
                  onChange={(value) => handleInputChange('booking_date', value)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Orario</InputLabel>
                  <Select
                    value={bookingData.booking_time}
                    label="Orario"
                    onChange={(e) => handleInputChange('booking_time', e.target.value)}
                  >
                    <MenuItem value="10:00">10:00</MenuItem>
                    <MenuItem value="11:00">11:00</MenuItem>
                    <MenuItem value="14:00">14:00</MenuItem>
                    <MenuItem value="15:00">15:00</MenuItem>
                    <MenuItem value="16:00">16:00</MenuItem>
                    <MenuItem value="17:00">17:00</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Numero partecipanti"
                  value={bookingData.participants}
                  onChange={(e) => handleInputChange('participants', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: packageData?.max_participants }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Richieste speciali (opzionale)"
                  value={bookingData.special_requests}
                  onChange={(e) => handleInputChange('special_requests', e.target.value)}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nome completo"
                  value={bookingData.customer_details.name}
                  onChange={(e) => handleInputChange('customer_details.name', e.target.value)}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telefono"
                  value={bookingData.customer_details.phone}
                  onChange={(e) => handleInputChange('customer_details.phone', e.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conferma Prenotazione
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1"><strong>Degustazione:</strong> {packageData?.name}</Typography>
              <Typography variant="body1">Data: {bookingData.booking_date?.toLocaleDateString()}</Typography>
              <Typography variant="body1">Orario: {bookingData.booking_time}</Typography>
              <Typography variant="body1">Partecipanti: {bookingData.participants}</Typography>
              <Typography variant="body1">Nome: {bookingData.customer_details.name}</Typography>
              <Typography variant="body1">Telefono: {bookingData.customer_details.phone}</Typography>
              
              {bookingData.special_requests && (
                <Typography variant="body1">
                  <strong>Richieste speciali:</strong> {bookingData.special_requests}
                </Typography>
              )}
            </Box>

            <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="h6">
                Totale: {formatCurrency(totalPrice)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(packageData?.price)} × {bookingData.participants} partecipanti
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button 
          disabled={activeStep === 0} 
          onClick={handleBack}
        >
          Indietro
        </Button>
        
        <Button 
          variant="contained" 
          onClick={handleNext}
          disabled={createBookingMutation.isLoading}
        >
          {createBookingMutation.isLoading ? (
            <CircularProgress size={24} />
          ) : activeStep === steps.length - 1 ? (
            'Conferma e Paga'
          ) : (
            'Avanti'
          )}
        </Button>
      </Box>
    </Container>
  );
};

export default BookingPage;