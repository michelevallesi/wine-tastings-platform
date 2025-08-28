import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Container,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  LocalBar as WineIcon,
  AccountCircle as AccountIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  ExitToApp as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import SearchBar from '../Search/SearchBar';

const Header = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/');
  };

  const handleDashboard = () => {
    handleClose();
    if (hasRole('admin')) {
      navigate('/admin');
    } else if (hasRole('producer')) {
      navigate('/producer-dashboard');
    } else {
      navigate('/profile');
    }
  };

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Degustazioni', path: '/packages' },
    { label: 'Produttori', path: '/producers' },
  ];

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        backgroundColor: 'white',
        color: 'text.primary',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Logo */}
          <Box 
            component={RouterLink} 
            to="/" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <WineIcon 
              sx={{ 
                fontSize: 32, 
                color: theme.palette.primary.main,
                mr: 1,
              }} 
            />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.main,
                display: { xs: 'none', sm: 'block' }
              }}
            >
              VinBooking
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  sx={{
                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    fontWeight: location.pathname === item.path ? 600 : 400,
                    '&:hover': {
                      backgroundColor: 'rgba(139, 69, 19, 0.04)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Search Bar */}
          <Box sx={{ flexGrow: 1, mx: 3, maxWidth: 400 }}>
            <SearchBar />
          </Box>

          {/* User Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <Avatar
                    src={user?.profile_image}
                    alt={user?.name}
                    sx={{ 
                      width: 32, 
                      height: 32,
                      bgcolor: theme.palette.primary.main,
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                >
                  <MenuItem disabled>
                    <Typography variant="subtitle2">
                      {user?.name}
                    </Typography>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleDashboard}>
                    <DashboardIcon sx={{ mr: 1 }} />
                    {hasRole('admin') ? 'Admin Panel' : 
                     hasRole('producer') ? 'Dashboard' : 'Il Mio Profilo'}
                  </MenuItem>
                  {hasRole('customer') && (
                    <MenuItem 
                      component={RouterLink} 
                      to="/my-bookings"
                      onClick={handleClose}
                    >
                      Le Mie Prenotazioni
                    </MenuItem>
                  )}
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="small"
                >
                  Login
                </Button>
                <Button 
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="small"
                >
                  Registrati
                </Button>
              </Box>
            )}

            {/* Mobile Menu */}
            {isMobile && (
              <>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  onClick={() => setMobileMenuOpen(true)}
                  sx={{ ml: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                <Drawer
                  anchor="right"
                  open={mobileMenuOpen}
                  onClose={() => setMobileMenuOpen(false)}
                >
                  <Box sx={{ width: 250 }} role="presentation">
                    <List>
                      {navItems.map((item) => (
                        <ListItem 
                          key={item.path}
                          component={RouterLink}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <ListItemText primary={item.label} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Drawer>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;