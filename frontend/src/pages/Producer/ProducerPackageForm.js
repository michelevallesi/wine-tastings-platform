import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../../services/api/apiClient';
import toast from 'react-hot-toast';

const ProducerPackageForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    short_description: '',
    price: '',
    duration: '',
    max_participants: '',
    difficulty_level: 'beginner',
    category: 'wine_tasting',
    location: '',
    inclusions: [],
    requirements: '',
    cancellation_policy: '',
    is_active: true,
  });

  const [newInclusion, setNewInclusion] = useState('');

  const { data: packageData, isLoading } = useQuery(
    ['package', id],
    () => api.packages.getById(id),
    {
      enabled: isEdit,
      onSuccess: (response) => {
        const pkg = response.data.package;
        setFormData({
          name: pkg.name || '',
          description: pkg.description || '',
          short_description: pkg.short_description || '',
          price: pkg.price?.toString() || '',
          duration: pkg.duration?.toString() || '',
          max_participants: pkg.max_participants?.toString() || '',
          difficulty_level: pkg.difficulty_level || 'beginner',
          category: pkg.category || 'wine_tasting',
          location: pkg.location || '',
          inclusions: pkg.inclusions || [],
          requirements: pkg.requirements || '',
          cancellation_policy: pkg.cancellation_policy || '',
          is_active: pkg.is_active !== false,
        });
      }
    }
  );

  const saveMutation = useMutation(
    (data) => isEdit ? api.packages.update(id, data) : api.packages.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['producer-packages']);
        toast.success(isEdit ? 'Esperienza aggiornata!' : 'Esperienza creata!');
        navigate('/producer/packages');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nel salvataggio');
      }
    }
  );

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddInclusion = () => {
    if (newInclusion.trim()) {
      setFormData(prev => ({
        ...prev,
        inclusions: [...prev.inclusions, newInclusion.trim()]
      }));
      setNewInclusion('');
    }
  };

  const handleRemoveInclusion = (index) => {
    setFormData(prev => ({
      ...prev,
      inclusions: prev.inclusions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      ...formData,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      max_participants: parseInt(formData.max_participants),
    };

    saveMutation.mutate(dataToSave);
  };

  const handleCancel = () => {
    navigate('/producer/packages');
  };

  if (isEdit && isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {isEdit ? 'Modifica Esperienza' : 'Nuova Esperienza'}
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {isEdit ? 'Aggiorna i dettagli della tua esperienza' : 'Crea una nuova esperienza vinicola per i tuoi ospiti'}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informazioni di Base
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Nome dell'Esperienza"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                      helperText="Un nome accattivante che descriva la tua esperienza"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrizione Breve"
                      value={formData.short_description}
                      onChange={(e) => handleInputChange('short_description', e.target.value)}
                      required
                      multiline
                      rows={2}
                      helperText="Una breve descrizione che appare nelle anteprime (max 200 caratteri)"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrizione Completa"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      required
                      multiline
                      rows={6}
                      helperText="Descrivi dettagliatamente l'esperienza, cosa include e cosa la rende speciale"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Prezzo"
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      required
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€</InputAdornment>,
                      }}
                      helperText="Prezzo per persona"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Durata"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      required
                      InputProps={{
                        endAdornment: <InputAdornment position="end">minuti</InputAdornment>,
                      }}
                      helperText="Durata dell'esperienza in minuti"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Details */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Dettagli dell'Esperienza
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Numero Massimo Partecipanti"
                      type="number"
                      value={formData.max_participants}
                      onChange={(e) => handleInputChange('max_participants', e.target.value)}
                      required
                      inputProps={{ min: 1, max: 50 }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Livello di Difficoltà</InputLabel>
                      <Select
                        value={formData.difficulty_level}
                        label="Livello di Difficoltà"
                        onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
                      >
                        <MenuItem value="beginner">Principiante</MenuItem>
                        <MenuItem value="intermediate">Intermedio</MenuItem>
                        <MenuItem value="advanced">Avanzato</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Categoria</InputLabel>
                      <Select
                        value={formData.category}
                        label="Categoria"
                        onChange={(e) => handleInputChange('category', e.target.value)}
                      >
                        <MenuItem value="wine_tasting">Degustazione Vini</MenuItem>
                        <MenuItem value="vineyard_tour">Tour in Vigna</MenuItem>
                        <MenuItem value="food_pairing">Abbinamento Cibo e Vino</MenuItem>
                        <MenuItem value="masterclass">Masterclass</MenuItem>
                        <MenuItem value="harvest">Vendemmia</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Località"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      required
                      helperText="es. Alba, Piemonte"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Inclusions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cosa è Incluso
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Aggiungi inclusione"
                    value={newInclusion}
                    onChange={(e) => setNewInclusion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInclusion()}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button onClick={handleAddInclusion}>Aggiungi</Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.inclusions.map((inclusion, index) => (
                    <Chip
                      key={index}
                      label={inclusion}
                      onDelete={() => handleRemoveInclusion(index)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Additional Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informazioni Aggiuntive
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Requisiti"
                      value={formData.requirements}
                      onChange={(e) => handleInputChange('requirements', e.target.value)}
                      multiline
                      rows={3}
                      helperText="Eventuali requisiti per i partecipanti (età minima, abbigliamento, etc.)"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Politica di Cancellazione"
                      value={formData.cancellation_policy}
                      onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
                      multiline
                      rows={3}
                      helperText="Descrivi la tua politica di cancellazione"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={handleCancel}
                startIcon={<CancelIcon />}
                size="large"
              >
                Annulla
              </Button>
              
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                size="large"
                disabled={saveMutation.isLoading}
              >
                {saveMutation.isLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  isEdit ? 'Salva Modifiche' : 'Crea Esperienza'
                )}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
};

export default ProducerPackageForm;