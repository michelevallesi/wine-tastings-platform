import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Alert,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  RestartAlt as RestartIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useAdmin } from '../../contexts/AdminContext';
import toast from 'react-hot-toast';

const AdminServices = () => {
  const { services, actions } = useAdmin();
  const [selectedService, setSelectedService] = useState(null);
  const [restartDialog, setRestartDialog] = useState(null);
  const [configDialog, setConfigDialog] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    actions.fetchServicesStatus();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      actions.fetchServicesStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, actions]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      default: return <ErrorIcon />;
    }
  };

  const handleRestartService = async (serviceName) => {
    try {
      await actions.restartService(serviceName);
      setRestartDialog(null);
    } catch (error) {
      console.error('Restart failed:', error);
    }
  };

  const servicesList = Object.entries(services.status).map(([name, data]) => ({
    name,
    displayName: name.replace('-service', '').replace(/\\b\\w/g, l => l.toUpperCase()),
    status: data.status || 'unknown',
    uptime: data.uptime || '0%',
    responseTime: data.responseTime || 0,
    memory: data.memory || 0,
    cpu: data.cpu || 0,
    version: data.version || '1.0.0',
    lastRestart: data.lastRestart || new Date().toISOString(),
    health: data.health || {},
    metrics: data.metrics || {},
  }));

  // Mock real-time data for demonstration
  const mockMetricsData = Array.from({ length: 20 }, (_, i) => ({
    time: new Date(Date.now() - (19 - i) * 60000).toLocaleTimeString(),
    responseTime: Math.random() * 100 + 50,
    memory: Math.random() * 200 + 300,
    cpu: Math.random() * 50 + 10,
  }));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Gestione Microservizi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitoraggio e controllo dei servizi della piattaforma
          </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
            }
            label="Auto-refresh"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={actions.fetchServicesStatus}
            disabled={services.loading}
          >
            Aggiorna
          </Button>
        </Box>
      </Box>

      {/* System Status Alert */}
      {servicesList.some(s => s.status !== 'healthy') && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {servicesList.filter(s => s.status !== 'healthy').length} servizi richiedono attenzione
        </Alert>
      )}

      {/* Services Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {servicesList.map((service) => (
          <Grid item xs={12} md={6} lg={4} key={service.name}>
            <Card 
              sx={{ 
                height: '100%',
                border: service.status === 'error' ? '2px solid #f44336' : 'none'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    {service.displayName}
                  </Typography>
                  <Chip
                    icon={getStatusIcon(service.status)}
                    label={service.status.toUpperCase()}
                    color={getStatusColor(service.status)}
                    size="small"
                  />
                </Box>

                <List dense>
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Uptime"
                      secondary={service.uptime}
                    />
                    <ListItemSecondaryAction>
                      <NetworkIcon color="action" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Tempo Risposta"
                      secondary={`${Math.round(service.responseTime)}ms`}
                    />
                    <ListItemSecondaryAction>
                      <SpeedIcon color="action" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Memoria"
                      secondary={`${Math.round(service.memory)}MB`}
                    />
                    <ListItemSecondaryAction>
                      <MemoryIcon color="action" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  <ListItem disablePadding>
                    <ListItemText
                      primary="CPU"
                      secondary={`${Math.round(service.cpu)}%`}
                    />
                    <ListItemSecondaryAction>
                      <StorageIcon color="action" />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  startIcon={<TimelineIcon />}
                  onClick={() => setSelectedService(service)}
                >
                  Dettagli
                </Button>
                <Box>
                  <Tooltip title="Configurazione">
                    <IconButton
                      size="small"
                      onClick={() => setConfigDialog(service)}
                    >
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Riavvia Servizio">
                    <IconButton
                      size="small"
                      onClick={() => setRestartDialog(service)}
                      color="warning"
                    >
                      <RestartIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Services Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Panoramica Dettagliata
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Servizio</TableCell>
                  <TableCell>Stato</TableCell>
                  <TableCell>Uptime</TableCell>
                  <TableCell>Resp. Time</TableCell>
                  <TableCell>Memoria</TableCell>
                  <TableCell>CPU</TableCell>
                  <TableCell>Versione</TableCell>
                  <TableCell>Ultimo Restart</TableCell>
                  <TableCell>Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servicesList.map((service) => (
                  <TableRow key={service.name}>
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle2">
                        {service.displayName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={service.status}
                        color={getStatusColor(service.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{service.uptime}</TableCell>
                    <TableCell>{Math.round(service.responseTime)}ms</TableCell>
                    <TableCell>{Math.round(service.memory)}MB</TableCell>
                    <TableCell>{Math.round(service.cpu)}%</TableCell>
                    <TableCell>{service.version}</TableCell>
                    <TableCell>
                      {new Date(service.lastRestart).toLocaleString('it-IT')}
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small"
                        onClick={() => setSelectedService(service)}
                        color="primary"
                      >
                        <InfoIcon />
                      </IconButton>
                      <IconButton 
                        size="small"
                        onClick={() => setRestartDialog(service)}
                        color="warning"
                      >
                        <RestartIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Service Details Modal */}
      <Dialog
        open={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Dettagli {selectedService?.displayName}
        </DialogTitle>
        <DialogContent>
          {selectedService && (
            <Box>
              {/* Real-time metrics chart */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Metriche in Tempo Reale
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockMetricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="responseTime" 
                    stroke="#8B4513" 
                    strokeWidth={2}
                    name="Tempo Risposta (ms)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="memory" 
                    stroke="#DAA520" 
                    strokeWidth={2}
                    name="Memoria (MB)"
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Health Check Details */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Health Check
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }} variant="outlined">
                    <Typography variant="subtitle2" gutterBottom>
                      Stato Generale
                    </Typography>
                    <Chip
                      icon={getStatusIcon(selectedService.status)}
                      label={selectedService.status.toUpperCase()}
                      color={getStatusColor(selectedService.status)}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2 }} variant="outlined">
                    <Typography variant="subtitle2" gutterBottom>
                      Database Connection
                    </Typography>
                    <Chip
                      icon={<CheckIcon />}
                      label="CONNESSO"
                      color="success"
                    />
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedService(null)}>
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restart Confirmation Dialog */}
      <Dialog
        open={Boolean(restartDialog)}
        onClose={() => setRestartDialog(null)}
      >
        <DialogTitle>
          Conferma Riavvio
        </DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler riavviare il servizio <strong>{restartDialog?.displayName}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Il servizio sarà temporaneamente non disponibile durante il riavvio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestartDialog(null)}>
            Annulla
          </Button>
          <Button 
            onClick={() => handleRestartService(restartDialog?.name)}
            color="warning"
            variant="contained"
          >
            Riavvia
          </Button>
        </DialogActions>
      </Dialog>

      {/* Config Dialog */}
      <Dialog
        open={Boolean(configDialog)}
        onClose={() => setConfigDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Configurazione {configDialog?.displayName}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Configurazione del servizio disponibile nella prossima versione.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(null)}>
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminServices;