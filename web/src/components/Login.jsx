import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Grid, Container, TextField, Button } from '@mui/material';
import { Face, Fingerprint } from '@mui/icons-material';
import Alert from '@mui/material/Alert';

const Login = ({ onSubmit, message, messageType }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div
      style={{
        position: 'absolute',
        left: '0%',
        top: '25%',
        transform: 'translate(0%, -25%)',
        width: '100%',
      }}
    >
      <Container maxWidth="sm" spacing={3}>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Paper sx={{ p: 1 }}>
              <Box sx={{ m: 2 }}>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    onSubmit(username, password);
                  }}
                >
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Grid container spacing={4} alignItems="flex-end">
                        <Grid item>
                          <Face />
                        </Grid>
                        <Grid item md sm xs>
                          <TextField
                            id="username"
                            label="Benutzername"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            type="username"
                            fullWidth
                            autoFocus
                            required
                          />
                        </Grid>
                      </Grid>
                      <Grid container spacing={4} alignItems="flex-end">
                        <Grid item>
                          <Fingerprint />
                        </Grid>
                        <Grid item md sm xs>
                          <TextField
                            id="password"
                            label="Passwort"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            fullWidth
                            required
                          />
                        </Grid>
                      </Grid>
                    </Grid>
                    <Grid
                      item
                      container
                      xs={12}
                      justify="center"
                      style={{ marginTop: '10px' }}
                    >
                      <Button
                        variant="outlined"
                        color="primary"
                        type="submit"
                        style={{ textTransform: 'none' }}
                      >
                        Login
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              </Box>
            </Paper>
          </Grid>
          {message !== null && messageType !== null && (
            <Grid item xs={12}>
              <Alert elevation={5} variant="filled" severity={messageType}>
                {message}
              </Alert>
            </Grid>
          )}
        </Grid>
      </Container>
    </div>
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
