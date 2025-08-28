import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  EventNote as BookingsIcon,
  Business as ProducersIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Storage as ServicesIcon,
  LocalBar as WineIcon,
  Inventory as PackagesIcon,
  Assessment as ReportsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useAdmin } from '../../contexts/AdminContext';

const drawerWidth = 280;

const AdminLayout = ({ isProducer = false }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  
  const { user, logout } = useAuth();
  const { services, producers } = useAdmin();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

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

  // Admin menu items
  const adminMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin', exact: true },
    { text: 'Microservizi', icon: <ServicesIcon />, path: '/admin/services' },
    { text: 'Utenti', icon: <PeopleIcon />, path: '/admin/users' },
    { text: 'Prenotazioni', icon: <BookingsIcon />, path: '/admin/bookings' },
    { 
      text: 'Produttori', 
      icon: <ProducersIcon />, 
      path: '/admin/producers',
      badge: producers.pending > 0 ? producers.pending : null
    },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/admin/analytics' },
    { text: 'Impostazioni', icon: <SettingsIcon />, path: '/admin/settings' },
  ];

  // Producer menu items
  const producerMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/producer-dashboard', exact: true },
    { text: 'Pacchetti', icon: <PackagesIcon />, path: '/producer-dashboard/packages' },
    { text: 'Prenotazioni', icon: <BookingsIcon />, path: '/producer-dashboard/bookings' },
    { text: 'Analytics', icon: <ReportsIcon />, path: '/producer-dashboard/analytics' },
    { text: 'Profilo', icon: <AccountIcon />, path: '/producer-dashboard/profile' },
  ];

  const menuItems = isProducer ? producerMenuItems : adminMenuItems;

  // Count unhealthy services for badge
  const unhealthyServices = Object.values(services.status).filter(
    service => service.status !== 'healthy'
  ).length;

  const drawer = (
    <div>
      <Toolbar sx={{ 
        background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
        color: 'white',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
      }}>
        <WineIcon sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h6" noWrap component="div" textAlign="center">
          {isProducer ? 'Produttore' : 'Admin'} Panel
        </Typography>
        <Typography variant="caption" textAlign="center" sx={{ opacity: 0.8 }}>
          VinBooking Platform
        </Typography>
      </Toolbar>
      
      <Divider />
      
      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item, index) => {
          const isActive = item.exact 
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
            
          return (
            <ListItem
              key={item.text}
              component={Link}
              to={item.path}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                backgroundColor: isActive ? 'rgba(139, 69, 19, 0.1)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(139, 69, 19, 0.05)',
                },
                '& .MuiListItemText-primary': {
                  color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                  fontWeight: isActive ? 600 : 400,
                },
                '& .MuiListItemIcon-root': {
                  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                },
              }}
            >
              <ListItemIcon>
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* System Status */}
      {!isProducer && (
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Stato Sistema
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              label={`Servizi: ${Object.keys(services.status).length}`}
              color={unhealthyServices === 0 ? 'success' : 'warning'}
              variant="outlined"
            />
            {unhealthyServices > 0 && (
              <Chip
                size="small"
                label={`Problemi: ${unhealthyServices}`}
                color="error"
                variant="outlined"
              />
            )}
            <Chip
              size="small"
              label={`Utenti: ${user?.name}`}
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>
      )}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          backgroundColor: 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => 
              item.exact 
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path)
            )?.text || 'Dashboard'}
          </Typography>

          {/* Notifications */}
          <IconButton size="large" color="inherit">
            <Badge badgeContent={unhealthyServices} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* User Menu */}
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
                bgcolor: theme.palette.primary.main 
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
                {user?.name} ({user?.role})
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleClose(); navigate('/'); }}>
              <ListItemIcon>
                <WineIcon fontSize="small" />
              </ListItemIcon>
              Vai al Sito
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: '1px solid rgba(0,0,0,0.12)',
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: '1px solid rgba(0,0,0,0.12)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: '#fafafa',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;