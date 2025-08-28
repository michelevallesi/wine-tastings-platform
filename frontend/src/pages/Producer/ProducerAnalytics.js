import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Star as StarIcon,
  Euro as EuroIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../../services/api/apiClient';
import { formatCurrency } from '../../utils/helpers';

const ProducerAnalytics = () => {
  const [period, setPeriod] = useState('30d');

  const { data: analyticsData, isLoading } = useQuery(
    ['producer-analytics', period],
    () => api.producers.getAnalytics({ period }),
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  const stats = analyticsData?.stats || {};
  const topPackages = analyticsData?.top_packages || [];
  const recentReviews = analyticsData?.recent_reviews || [];
  const monthlyData = analyticsData?.monthly_data || [];

  const statCards = [
    {
      title: 'Prenotazioni Totali',
      value: stats.total_bookings || 0,
      icon: <EventIcon />,
      color: 'primary',
      change: stats.bookings_change || 0,
    },
    {
      title: 'Ricavi Totali',
      value: formatCurrency(stats.total_revenue || 0),
      icon: <EuroIcon />,
      color: 'success',
      change: stats.revenue_change || 0,
    },
    {
      title: 'Clienti Unici',
      value: stats.unique_customers || 0,
      icon: <PeopleIcon />,
      color: 'info',
      change: stats.customers_change || 0,
    },
    {
      title: 'Rating Medio',
      value: `${(stats.avg_rating || 0).toFixed(1)}⭐`,
      icon: <StarIcon />,
      color: 'warning',
      change: stats.rating_change || 0,
    },
  ];

  const getChangeColor = (change) => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.secondary';
  };

  const getChangeSymbol = (change) => {
    if (change > 0) return '+';
    return '';
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Analytics della Cantina
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitora le performance delle tue esperienze vinicole
          </Typography>
        </Box>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Periodo</InputLabel>
          <Select
            value={period}
            label="Periodo"
            onChange={(e) => setPeriod(e.target.value)}
          >
            <MenuItem value="7d">Ultimi 7 giorni</MenuItem>
            <MenuItem value="30d">Ultimi 30 giorni</MenuItem>
            <MenuItem value="90d">Ultimi 3 mesi</MenuItem>
            <MenuItem value="1y">Ultimo anno</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: `${stat.color}.light`,
                      color: `${stat.color}.main`,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
                
                <Typography 
                  variant="body2" 
                  sx={{ color: getChangeColor(stat.change) }}
                >
                  {getChangeSymbol(stat.change)}{stat.change}% vs periodo precedente
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Top Performing Packages */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Esperienze più Popolari
              </Typography>
              
              {topPackages.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nessun dato disponibile
                </Typography>
              ) : (
                <List>
                  {topPackages.map((pkg, index) => (
                    <ListItem key={pkg.id} divider={index < topPackages.length - 1}>
                      <ListItemText
                        primary={pkg.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span">
                              {pkg.bookings_count} prenotazioni
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span" color="success.main">
                              {formatCurrency(pkg.revenue)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" fontWeight="bold">
                          #{index + 1}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {pkg.avg_rating?.toFixed(1)}⭐
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Reviews */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recensioni Recenti
              </Typography>
              
              {recentReviews.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nessuna recensione recente
                </Typography>
              ) : (
                <List>
                  {recentReviews.map((review, index) => (
                    <ListItem key={review.id} divider={index < recentReviews.length - 1}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {review.customer_name}
                            </Typography>
                            <Typography variant="body2">
                              {review.rating}⭐
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              "{review.comment?.substring(0, 80)}..."
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {review.package_name} • {new Date(review.created_at).toLocaleDateString('it-IT')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Mensile
              </Typography>
              
              {monthlyData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nessun dato mensile disponibile
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {monthlyData.slice(-6).map((month, index) => (
                    <Grid item xs={12} sm={6} md={2} key={index}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {month.month}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {month.bookings}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          prenotazioni
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          {formatCurrency(month.revenue)}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Insights */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Insights e Suggerimenti
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle2" color="primary.dark" gutterBottom>
                      💡 Consiglio
                    </Typography>
                    <Typography variant="body2">
                      Le esperienze con foto di alta qualità ricevono 60% più prenotazioni
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle2" color="success.dark" gutterBottom>
                      📈 Trend
                    </Typography>
                    <Typography variant="body2">
                      Le degustazioni del weekend hanno un tasso di conversione del 25% più alto
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                      ⚠️ Attenzione
                    </Typography>
                    <Typography variant="body2">
                      Rispondi alle recensioni entro 24h per migliorare la tua reputazione
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProducerAnalytics;