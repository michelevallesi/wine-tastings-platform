import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  Popper,
  ClickAwayListener,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  LocalBar as WineIcon,
  Business as ProducerIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { api } from '../../services/api/apiClient';
import debounce from 'lodash.debounce';

const SearchBar = ({ placeholder = "Cerca degustazioni...", size = "small" }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const textFieldRef = useRef(null);

  // Debounced search function
  const debouncedSearch = useRef(
    debounce((term) => {
      if (term.length >= 2) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    }, 300)
  ).current;

  // Search suggestions query
  const { data: suggestions, isLoading } = useQuery(
    ['search-suggestions', searchTerm],
    () => api.packages.search({ 
      search: searchTerm, 
      limit: 8,
      suggestions: true 
    }),
    {
      enabled: searchTerm.length >= 2,
      select: (response) => response.data,
    }
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
    setAnchorEl(textFieldRef.current);
  }, [searchTerm, debouncedSearch]);

  const handleSearch = (term = searchTerm) => {
    if (term.trim()) {
      navigate(`/packages?search=${encodeURIComponent(term.trim())}`);
      setOpen(false);
      setSearchTerm('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'package') {
      navigate(`/packages/${suggestion.id}`);
    } else if (suggestion.type === 'producer') {
      navigate(`/producer/${suggestion.id}`);
    } else {
      handleSearch(suggestion.name);
    }
    setOpen(false);
    setSearchTerm('');
  };

  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'package':
        return <WineIcon />;
      case 'producer':
        return <ProducerIcon />;
      case 'location':
        return <LocationIcon />;
      default:
        return <SearchIcon />;
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: '100%' }}>
        <TextField
          ref={textFieldRef}
          placeholder={placeholder}
          variant="outlined"
          size={size}
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            if (searchTerm.length >= 2) setOpen(true);
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'white',
              '&:hover fieldset': {
                borderColor: 'primary.main',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton 
                  size="small" 
                  onClick={() => handleSearch()}
                  color="primary"
                >
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Popper
          open={open && !isLoading && suggestions?.suggestions?.length > 0}
          anchorEl={anchorEl}
          placement="bottom-start"
          style={{ width: anchorEl?.clientWidth, zIndex: 1300 }}
        >
          <Paper
            elevation={8}
            sx={{
              mt: 1,
              maxHeight: 400,
              overflow: 'auto',
              borderRadius: 2,
            }}
          >
            <List disablePadding>
              {suggestions?.suggestions?.map((suggestion, index) => (
                <ListItem
                  key={index}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                  divider={index < suggestions.suggestions.length - 1}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(139, 69, 19, 0.04)',
                    },
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    width: '100%',
                    gap: 2 
                  }}>
                    <Box sx={{ color: 'text.secondary' }}>
                      {getSuggestionIcon(suggestion.type)}
                    </Box>
                    
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {suggestion.name}
                      </Typography>
                      {suggestion.subtitle && (
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {suggestion.subtitle}
                        </Typography>
                      )}
                    </Box>

                    {suggestion.type && (
                      <Chip
                        label={suggestion.type}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </ListItem>
              ))}

              {/* Search all results option */}
              <ListItem
                button
                onClick={() => handleSearch()}
                sx={{
                  backgroundColor: 'rgba(139, 69, 19, 0.02)',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  width: '100%',
                  gap: 2 
                }}>
                  <SearchIcon color="primary" />
                  <Typography variant="body2" color="primary">
                    Cerca "{searchTerm}" in tutte le degustazioni
                  </Typography>
                </Box>
              </ListItem>
            </List>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default SearchBar;