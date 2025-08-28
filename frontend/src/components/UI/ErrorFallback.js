import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Alert,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <ErrorIcon 
          sx={{ 
            fontSize: 80, 
            color: 'error.main', 
            mb: 3 
          }} 
        />
        
        <Typography variant="h4" gutterBottom>
          Oops! Qualcosa è andato storto
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          Si è verificato un errore imprevisto. Il nostro team è stato notificato 
          e stiamo lavorando per risolvere il problema.
        </Typography>

        {isDevelopment && error && (
          <Alert severity="error" sx={{ textAlign: 'left', mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Error Details (Development):
            </Typography>
            <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
              {error.message}
              {error.stack && `\\n\\n${error.stack}`}
            </Typography>
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={resetErrorBoundary}
          >
            Riprova
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => window.location.href = '/'}
          >
            Torna alla Home
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>
          Se il problema persiste, contatta il nostro supporto: support@vinbooking.com
        </Typography>
      </Paper>
    </Container>
  );
};

export default ErrorFallback;
