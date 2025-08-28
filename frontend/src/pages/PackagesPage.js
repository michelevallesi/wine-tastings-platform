import React, { useState, useEffect } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  Rating,
  TextField,
  MenuItem,
  IconButton,
  Pagination,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../services/api/apiClient';
import { formatCurrency } from '../utils/helpers';

const PackagesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    priceMin: searchParams.get('priceMin') || '',
    priceMax: searchParams.get('priceMax') || '',
    difficulty: searchParams.get('difficulty') || '',
    page: parseInt(searchParams.get('page')) || 1,
  });

  const { data: packagesData, isLoading } = useQuery(
    ['packages', filters],
    () => api.packages.search({
      search: filters.search,
      location: filters.location,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      difficulty: filters.difficulty,
      page: filters.page,
      limit: 12,
    }),
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  const handleFilterChange = (name, value) => {
    const newFilters = { ...filters, [name]: value, page: 1 };
    setFilters(newFilters);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    setSearchParams(params);
  };

  const handlePageChange = (event, page) => {
    handleFilterChange('page', page);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Degustazioni Vinicole
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Scopri esperienze uniche nelle migliori cantine d'Italia
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4, p: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Cerca per nome o cantina..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={2}>
            <TextField
              select
              fullWidth
              label="Regione"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
            >
              <MenuItem value="">Tutte</MenuItem>
              <MenuItem value="piemonte">Piemonte</MenuItem>
              <MenuItem value="toscana">Toscana</MenuItem>
              <MenuItem value="veneto">Veneto</MenuItem>
              <MenuItem value="sicilia">Sicilia</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              label="Prezzo min"
              type="number"
              value={filters.priceMin}
              onChange={(e) => handleFilterChange('priceMin', e.target.value)}
            />
          </Grid>

          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              label="Prezzo max"
              type="number"
              value={filters.priceMax}
              onChange={(e) => handleFilterChange('priceMax', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              select
              fullWidth
              label="Difficoltà"
              value={filters.difficulty}
              onChange={(e) => handleFilterChange('difficulty', e.target.value)}
            >
              <MenuItem value="">Tutte</MenuItem>
              <MenuItem value="beginner">Principiante</MenuItem>
              <MenuItem value="intermediate">Intermedio</MenuItem>
              <MenuItem value="advanced">Avanzato</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1">
              {packagesData?.total || 0} degustazioni trovate
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {packagesData?.packages?.map((pkg) => (
              <Grid item xs={12} sm={6} lg={4} key={pkg.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={pkg.images?.[0] || '/images/wine-default.jpg'}
                    alt={pkg.name}
                  />
                  
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip
                        label={pkg.difficulty_level}
                        size="small"
                        color="primary"
                        sx={{ mr: 1 }}
                      />
                      <Rating value={pkg.avg_rating || 4.5} readOnly size="small" />
                    </Box>

                    <Typography variant="h6" gutterBottom>
                      {pkg.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {pkg.description?.substring(0, 120)}...
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        <Typography variant="body2">{pkg.location}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ScheduleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        <Typography variant="body2">{pkg.duration}min</Typography>
                      </Box>
                    </Box>

                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {formatCurrency(pkg.price)}
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      component={RouterLink}
                      to={`/packages/${pkg.id}`}
                      fullWidth
                      variant="contained"
                    >
                      Scopri di più
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {packagesData?.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={packagesData.totalPages}
                page={filters.page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default PackagesPage;