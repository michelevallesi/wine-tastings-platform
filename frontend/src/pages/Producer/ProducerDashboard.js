import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Star as StarIcon,
  Euro as EuroIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api/apiClient';
import { formatCurrency } from '../../utils/helpers';

const ProducerDashboard = () => {
  const { user } = useAuth();

  const { data: dashboardData, isLoading } = useQuery(
    ['producer-dashboard'],
    () => api.producers.getDashboard(),
    {
      select: (response) => response.data,
    }
  );

  const stats = dashboardData?.stats || {};
  const recentBookings = dashboardData?.recent_bookings || [];
  const notifications = dashboardData?.notifications || [];

  const statCards = [
    {
      title: 'Prenotazioni Oggi',
      value: stats.today_bookings || 0,
      icon: <EventIcon />,
      color: 'primary',
    },
    {
      title: 'Ricavi del Mese',
      value: formatCurrency(stats.month_revenue || 0),
      icon: <EuroIcon />,
      color: 'success',
    },
    {
      title: 'Rating Medio',
      value: `${(stats.avg_rating || 0).toFixed(1)}⭐`,
      icon: <StarIcon />,
      color: 'warning',
    },
    {
      title: 'Esperienze Attive',
      value: stats.active_packages || 0,
      icon: <TrendingUpIcon />,
      color: 'info',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Benvenuto, {user?.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestisci la tua cantina e le tue esperienze vinicole
          </Typography>
        </Box>
        
        <Button
          component={RouterLink}
          to="/producer/packages/new"
          variant="contained"
          startIcon={<AddIcon />}
          size="large"
        >
          Nuova Esperienza
        </Button>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    sx={{
                      bgcolor: `${stat.color}.main`,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Bookings */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Prenotazioni Recenti
                </Typography>
                <Button
                  component={RouterLink}
                  to="/producer/bookings"
                  size="small"
                >
                  Vedi Tutte
                </Button>
              </Box>

              {recentBookings.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nessuna prenotazione recente
                  </Typography>
                </Box>
              ) : (
                <List>
                  {recentBookings.map((booking) => (
                    <ListItem key={booking.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          <PeopleIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${booking.customer_name} - ${booking.package_name}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span">
                              {new Date(booking.booking_date).toLocaleDateString('it-IT')} alle {booking.booking_time}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span" color="text.secondary">
                              {booking.participants} partecipanti • {formatCurrency(booking.total_amount)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={booking.status === 'confirmed' ? 'Confermata' : 'In Attesa'}
                        color={booking.status === 'confirmed' ? 'success' : 'warning'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Azioni Rapide
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  component={RouterLink}
                  to="/producer/packages"
                  fullWidth
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                >
                  Gestisci Esperienze
                </Button>
                
                <Button
                  component={RouterLink}
                  to="/producer/bookings"
                  fullWidth
                  variant="outlined"
                  startIcon={<EventIcon />}
                >
                  Vedi Prenotazioni
                </Button>
                
                <Button
                  component={RouterLink}
                  to="/producer/profile"
                  fullWidth
                  variant="outlined"
                  startIcon={<PeopleIcon />}
                >
                  Modifica Profilo
                </Button>
                
                <Button
                  component={RouterLink}
                  to="/producer/analytics"
                  fullWidth
                  variant="outlined"
                  startIcon={<StarIcon />}
                >
                  Analytics
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Profile Completion */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Completa il tuo Profilo
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">
                    Completezza profilo
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    75%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={75} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Un profilo completo riceve più prenotazioni
              </Typography>
              
              <Button
                component={RouterLink}
                to="/producer/profile"
                size="small"
                variant="contained"
              >
                Completa Profilo
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifiche
              </Typography>
              
              {notifications.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nessuna notifica
                </Typography>
              ) : (
                <List dense>
                  {notifications.slice(0, 3).map((notification, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          <NotificationsIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={notification.title}
                        secondary={notification.message}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProducerDashboard;