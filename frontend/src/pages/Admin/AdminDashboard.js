import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  EventNote as BookingsIcon,
  Business as ProducersIcon,
  Storage as ServicesIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  CloudQueue as LoadIcon,
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useAdmin } from '../../contexts/AdminContext';
import { formatDate, formatCurrency } from '../../utils/helpers';

const COLORS = ['#8B4513', '#DAA520', '#CD853F', '#DEB887', '#F4A460'];

const AdminDashboard = () => {
  const { services, analytics, actions } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    actions.fetchServicesStatus();
    actions.fetchAnalytics('7d');
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      actions.fetchServicesStatus(),
      actions.fetchAnalytics('7d'),
    ]);
    setRefreshing(false);
  };

  const getServiceStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getServiceStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      default: return <ErrorIcon />;
    }
  };

  // Mock data for charts (replace with real data from analytics)
  const revenueData = [
    { date: '2025-08-21', revenue: 1240, bookings: 12 },
    { date: '2025-08-22', revenue: 1680, bookings: 18 },
    { date: '2025-08-23', revenue: 2100, bookings: 24 },
    { date: '2025-08-24', revenue: 1890, bookings: 20 },
    { date: '2025-08-25', revenue: 2340, bookings: 28 },
    { date: '2025-08-26', revenue: 1950, bookings: 22 },
    { date: '2025-08-27', revenue: 2680, bookings: 32 },
  ];

  const serviceMetrics = Object.entries(services.status).map(([name, data]) => ({
    name: name.replace('-service', ''),
    status: data.status,
    uptime: data.uptime || '99.9%',
    responseTime: data.responseTime || Math.random() * 100 + 50,
    memory: data.memory || Math.random() * 512 + 256,
    cpu: data.cpu || Math.random() * 50 + 10,
  }));

  const overviewStats = [
    {
      title: 'Servizi Attivi',
      value: Object.keys(services.status).length,
      change: '+0',
      color: 'primary',
      icon: <ServicesIcon />,
    },
    {
      title: 'Prenotazioni Oggi',
      value: analytics.overview?.bookingsToday || 23,
      change: '+12%',
      color: 'success',
      icon: <BookingsIcon />,
    },
    {
      title: 'Ricavi Settimanali',
      value: formatCurrency(analytics.overview?.weeklyRevenue || 14500),
      change: '+8.2%',
      color: 'info',
      icon: <TrendingUpIcon />,
    },
    {
      title: 'Utenti Attivi',
      value: analytics.overview?.activeUsers || 1247,
      change: '+5.1%',
      color: 'warning',
      icon: <PeopleIcon />,
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Dashboard Amministrativa
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Panoramica generale della piattaforma VinBooking
          </Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Aggiornamento...' : 'Aggiorna'}
        </Button>
      </Box>

      {/* System Alerts */}
      {Object.values(services.status).some(s => s.status !== 'healthy') && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            Alcuni servizi richiedono attenzione. Controlla la sezione Microservizi per dettagli.
          </Typography>
        </Alert>
      )}

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {overviewStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Typography color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4">
                      {stat.value}
                    </Typography>
                    <Chip
                      label={stat.change}
                      color={stat.color}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </div>
                  <Box sx={{ color: `${stat.color}.main` }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Revenue Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ricavi e Prenotazioni (Ultimi 7 giorni)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(date) => new Date(date).getDate()} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip
                    labelFormatter={(date) => formatDate(date)}
                    formatter={[(value, name) => [
                      name === 'revenue' ? formatCurrency(value) : value,
                      name === 'revenue' ? 'Ricavi' : 'Prenotazioni'
                    ]]}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8B4513"
                    fill="rgba(139, 69, 19, 0.1)"
                    name="revenue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="bookings"
                    stroke="#DAA520"
                    strokeWidth={2}
                    name="bookings"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Services Status */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  Stato Microservizi
                </Typography>
                <IconButton size="small" onClick={actions.fetchServicesStatus}>
                  <RefreshIcon />
                </IconButton>
              </Box>
              
              {services.loading ? (
                <LinearProgress />
              ) : (
                <List dense>
                  {serviceMetrics.map((service, index) => (
                    <React.Fragment key={service.name}>
                      <ListItem>
                        <ListItemIcon>
                          <Chip
                            icon={getServiceStatusIcon(service.status)}
                            label={service.status}
                            color={getServiceStatusColor(service.status)}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={service.name}
                          secondary={`Uptime: ${service.uptime}`}
                        />
                      </ListItem>
                      {index < serviceMetrics.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Servizi
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="responseTime" fill="#8B4513" name="Tempo Risposta (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Utilizzo Memoria (MB)
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="memory" fill="#DAA520" name="Memoria (MB)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Attività Recente
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Nuova prenotazione confermata"
                    secondary="Degustazione Barolo Premium - 2 ore fa"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <PeopleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Nuovo produttore registrato"
                    secondary="Cantina dei Colli Piacentini - 4 ore fa"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <WarningIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Servizio Email temporaneamente lento"
                    secondary="Tempo di risposta > 2s - 6 ore fa"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <TrendingUpIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Picco di prenotazioni registrato"
                    secondary="42 nuove prenotazioni oggi - 8 ore fa"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;