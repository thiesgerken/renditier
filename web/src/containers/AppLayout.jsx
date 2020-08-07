import { Container, Collapse } from '@material-ui/core';
import AppBar from '@material-ui/core/AppBar';
import CssBaseline from '@material-ui/core/CssBaseline';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import Grid from '@material-ui/core/Grid';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import AccountCircle from '@material-ui/icons/AccountCircle';
import AssessmentOutlinedIcon from '@material-ui/icons/AssessmentOutlined';
import CreditCardIcon from '@material-ui/icons/CreditCard';
import DashboardIcon from '@material-ui/icons/Dashboard';
import MenuIcon from '@material-ui/icons/Menu';
import ReceiptIcon from '@material-ui/icons/Receipt';
import SettingsIcon from '@material-ui/icons/Settings';
import Alert from '@material-ui/lab/Alert';
import { push as routerPush } from 'connected-react-router';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import { ignoreUpdate as ignoreUpdateAction } from '../actions/notifications';

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  drawer: {
    [theme.breakpoints.up('md')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    flexGrow: 1,
    'padding-top': theme.spacing(1),
  },
  title: {
    flexGrow: 1,
  },
}));

function ResponsiveDrawer(props) {
  const {
    children,
    username,
    push,
    pathname,
    updateAvailable,
    ignoreUpdate,
  } = props;
  const classes = useStyles();
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
        <div className={classes.toolbar} />
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
    <div className={classes.root}>
      <CssBaseline />
      <AppBar position="fixed" className={classes.appBar}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            className={classes.menuButton}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap className={classes.title}>
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
      <nav className={classes.drawer}>
        <Hidden mdUp>
          <SwipeableDrawer
            variant="temporary"
            anchor={theme.direction === 'rtl' ? 'right' : 'left'}
            open={mobileOpen}
            onClose={handleDrawerToggle}
            onOpen={handleDrawerToggle}
            disableBackdropTransition
            classes={{
              paper: classes.drawerPaper,
            }}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
          >
            {drawer}
          </SwipeableDrawer>
        </Hidden>
        <Hidden smDown>
          <Drawer
            classes={{
              paper: classes.drawerPaper,
            }}
            variant="permanent"
            open
          >
            {drawer}
          </Drawer>
        </Hidden>
      </nav>
      <main className={classes.content}>
        <div className={classes.toolbar} />

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
      </main>
    </div>
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
