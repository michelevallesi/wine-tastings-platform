import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fab,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../../services/api/apiClient';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ProducerPackages = () => {
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const { data: packagesData, isLoading } = useQuery(
    ['producer-packages'],
    () => api.packages.getProducerPackages(),
    {
      select: (response) => response.data,
    }
  );

  const deleteMutation = useMutation(
    (packageId) => api.packages.delete(packageId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['producer-packages']);
        toast.success('Esperienza eliminata con successo');
        setDeleteDialog(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nell\'eliminazione');
      }
    }
  );

  const toggleActiveMutation = useMutation(
    ({ packageId, is_active }) => api.packages.toggleActive(packageId, { is_active }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['producer-packages']);
        toast.success('Stato esperienza aggiornato');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nell\'aggiornamento');
      }
    }
  );

  const handleMenuClick = (event, pkg) => {
    setAnchorEl(event.currentTarget);
    setSelectedPackage(pkg);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPackage(null);
  };

  const handleDelete = () => {
    if (selectedPackage) {
      deleteMutation.mutate(selectedPackage.id);
    }
    handleMenuClose();
  };

  const handleToggleActive = () => {
    if (selectedPackage) {
      toggleActiveMutation.mutate({
        packageId: selectedPackage.id,
        is_active: !selectedPackage.is_active
      });
    }
    handleMenuClose();
  };

  const getStatusChip = (pkg) => {
    if (!pkg.is_active) {
      return <Chip label="Nascosta" color="default" size="small" />;
    }
    if (pkg.status === 'published') {
      return <Chip label="Pubblicata" color="success" size="small" />;
    }
    if (pkg.status === 'draft') {
      return <Chip label="Bozza" color="warning" size="small" />;
    }
    return <Chip label="In Revisione" color="info" size="small" />;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const packages = packagesData?.packages || [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Le Tue Esperienze
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestisci tutte le degustazioni che offri ai visitatori
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

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {packages.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Esperienze Totali
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {packages.filter(p => p.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Attive
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {packages.filter(p => p.status === 'draft').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bozze
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {packages.reduce((sum, p) => sum + (p.total_bookings || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prenotazioni
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nessuna esperienza creata
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Inizia creando la tua prima degustazione per attirare visitatori alla tua cantina
          </Typography>
          <Button
            component={RouterLink}
            to="/producer/packages/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            Crea Prima Esperienza
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {packages.map((pkg) => (
            <Grid item xs={12} sm={6} md={4} key={pkg.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={pkg.images?.[0] || '/images/wine-default.jpg'}
                  alt={pkg.name}
                />
                
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {pkg.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, pkg)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    {getStatusChip(pkg)}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {pkg.description?.substring(0, 100)}...
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" color="primary.main">
                      {formatCurrency(pkg.price)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {pkg.total_bookings || 0} prenotazioni
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button
                    component={RouterLink}
                    to={`/producer/packages/${pkg.id}/edit`}
                    startIcon={<EditIcon />}
                    size="small"
                  >
                    Modifica
                  </Button>
                  <Button
                    component="a"
                    href={`/packages/${pkg.id}`}
                    target="_blank"
                    startIcon={<ViewIcon />}
                    size="small"
                  >
                    Anteprima
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          component={RouterLink}
          to={`/producer/packages/${selectedPackage?.id}/edit`}
          onClick={handleMenuClose}
        >
          <EditIcon sx={{ mr: 1 }} />
          Modifica
        </MenuItem>
        
        <MenuItem onClick={handleToggleActive}>
          {selectedPackage?.is_active ? (
            <>
              <HideIcon sx={{ mr: 1 }} />
              Nascondi
            </>
          ) : (
            <>
              <ViewIcon sx={{ mr: 1 }} />
              Pubblica
            </>
          )}
        </MenuItem>
        
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Elimina
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare "{selectedPackage?.name}"? 
            Questa azione non può essere annullata e verranno eliminate 
            anche tutte le prenotazioni associate.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Annulla</Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? <CircularProgress size={20} /> : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        component={RouterLink}
        to="/producer/packages/new"
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default ProducerPackages;