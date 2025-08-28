import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AccountBalance as PayPalIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useQuery, useMutation } from 'react-query';
import { api } from '../services/api/apiClient';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ booking, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  const createPaymentMutation = useMutation(
    (data) => api.payments.create(data),
    {
      onSuccess: (response) => {
        setClientSecret(response.data.payment.client_secret);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nella creazione del pagamento');
      }
    }
  );

  useEffect(() => {
    if (booking) {
      createPaymentMutation.mutate({
        booking_id: booking.id,
        amount: booking.total_amount,
        currency: 'EUR',
        payment_method: paymentMethod,
      });
    }
  }, [booking, paymentMethod]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setProcessing(true);

    try {
      if (paymentMethod === 'stripe') {
        const cardElement = elements.getElement(CardElement);
        
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: booking.customer_name,
              email: booking.customer_email,
            },
          }
        });

        if (error) {
          toast.error(error.message);
        } else if (paymentIntent.status === 'succeeded') {
          onSuccess(paymentIntent.id);
        }
      }
    } catch (error) {
      toast.error('Errore durante il pagamento');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Metodo di Pagamento
          </Typography>
          
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <FormControlLabel
                value="stripe"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CreditCardIcon sx={{ mr: 1 }} />
                    Carta di Credito/Debito
                  </Box>
                }
              />
              <FormControlLabel
                value="paypal"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PayPalIcon sx={{ mr: 1 }} />
                    PayPal
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </CardContent>
      </Card>

      {paymentMethod === 'stripe' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dettagli Carta
            </Typography>
            
            <Box sx={{ p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                  },
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <SecurityIcon sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                I tuoi dati sono protetti con crittografia SSL
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={!stripe || processing || createPaymentMutation.isLoading}
        sx={{ py: 2 }}
      >
        {processing || createPaymentMutation.isLoading ? (
          <CircularProgress size={24} />
        ) : (
          `Paga ${formatCurrency(booking?.total_amount || 0)}`
        )}
      </Button>
    </form>
  );
};

const PaymentPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const { data: bookingData, isLoading } = useQuery(
    ['booking', bookingId],
    () => api.bookings.getById(bookingId),
    {
      select: (response) => response.data.booking,
    }
  );

  const handlePaymentSuccess = (paymentIntentId) => {
    toast.success('Pagamento completato con successo!');
    navigate(`/booking-confirmation/${bookingId}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!bookingData) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Prenotazione non trovata
        </Typography>
        <Button onClick={() => navigate('/')} variant="contained">
          Torna alla Home
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Completa il Pagamento
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Elements stripe={stripePromise}>
            <PaymentForm 
              booking={bookingData} 
              onSuccess={handlePaymentSuccess}
            />
          </Elements>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Riepilogo Prenotazione
              </Typography>
              
              <List dense>
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Esperienza"
                    secondary={bookingData.package_name}
                  />
                </ListItem>
                
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Data"
                    secondary={new Date(bookingData.booking_date).toLocaleDateString('it-IT')}
                  />
                </ListItem>
                
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Orario"
                    secondary={bookingData.booking_time}
                  />
                </ListItem>
                
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Partecipanti"
                    secondary={`${bookingData.participants} persone`}
                  />
                </ListItem>
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Totale
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(bookingData.total_amount)}
                </Typography>
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Cancellazione gratuita fino a 24 ore prima dell'esperienza
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PaymentPage;