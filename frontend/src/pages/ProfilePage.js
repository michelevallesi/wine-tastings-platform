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
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api/apiClient';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    date_of_birth: user?.date_of_birth || '',
    preferences: {
      email_notifications: user?.preferences?.email_notifications !== false,
      marketing_emails: user?.preferences?.marketing_emails !== false,
      sms_notifications: user?.preferences?.sms_notifications !== false,
    }
  });

  const updateMutation = useMutation(
    (data) => updateProfile(data),
    {
      onSuccess: () => {
        setIsEditing(false);
        toast.success('Profilo aggiornato con successo!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Errore nell\'aggiornamento');
      }
    }
  );

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      date_of_birth: user?.date_of_birth || '',
      preferences: {
        email_notifications: user?.preferences?.email_notifications !== false,
        marketing_emails: user?.preferences?.marketing_emails !== false,
        sms_notifications: user?.preferences?.sms_notifications !== false,
      }
    });
    setIsEditing(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Il Mio Profilo
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Informazioni Personali
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

              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                  <Avatar
                    src={user?.profile_image}
                    alt={user?.name}
                    sx={{ 
                      width: 100, 
                      height: 100, 
                      mx: 'auto',
                      mb: 2,
                      bgcolor: 'primary.main',
                      fontSize: '2rem'
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  {isEditing && (
                    <Button size="small" variant="outlined">
                      Cambia Foto
                    </Button>
                  )}
                </Grid>

                <Grid item xs={12} sm={9}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Nome completo"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
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
                        label="Data di nascita"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                        disabled={!isEditing}
                        InputLabelProps={{
                          shrink: true,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Preferences */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferenze di Notifica
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.preferences.email_notifications}
                      onChange={(e) => handleInputChange('preferences.email_notifications', e.target.checked)}
                      disabled={!isEditing}
                    />
                  }
                  label="Notifiche email per prenotazioni"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.preferences.marketing_emails}
                      onChange={(e) => handleInputChange('preferences.marketing_emails', e.target.checked)}
                      disabled={!isEditing}
                    />
                  }
                  label="Email promozionali e offerte speciali"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.preferences.sms_notifications}
                      onChange={(e) => handleInputChange('preferences.sms_notifications', e.target.checked)}
                      disabled={!isEditing}
                    />
                  }
                  label="Notifiche SMS"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Informazioni Account
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Membro dal
                  </Typography>
                  <Typography variant="body2">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Ultima attività
                  </Typography>
                  <Typography variant="body2">
                    {user?.last_login ? new Date(user.last_login).toLocaleDateString('it-IT') : 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Stato account
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    Verificato ✓
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small">
                  Cambia Password
                </Button>
                <Button variant="outlined" color="error" size="small">
                  Elimina Account
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Alert */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Sicurezza:</strong> Per modifiche importanti come email o password, 
              riceverai una conferma via email. Mantieni sempre aggiornate le tue informazioni di contatto.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProfilePage;