import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  Rating,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as WebsiteIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../services/api/apiClient';
import { formatCurrency } from '../utils/helpers';

const ProducerPage = () => {
  const { id } = useParams();

  const { data: producerData, isLoading } = useQuery(
    ['producer', id],
    () => api.producers.getById(id),
    {
      select: (response) => response.data,
    }
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const producer = producerData?.producer;
  const packages = producerData?.packages || [];

  if (!producer) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Produttore non trovato
        </Typography>
        <Button component={RouterLink} to="/packages" variant="contained">
          Torna alle degustazioni
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Typography variant="h3" component="h1" gutterBottom>
              {producer.name}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LocationIcon sx={{ mr: 1 }} />
              <Typography variant="h6" color="text.secondary">
                {producer.address}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Rating value={producer.avg_rating || 4.5} readOnly />
              <Typography variant="body2">
                ({producer.review_count || 0} recensioni)
              </Typography>
              {producer.verified && (
                <Chip
                  icon={<CheckIcon />}
                  label="Verificato"
                  color="success"
                  size="small"
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            {producer.cover_image && (
              <img
                src={producer.cover_image}
                alt={producer.name}
                style={{
                  width: '100%',
                  height: '200px',
                  objectFit: 'cover',
                  borderRadius: '12px'
                }}
              />
            )}
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={4}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          {/* Description */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                La Nostra Storia
              </Typography>
              <Typography variant="body1" paragraph>
                {producer.description || 'Descrizione non disponibile.'}
              </Typography>
            </CardContent>
          </Card>

          {/* Specialties */}
          {producer.specialties && producer.specialties.length > 0 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Le Nostre Specialità
                </Typography>
                <List>
                  {producer.specialties.map((specialty, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemIcon>
                        <CheckIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={specialty} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Packages */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Esperienze Disponibili
            </Typography>
            
            <Grid container spacing={3}>
              {packages.map((pkg) => (
                <Grid item xs={12} sm={6} key={pkg.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardMedia
                      component="img"
                      height="160"
                      image={pkg.images?.[0] || '/images/wine-default.jpg'}
                      alt={pkg.name}
                    />
                    
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {pkg.name}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {pkg.description?.substring(0, 100)}...
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(pkg.price)}
                        </Typography>
                        
                        <Button
                          component={RouterLink}
                          to={`/packages/${pkg.id}`}
                          size="small"
                          variant="outlined"
                        >
                          Dettagli
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Contact Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Informazioni di Contatto
              </Typography>
              
              <List dense>
                {producer.phone && (
                  <ListItem disablePadding>
                    <ListItemIcon>
                      <PhoneIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Telefono"
                      secondary={producer.phone}
                    />
                  </ListItem>
                )}

                {producer.email && (
                  <ListItem disablePadding>
                    <ListItemIcon>
                      <EmailIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Email"
                      secondary={producer.email}
                    />
                  </ListItem>
                )}

                {producer.website && (
                  <ListItem disablePadding>
                    <ListItemIcon>
                      <WebsiteIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Sito Web"
                      secondary={
                        <a 
                          href={producer.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: 'inherit' }}
                        >
                          {producer.website}
                        </a>
                      }
                    />
                  </ListItem>
                )}

                <ListItem disablePadding>
                  <ListItemIcon>
                    <LocationIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Indirizzo"
                    secondary={producer.address}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistiche
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Esperienze offerte</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {packages.length}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Rating medio</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {(producer.avg_rating || 4.5).toFixed(1)}⭐
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Recensioni totali</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {producer.review_count || 0}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Anno fondazione</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {producer.founded_year || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProducerPage;