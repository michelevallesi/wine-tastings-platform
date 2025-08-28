import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Euro as EuroIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../services/api/apiClient';
import { formatCurrency, formatDate } from '../utils/helpers';

const BookingsPage = () => {
  const [tabValue, setTabValue] = useState(0);
  
  const { data: bookingsData, isLoading } = useQuery(
    ['user-bookings'],
    () => api.bookings.list(),
    {
      select: (response) => response.data,
    }
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'confirmed': return 'Confermata';
      case 'pending': return 'In Attesa';
      case 'cancelled': return 'Cancellata';
      case 'completed': return 'Completata';
      default: return status;
    }
  };

  const filterBookings = (bookings, filter) => {
    if (!bookings) return [];
    
    switch (filter) {
      case 0: // Tutte
        return bookings;
      case 1: // Prossime
        return bookings.filter(b => 
          new Date(b.booking_date) >= new Date() && b.status === 'confirmed'
        );
      case 2: // Passate
        return bookings.filter(b => 
          new Date(b.booking_date) < new Date() || b.status === 'completed'
        );
      case 3: // Cancellate
        return bookings.filter(b => b.status === 'cancelled');
      default:
        return bookings;
    }
  };

  const filteredBookings = filterBookings(bookingsData?.bookings, tabValue);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Le Mie Prenotazioni
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Gestisci e visualizza tutte le tue prenotazioni di degustazioni vinicole
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Tutte" />
          <Tab label="Prossime" />
          <Tab label="Passate" />
          <Tab label="Cancellate" />
        </Tabs>
      </Box>

      {filteredBookings?.length === 0 ? (
        <Alert severity="info">
          {tabValue === 1 ? 'Non hai prenotazioni future.' :
           tabValue === 2 ? 'Non hai ancora completato nessuna degustazione.' :
           tabValue === 3 ? 'Non hai prenotazioni cancellate.' :
           'Non hai ancora effettuato nessuna prenotazione.'}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {filteredBookings?.map((booking) => (
            <Grid item xs={12} key={booking.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {booking.package_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Codice prenotazione: {booking.confirmation_code}
                      </Typography>
                    </Box>
                    
                    <Chip
                      label={getStatusLabel(booking.status)}
                      color={getStatusColor(booking.status)}
                      size="small"
                    />
                  </Box>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EventIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Data e ora
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(booking.booking_date)}
                          </Typography>
                          <Typography variant="body2">
                            {booking.booking_time}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Luogo
                          </Typography>
                          <Typography variant="body2">
                            {booking.producer_name}
                          </Typography>
                          <Typography variant="body2">
                            {booking.location}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PeopleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Partecipanti
                          </Typography>
                          <Typography variant="body2">
                            {booking.participants} persone
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EuroIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Totale
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatCurrency(booking.total_amount)}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  {booking.special_requests && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Richieste speciali:
                      </Typography>
                      <Typography variant="body2">
                        {booking.special_requests}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => window.open(`/packages/${booking.package_id}`, '_blank')}
                    >
                      Vedi Degustazione
                    </Button>
                    
                    {booking.status === 'confirmed' && new Date(booking.booking_date) >= new Date() && (
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        // onClick={() => handleCancelBooking(booking.id)}
                      >
                        Cancella
                      </Button>
                    )}
                    
                    {booking.status === 'completed' && (
                      <Button
                        variant="outlined"
                        size="small"
                        // onClick={() => handleLeaveReview(booking.package_id)}
                      >
                        Lascia Recensione
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default BookingsPage;