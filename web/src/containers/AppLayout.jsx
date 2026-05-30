import { Box, Container, Collapse } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuIcon from '@mui/icons-material/Menu';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import Alert from '@mui/material/Alert';
import { push as routerPush } from 'connected-react-router';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import { ignoreUpdate as ignoreUpdateAction } from '../actions/notifications';
import Hidden from '../components/Hidden';

const drawerWidth = 240;

function ResponsiveDrawer(props) {
  const { children, username, push, pathname, updateAvailable, ignoreUpdate } =
    props;
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  let currentPage = pathname.split('/')[1];
  if (currentPage === '') currentPage = 'dashboard';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const makeMenuItem = x => (
    <ListItem
      button
      key={x.key}
      selected={currentPage === x.key}
      onClick={() => {
        push(`/${x.key}`);
        setMobileOpen(false);
      }}
    >
      <ListItemIcon>{x.icon}</ListItemIcon>
      <ListItemText primary={x.text} />
    </ListItem>
  );

  const drawer = (
    <div>
      <Hidden smDown>
        <Toolbar />
        <Divider />
      </Hidden>
      <List>
        {[
          {
            key: 'dashboard',
            text: 'Übersicht',
            icon: <DashboardIcon />,
          },
          {
            key: 'stocks',
            text: 'Wertpapiere',
            icon: <AssessmentOutlinedIcon />,
          },
        ].map(makeMenuItem)}
      </List>
      <Divider />
      <List>
        {[
          {
            key: 'transactions',
            text: 'Transaktionen',
            icon: <ReceiptIcon />,
          },
          {
            key: 'accounts',
            text: 'Depots',
            icon: <CreditCardIcon />,
          },
        ].map(makeMenuItem)}
      </List>
      <Divider />
      <List>
        {[
          {
            key: 'settings',
            text: 'Einstellungen',
            icon: <SettingsIcon />,
          },
        ].map(makeMenuItem)}
      </List>
    </div>
  );

  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ zIndex: themeValue => themeValue.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Aktienverwaltung
          </Typography>
          <div>
            <Grid container spacing={0} alignItems="center" justify="center">
              <div>{username}</div>
              <div>
                <IconButton
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <AccountCircle />
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={open}
                  onClose={handleClose}
                >
                  <MenuItem
                    onClick={() => {
                      handleClose();
                      push('/logout');
                    }}
                  >
                    Ausloggen
                  </MenuItem>
                </Menu>
              </div>
            </Grid>
          </div>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Hidden mdUp>
          <SwipeableDrawer
            variant="temporary"
            anchor={theme.direction === 'rtl' ? 'right' : 'left'}
            open={mobileOpen}
            onClose={handleDrawerToggle}
            onOpen={handleDrawerToggle}
            disableBackdropTransition
            PaperProps={{ sx: { width: drawerWidth } }}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
          >
            {drawer}
          </SwipeableDrawer>
        </Hidden>
        <Hidden smDown>
          <Drawer
            PaperProps={{ sx: { width: drawerWidth } }}
            variant="permanent"
            open
          >
            {drawer}
          </Drawer>
        </Hidden>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, pt: 1 }}>
        <Toolbar />

        <div style={{ padding: '12px' }}>
          <Collapse in={updateAvailable}>
            <Container maxWidth="md" style={{ marginBottom: theme.spacing(3) }}>
              <Alert elevation={0} severity="info" onClose={ignoreUpdate}>
                Aktualisierung verfügbar, bitte die App neustarten!
              </Alert>
            </Container>
          </Collapse>
          {children}
        </div>
      </Box>
    </Box>
  );
}

ResponsiveDrawer.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  push: PropTypes.func.isRequired,
  username: PropTypes.string.isRequired,
  pathname: PropTypes.string.isRequired,
  updateAvailable: PropTypes.bool.isRequired,
  ignoreUpdate: PropTypes.func.isRequired,
};

const mapStateToProps = ({ authentication, router, notifications }) => ({
  username: authentication.userInfo.fullName,
  pathname: router.location.pathname,
  updateAvailable:
    notifications.updateAvailable && !notifications.updateIgnored,
});

const mapDispatchToProps = dispatch => ({
  push: x => dispatch(routerPush(x)),
  ignoreUpdate: () => dispatch(ignoreUpdateAction()),
});

export default connect(mapStateToProps, mapDispatchToProps)(ResponsiveDrawer);
