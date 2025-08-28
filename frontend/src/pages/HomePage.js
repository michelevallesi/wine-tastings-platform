import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  Paper,
  Avatar,
  Rating,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
  LocalBar as WineIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../services/api/apiClient';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency } from '../utils/helpers';

const HomePage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch featured packages
  const { data: featuredPackages, isLoading: loadingFeatured } = useQuery(
    'featured-packages',
    () => api.packages.getFeatured(6),
    {
      select: (response) => response.data.packages,
    }
  );

  // Fetch categories
  const { data: categories } = useQuery(
    'package-categories',
    () => api.packages.getCategories(),
    {
      select: (response) => response.data.categories,
    }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/packages?search=${encodeURIComponent(searchTerm)}`);
    } else {
      navigate('/packages');
    }
  };

  const heroStats = [
    { number: '150+', label: 'Cantine Partner' },
    { number: '500+', label: 'Esperienze Uniche' },
    { number: '12K+', label: 'Ospiti Soddisfatti' },
    { number: '4.9/5', label: 'Rating Medio' },
  ];

  const regions = [
    { name: 'Piemonte', count: 45, image: '/images/piemonte.jpg' },
    { name: 'Toscana', count: 38, image: '/images/toscana.jpg' },
    { name: 'Veneto', count: 32, image: '/images/veneto.jpg' },
    { name: 'Sicilia', count: 28, image: '/images/sicilia.jpg' },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #8B4513 0%, #CD853F 50%, #DAA520 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              mb: 2,
            }}
          >
            Scopri le Migliori
            <br />
            Degustazioni Vinicole
          </Typography>
          
          <Typography
            variant="h5"
            sx={{
              mb: 4,
              opacity: 0.9,
              maxWidth: 600,
              mx: 'auto',
              fontWeight: 300,
            }}
          >
            Esperienze autentiche nelle più prestigiose cantine d'Italia.
            Prenota la tua degustazione perfetta.
          </Typography>

          {/* Search Bar */}
          <Paper
            component="form"
            onSubmit={handleSearch}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              maxWidth: 600,
              mx: 'auto',
              mb: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
            <TextField
              placeholder="Cerca per regione, vitigno o cantina..."
              variant="outlined"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { border: 'none' },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton type="submit" color="primary">
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          {/* Hero Stats */}
          <Grid container spacing={4} justifyContent="center">
            {heroStats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {stat.number}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Background Decoration */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '50%',
            height: '100%',
            opacity: 0.1,
            background: 'url(/images/wine-pattern.svg) no-repeat center',
            backgroundSize: 'cover',
          }}
        />
      </Box>

      {/* Featured Packages Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Esperienze In Evidenza
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Le degustazioni più apprezzate dai nostri ospiti
          </Typography>
        </Box>

        {loadingFeatured ? (
          <LoadingSpinner />
        ) : (
          <Grid container spacing={4}>
            {featuredPackages?.map((pkg) => (
              <Grid item xs={12} md={6} lg={4} key={pkg.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                    },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="240"
                    image={pkg.images?.[0]?.variants?.medium || '/images/wine-default.jpg'}
                    alt={pkg.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip
                        label={pkg.difficulty_level}
                        size="small"
                        color="primary"
                        sx={{ mr: 1 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Rating
                          value={pkg.avg_rating || 4.5}
                          readOnly
                          size="small"
                          precision={0.1}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({pkg.review_count || 23})
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {pkg.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {pkg.description.substring(0, 120)}...
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <GroupIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          Max {pkg.max_participants}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {pkg.duration}min
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {formatCurrency(pkg.price)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        per persona
                      </Typography>
                    </Box>
                  </CardContent>
                  
                  <CardActions sx={{ p: 3, pt: 0 }}>
                    <Button
                      component={RouterLink}
                      to={`/packages/${pkg.id}`}
                      fullWidth
                      variant="contained"
                      size="large"
                    >
                      Scopri di più
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            component={RouterLink}
            to="/packages"
            variant="outlined"
            size="large"
            sx={{ minWidth: 200 }}
          >
            Vedi Tutte le Degustazioni
          </Button>
        </Box>
      </Container>

      {/* Regions Section */}
      <Box sx={{ backgroundColor: '#fafafa', py: 8 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
              Esplora per Regioni
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Scopri le tradizioni vinicole italiane
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {regions.map((region, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  component={RouterLink}
                  to={`/packages?location=${region.name.toLowerCase()}`}
                  sx={{
                    textDecoration: 'none',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={region.image}
                    alt={region.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {region.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {region.count} esperienze disponibili
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Why Choose Us Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Perché Scegliere VinBooking
          </Typography>
          <Typography variant="h6" color="text.secondary">
            La tua garanzia per esperienze vinicole autentiche
          </Typography>
        </Box>

        <Grid container spacing={6}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <VerifiedIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Cantine Selezionate
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Collaboriamo solo con produttori verificati e di qualità, 
                garantendo esperienze autentiche e memorabili.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'secondary.main',
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <StarIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Qualità Garantita
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Rating medio 4.9/5 basato su migliaia di recensioni reali 
                dei nostri ospiti soddisfatti.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'success.main',
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <TrendingIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Prenotazione Facile
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sistema di prenotazione semplice e sicuro con conferma immediata 
                e supporto clienti dedicato.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          background: 'linear-gradient(45deg, #8B4513 30%, #DAA520 90%)',
          color: 'white',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 700 }}>
            Pronto per la Tua Prossima Avventura?
          </Typography>
          <Typography variant="h6" paragraph sx={{ opacity: 0.9, mb: 4 }}>
            Unisciti a migliaia di appassionati che hanno scoperto 
            l'eccellenza vinicola italiana con VinBooking
          </Typography>
          <Button
            component={RouterLink}
            to="/packages"
            variant="contained"
            size="large"
            sx={{
              backgroundColor: 'white',
              color: 'primary.main',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.9)',
              },
            }}
          >
            Esplora Tutte le Esperienze
          </Button>
        </Container>
      </Box>
    </>
  );
};

export default HomePage;