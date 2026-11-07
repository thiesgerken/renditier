import { Box, Container, Collapse } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Stack from '@mui/material/Stack';
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
import React from 'react';
import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { ignoreUpdate as ignoreUpdateAction } from '../slices/notifications';
import Hidden from '../components/Hidden';
import type { AppDispatch, RootState } from '../store';

const drawerWidth = 240;

// One entry of the drawer's navigation lists; `key` doubles as the route path.
interface MenuEntry {
  key: string;
  text: string;
  icon: React.ReactNode;
}

function ResponsiveDrawer(props: Props) {
  const { children, username, updateAvailable, ignoreUpdate } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  let currentPage = location.pathname.split('/')[1];
  if (currentPage === '') currentPage = 'dashboard';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const makeMenuItem = (x: MenuEntry) => (
    <ListItem key={x.key} disablePadding>
      <ListItemButton
        selected={currentPage === x.key}
        onClick={() => {
          navigate(`/${x.key}`);
          setMobileOpen(false);
        }}
      >
        <ListItemIcon>{x.icon}</ListItemIcon>
        <ListItemText primary={x.text} />
      </ListItemButton>
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

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        sx={{ zIndex: (themeValue: Theme) => themeValue.zIndex.drawer + 1 }}
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
            <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
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
                      navigate('/logout');
                    }}
                  >
                    Ausloggen
                  </MenuItem>
                </Menu>
              </div>
            </Stack>
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
            slotProps={{ paper: { sx: { width: drawerWidth } } }}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
          >
            {drawer}
          </SwipeableDrawer>
        </Hidden>
        <Hidden smDown>
          <Drawer
            slotProps={{ paper: { sx: { width: drawerWidth } } }}
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

const mapStateToProps = ({ authentication, notifications }: RootState) => ({
  // FIXME(tsx-migration): was `authentication.userInfo.fullName`, which throws
  // when userInfo is null. App only mounts this layout once logged in, so the
  // path is unreachable today, but the state type admits null.
  username: authentication.userInfo?.fullName ?? null,
  updateAvailable:
    notifications.updateAvailable && !notifications.updateIgnored,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  ignoreUpdate: () => dispatch(ignoreUpdateAction()),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector> & {
  children: React.ReactNode;
};

export default connector(ResponsiveDrawer);
