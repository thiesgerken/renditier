import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Face, Fingerprint, TrendingUp } from '@mui/icons-material';
import Alert from '@mui/material/Alert';

const Login = ({ onSubmit, message, messageType }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: theme => theme.palette.background.default,
        display: 'flex',
        minHeight: '100vh',
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="xs" disableGutters>
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: 'primary.main',
                  borderRadius: '50%',
                  color: 'primary.contrastText',
                  display: 'flex',
                  height: 48,
                  justifyContent: 'center',
                  width: 48,
                }}
              >
                <TrendingUp />
              </Box>
              <Typography component="h1" variant="h5">
                Aktienverwaltung
              </Typography>
            </Stack>
            <Box
              component="form"
              onSubmit={e => {
                e.preventDefault();
                onSubmit(username, password);
              }}
            >
              <Stack spacing={2.5}>
                <TextField
                  id="username"
                  label="Benutzername"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  type="username"
                  fullWidth
                  autoFocus
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Face />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  id="password"
                  label="Passwort"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  fullWidth
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Fingerprint />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  size="large"
                  fullWidth
                  sx={{ textTransform: 'none' }}
                >
                  Login
                </Button>
              </Stack>
            </Box>
            {message !== null && messageType !== null && (
              <Alert elevation={0} variant="filled" severity={messageType}>
                {message}
              </Alert>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

Login.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  message: PropTypes.string,
  messageType: PropTypes.string,
};

Login.defaultProps = {
  message: null,
  messageType: null,
};

export default Login;
