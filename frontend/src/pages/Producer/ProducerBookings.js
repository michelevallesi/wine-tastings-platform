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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CheckCircle as ConfirmIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../../services/api/apiClient';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ProducerBookings = () => {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [notes, setNotes] = useState('');

  const { data: bookingsData, isLoading } = useQuery(
    ['producer-bookings'],
    () => api.bookings.getProducerBookings(),
    {
      select: (response) => response.data,
    }
  );

  const updateBookingMutation = useMutation(
    ({ bookingId, action, data }) => api.bookings.updateStatus(bookingId, { status: action, ...data }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['producer-bookings']);
        toast.success('Prenotazione aggiornata con successo');
        setActionDialog(null);
        setNotes('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nell\'aggiornamento');
      }
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
      case 1: // Oggi
        const today = new Date().toDateString();
        return bookings.filter(b => new Date(b.booking_date).toDateString() === today);
      case 2: // Prossime
        return bookings.filter(b => 
          new Date(b.booking_date) >= new Date() && b.status === 'confirmed'
        );
      case 3: // In attesa
        return bookings.filter(b => b.status === 'pending');
      default:
        return bookings;
    }
  };

  const handleMenuClick = (event, booking) => {
    setAnchorEl(event.currentTarget);
    setSelectedBooking(booking);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBooking(null);
  };

  const handleAction = (action) => {
    setActionDialog(action);
    handleMenuClose();
  };

  const executeAction = () => {
    if (selectedBooking && actionDialog) {
      updateBookingMutation.mutate({
        bookingId: selectedBooking.id,
        action: actionDialog,
        data: notes ? { notes } : {}
      });
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
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        Gestione Prenotazioni
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Visualizza e gestisci tutte le prenotazioni per le tue esperienze
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {bookingsData?.stats?.total || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prenotazioni Totali
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {bookingsData?.stats?.pending || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                In Attesa
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {bookingsData?.stats?.confirmed || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Confermate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {formatCurrency(bookingsData?.stats?.revenue || 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ricavi del Mese
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Tutte" />
          <Tab label="Oggi" />
          <Tab label="Prossime" />
          <Tab label="In Attesa" />
        </Tabs>
      </Box>

      {/* Bookings Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Esperienza</TableCell>
              <TableCell>Data & Ora</TableCell>
              <TableCell>Partecipanti</TableCell>
              <TableCell>Importo</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nessuna prenotazione trovata
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {booking.customer_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {booking.customer_email}
                      </Typography>
                      {booking.customer_phone && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {booking.customer_phone}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {booking.package_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.confirmation_code}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(booking.booking_date)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.booking_time}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {booking.participants}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(booking.total_amount)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={getStatusLabel(booking.status)}
                      color={getStatusColor(booking.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <IconButton
                      onClick={(e) => handleMenuClick(e, booking)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedBooking?.status === 'pending' && (
          <MenuItem onClick={() => handleAction('confirmed')}>
            <ConfirmIcon sx={{ mr: 1 }} />
            Conferma
          </MenuItem>
        )}
        
        {selectedBooking?.status !== 'cancelled' && (
          <MenuItem onClick={() => handleAction('cancelled')}>
            <CancelIcon sx={{ mr: 1 }} />
            Cancella
          </MenuItem>
        )}
        
        <MenuItem onClick={() => window.location.href = `mailto:${selectedBooking?.customer_email}`}>
          <EmailIcon sx={{ mr: 1 }} />
          Invia Email
        </MenuItem>
        
        {selectedBooking?.customer_phone && (
          <MenuItem onClick={() => window.location.href = `tel:${selectedBooking?.customer_phone}`}>
            <PhoneIcon sx={{ mr: 1 }} />
            Chiama
          </MenuItem>
        )}
      </Menu>

      {/* Action Dialog */}
      <Dialog open={Boolean(actionDialog)} onClose={() => setActionDialog(null)}>
        <DialogTitle>
          {actionDialog === 'confirmed' ? 'Conferma Prenotazione' : 'Cancella Prenotazione'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Note (opzionale)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="normal"
            placeholder="Aggiungi una nota per il cliente..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>Annulla</Button>
          <Button
            onClick={executeAction}
            color={actionDialog === 'confirmed' ? 'success' : 'error'}
            variant="contained"
            disabled={updateBookingMutation.isLoading}
          >
            {updateBookingMutation.isLoading ? (
              <CircularProgress size={20} />
            ) : (
              actionDialog === 'confirmed' ? 'Conferma' : 'Cancella'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProducerBookings;