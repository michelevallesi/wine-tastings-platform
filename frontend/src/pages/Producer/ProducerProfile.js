import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api/apiClient';
import toast from 'react-hot-toast';

const ProducerProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [specialtyDialog, setSpecialtyDialog] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    founded_year: '',
    specialties: [],
    is_active: true,
  });

  const { data: producerData, isLoading } = useQuery(
    ['producer-profile', user?.producer_id],
    () => api.producers.getProfile(),
    {
      enabled: !!user?.producer_id,
      onSuccess: (data) => {
        setFormData({
          name: data.data.name || '',
          description: data.data.description || '',
          address: data.data.address || '',
          phone: data.data.phone || '',
          email: data.data.email || '',
          website: data.data.website || '',
          founded_year: data.data.founded_year || '',
          specialties: data.data.specialties || [],
          is_active: data.data.is_active !== false,
        });
      }
    }
  );

  const updateMutation = useMutation(
    (data) => api.producers.updateProfile(data),
    {
      onSuccess: () => {
        setIsEditing(false);
        queryClient.invalidateQueries(['producer-profile']);
        toast.success('Profilo aggiornato con successo!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nell\'aggiornamento');
      }
    }
  );

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (producerData?.data) {
      setFormData({
        name: producerData.data.name || '',
        description: producerData.data.description || '',
        address: producerData.data.address || '',
        phone: producerData.data.phone || '',
        email: producerData.data.email || '',
        website: producerData.data.website || '',
        founded_year: producerData.data.founded_year || '',
        specialties: producerData.data.specialties || [],
        is_active: producerData.data.is_active !== false,
      });
    }
    setIsEditing(false);
  };

  const handleAddSpecialty = () => {
    if (newSpecialty.trim()) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty.trim()]
      }));
      setNewSpecialty('');
      setSpecialtyDialog(false);
    }
  };

  const handleRemoveSpecialty = (index) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const producer = producerData?.data;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Profilo Cantina
        </Typography>
        
        {producer?.verified && (
          <Chip
            icon={<VerifiedIcon />}
            label="Cantina Verificata"
            color="success"
            variant="filled"
          />
        )}
      </Box>

      <Grid container spacing={4}>
        {/* Basic Information */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Informazioni Generali
                </Typography>
                
                {!isEditing ? (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditing(true)}
                  >
                    Modifica
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<SaveIcon />}
                      variant="contained"
                      onClick={handleSave}
                      disabled={updateMutation.isLoading}
                    >
                      {updateMutation.isLoading ? <CircularProgress size={20} /> : 'Salva'}
                    </Button>
                    <Button
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                    >
                      Annulla
                    </Button>
                  </Box>
                )}
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nome Cantina"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Anno di Fondazione"
                    type="number"
                    value={formData.founded_year}
                    onChange={(e) => handleInputChange('founded_year', e.target.value)}
                    disabled={!isEditing}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Descrizione della Cantina"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={!isEditing}
                    helperText="Racconta la storia della tua cantina, i tuoi valori e cosa rende speciali i tuoi vini"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Indirizzo"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Telefono"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditing}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Sito Web"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    disabled={!isEditing}
                    placeholder="https://www.tuacantina.it"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Cantina attiva per prenotazioni"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Specialties */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Specialità della Cantina
                </Typography>
                
                {isEditing && (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setSpecialtyDialog(true)}
                    size="small"
                  >
                    Aggiungi
                  </Button>
                )}
              </Box>

              {formData.specialties.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nessuna specialità aggiunta
                </Typography>
              ) : (
                <List>
                  {formData.specialties.map((specialty, index) => (
                    <ListItem key={index} divider>
                      <ListItemText primary={specialty} />
                      {isEditing && (
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleRemoveSpecialty(index)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Profile Status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stato del Profilo
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Completezza profilo
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    85%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Stato
                  </Typography>
                  <Chip 
                    label={producer?.status === 'approved' ? 'Approvato' : 'In Revisione'} 
                    color={producer?.status === 'approved' ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Membro dal
                  </Typography>
                  <Typography variant="body2">
                    {producer?.created_at ? new Date(producer.created_at).toLocaleDateString('it-IT') : 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistiche
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Esperienze offerte
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {producer?.packages_count || 0}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Prenotazioni totali
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {producer?.total_bookings || 0}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Rating medio
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {(producer?.avg_rating || 0).toFixed(1)}⭐
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Recensioni
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {producer?.review_count || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Suggerimenti
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Completa il profilo"
                    secondary="Un profilo completo attira più visitatori"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Aggiungi foto di qualità"
                    secondary="Le immagini aumentano le prenotazioni del 40%"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Rispondi alle recensioni"
                    secondary="Mostra che tieni ai tuoi ospiti"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Specialty Dialog */}
      <Dialog open={specialtyDialog} onClose={() => setSpecialtyDialog(false)}>
        <DialogTitle>Aggiungi Specialità</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Specialità"
            value={newSpecialty}
            onChange={(e) => setNewSpecialty(e.target.value)}
            margin="dense"
            placeholder="es. Barolo DOCG, Degustazioni in vigna..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpecialtyDialog(false)}>Annulla</Button>
          <Button onClick={handleAddSpecialty} variant="contained">Aggiungi</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProducerProfile;