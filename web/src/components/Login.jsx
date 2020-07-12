import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Grid,
  Container,
  TextField,
  Button,
  withStyles,
} from '@material-ui/core';
import { Face, Fingerprint } from '@material-ui/icons';
import Alert from '@material-ui/lab/Alert';

const styles = theme => ({
  margin: {
    margin: theme.spacing(2),
  },
  padding: {
    padding: theme.spacing(1),
  },
});

const Login = ({ onSubmit, message, messageType, classes }) => {
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
            <Paper className={classes.padding}>
              <div className={classes.margin}>
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
              </div>
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
  classes: PropTypes.shape({
    margin: PropTypes.string,
    padding: PropTypes.string,
  }).isRequired,
};

Login.defaultProps = {
  message: null,
  messageType: null,
};

export default withStyles(styles)(Login);
