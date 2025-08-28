import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Rating,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  CheckCircle as CheckIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../services/api/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/helpers';

const PackageDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const { data: packageData, isLoading } = useQuery(
    ['package', id],
    () => api.packages.getById(id),
    {
      select: (response) => response.data.package,
    }
  );

  const handleBooking = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location } });
      return;
    }
    navigate(`/booking/${id}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!packageData) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Degustazione non trovata
        </Typography>
        <Button onClick={() => navigate('/packages')} variant="contained">
          Torna alle degustazioni
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        {/* Images */}
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 3 }}>
            <img
              src={packageData.images?.[0] || '/images/wine-default.jpg'}
              alt={packageData.name}
              style={{
                width: '100%',
                height: '400px',
                objectFit: 'cover',
                borderRadius: '12px'
              }}
            />
          </Box>
        </Grid>

        {/* Booking Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 20 }}>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(packageData.price)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  per persona
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Rating value={packageData.avg_rating || 4.5} readOnly size="small" />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  ({packageData.review_count || 0} recensioni)
                </Typography>
              </Box>

              <List dense>
                <ListItem disablePadding>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Durata"
                    secondary={`${packageData.duration} minuti`}
                  />
                </ListItem>
                
                <ListItem disablePadding>
                  <ListItemIcon>
                    <GroupIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Partecipanti"
                    secondary={`Max ${packageData.max_participants} persone`}
                  />
                </ListItem>
                
                <ListItem disablePadding>
                  <ListItemIcon>
                    <LocationIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Luogo"
                    secondary={packageData.location}
                  />
                </ListItem>
              </List>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleBooking}
                sx={{ mt: 2 }}
              >
                {isAuthenticated ? 'Prenota Ora' : 'Accedi per Prenotare'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Details */}
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Chip
                label={packageData.difficulty_level}
                color="primary"
                sx={{ mr: 1 }}
              />
              <Chip
                label={packageData.category}
                variant="outlined"
              />
            </Box>

            <Typography variant="h3" component="h1" gutterBottom>
              {packageData.name}
            </Typography>
            
            <Typography variant="h6" color="text.secondary" gutterBottom>
              presso {packageData.producer_name}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Descrizione
            </Typography>
            <Typography variant="body1" paragraph>
              {packageData.description}
            </Typography>
          </Box>

          {/* What's included */}
          {packageData.inclusions && packageData.inclusions.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Cosa è incluso
              </Typography>
              <List>
                {packageData.inclusions.map((inclusion, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={inclusion} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Requirements */}
          {packageData.requirements && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Requisiti
              </Typography>
              <Typography variant="body1">
                {packageData.requirements}
              </Typography>
            </Box>
          )}

          {/* Cancellation policy */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Politica di Cancellazione
            </Typography>
            <Typography variant="body1">
              Cancellazione gratuita fino a 24 ore prima dell'esperienza.
              Per cancellazioni con meno di 24 ore di preavviso, non è previsto rimborso.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PackageDetailPage;