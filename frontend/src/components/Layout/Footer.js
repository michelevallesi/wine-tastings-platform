import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Typography,
  Link,
  IconButton,
  Divider,
} from '@mui/material';
import {
  LocalBar as WineIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Twitter as TwitterIcon,
  YouTube as YouTubeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { label: 'Come Funziona', href: '/how-it-works' },
      { label: 'Per i Produttori', href: '/for-producers' },
      { label: 'Gift Card', href: '/gift-cards' },
      { label: 'Recensioni', href: '/reviews' },
    ],
    support: [
      { label: 'Centro Assistenza', href: '/help' },
      { label: 'Contatti', href: '/contact' },
      { label: 'Domande Frequenti', href: '/faq' },
      { label: 'Sicurezza', href: '/safety' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Termini di Servizio', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Cancellation Policy', href: '/cancellation' },
    ],
    discover: [
      { label: 'Piemonte', href: '/packages?region=piemonte' },
      { label: 'Toscana', href: '/packages?region=toscana' },
      { label: 'Veneto', href: '/packages?region=veneto' },
      { label: 'Sicilia', href: '/packages?region=sicilia' },
    ],
  };

  const socialLinks = [
    { icon: <FacebookIcon />, href: 'https://facebook.com/vinbooking', label: 'Facebook' },
    { icon: <InstagramIcon />, href: 'https://instagram.com/vinbooking', label: 'Instagram' },
    { icon: <TwitterIcon />, href: 'https://twitter.com/vinbooking', label: 'Twitter' },
    { icon: <YouTubeIcon />, href: 'https://youtube.com/vinbooking', label: 'YouTube' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#2E2E2E',
        color: 'white',
        pt: 6,
        pb: 2,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        {/* Main Footer Content */}
        <Grid container spacing={4}>
          {/* Brand and Description */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <WineIcon sx={{ fontSize: 32, mr: 1, color: '#DAA520' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                VinBooking
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: 3, color: '#B0B0B0' }}>
              La piattaforma leader per prenotare degustazioni vinicole 
              nelle migliori cantine d'Italia. Scopri esperienze autentiche 
              e tradizioni secolari.
            </Typography>
            
            {/* Social Links */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {socialLinks.map((social, index) => (
                <IconButton
                  key={index}
                  component="a"
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  sx={{
                    color: '#B0B0B0',
                    '&:hover': {
                      color: '#DAA520',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>
          </Grid>

          {/* Platform Links */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Piattaforma
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {footerLinks.platform.map((link, index) => (
                <Link
                  key={index}
                  component={RouterLink}
                  to={link.href}
                  sx={{
                    color: '#B0B0B0',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': {
                      color: '#DAA520',
                    },
                    transition: 'color 0.3s ease',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Support Links */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Supporto
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {footerLinks.support.map((link, index) => (
                <Link
                  key={index}
                  component={RouterLink}
                  to={link.href}
                  sx={{
                    color: '#B0B0B0',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': {
                      color: '#DAA520',
                    },
                    transition: 'color 0.3s ease',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Discover Links */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Scopri
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {footerLinks.discover.map((link, index) => (
                <Link
                  key={index}
                  component={RouterLink}
                  to={link.href}
                  sx={{
                    color: '#B0B0B0',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': {
                      color: '#DAA520',
                    },
                    transition: 'color 0.3s ease',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Contatti
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon sx={{ fontSize: 18, color: '#DAA520' }} />
                <Link
                  href="mailto:info@vinbooking.com"
                  sx={{
                    color: '#B0B0B0',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': { color: '#DAA520' },
                  }}
                >
                  info@vinbooking.com
                </Link>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon sx={{ fontSize: 18, color: '#DAA520' }} />
                <Link
                  href="tel:+390123456789"
                  sx={{
                    color: '#B0B0B0',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': { color: '#DAA520' },
                  }}
                >
                  +39 012 345 6789
                </Link>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <LocationIcon sx={{ fontSize: 18, color: '#DAA520', mt: 0.2 }} />
                <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                  Via del Vino 123<br />
                  00100 Roma, Italia
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: '#4A4A4A' }} />

        {/* Bottom Footer */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            © {currentYear} VinBooking. Tutti i diritti riservati.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', md: 'flex-end' },
            }}
          >
            {footerLinks.legal.map((link, index) => (
              <Link
                key={index}
                component={RouterLink}
                to={link.href}
                sx={{
                  color: '#B0B0B0',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  '&:hover': {
                    color: '#DAA520',
                  },
                  transition: 'color 0.3s ease',
                }}
              >
                {link.label}
              </Link>
            ))}
          </Box>
        </Box>

        {/* Trust Indicators */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            mt: 3,
            pt: 2,
            borderTop: '1px solid #4A4A4A',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            🔒 Pagamenti Sicuri | 🛡️ Dati Protetti | ⭐ 4.9/5 Rating
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;