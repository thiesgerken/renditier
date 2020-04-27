import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  useTheme,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@material-ui/core';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { map } from 'lodash';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import moment from 'moment';
import { findStock, abbreviateTitle } from '../selectors/stocks';

const ReceiptUploadDialog = ({ receipts, stocks, open, onClose }) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Dialog
      fullScreen={!mdUp}
      open={open && (receipts.isUploading || receipts.lastUpload !== null)}
      disableBackdropClick
      onClose={onClose}
    >
      <DialogTitle id="form-dialog-title">Abrechnungen hochladen</DialogTitle>
      <DialogContent>
        {receipts.isUploading && (
          <div style={{ width: '100%', height: '5em' }}>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '30%',
                transform: 'translate(-50%, 50%)',
                // width: '0%',
                // height: '0%',
                padding: '0px',
                margin: 0,
                zIndex: 9,
              }}
            >
              <CircularProgress color="secondary" />
            </div>
          </div>
        )}
        {!receipts.isUploading && receipts.uploadError !== null && (
          <Alert severity="error">
            <AlertTitle>Fehler beim Upload</AlertTitle>
            {receipts.uploadError.toString()}
          </Alert>
        )}
        {!receipts.isUploading && receipts.data !== null && (
          <>
            <Alert severity={receipts.data.length > 0 ? 'success' : 'info'}>
              <AlertTitle>Erfolgreich</AlertTitle>
              {receipts.data.length === 1
                ? `Es wurde eine Transaktion hinzugefügt.`
                : `Es wurden ${receipts.data.length} Transaktionen hinzugefügt.`}
            </Alert>
            <List dense>
              {map(receipts.data, x => {
                let stock = findStock(stocks, x.isin);
                stock = stock ? abbreviateTitle(stock.title, true) : x.isin;

                return (
                  <ListItem>
                    <ListItemText
                      primary={`${moment(x.date).format(
                        'L'
                      )}: ${x.units.toFixed(2)} von ${stock} für ${(
                        x.amount / 100
                      ).toFixed(2)}€`}
                    />
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="primary" onClick={onClose}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ReceiptUploadDialog.propTypes = {
  receipts: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isUploading: PropTypes.bool,
    uploadError: PropTypes.string,
    lastUpload: PropTypes.instanceOf(Date),
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const mapStateToProps = state => {
  const { receipts, stocks } = state;

  return {
    receipts,
    stocks,
  };
};

export default connect(mapStateToProps)(ReceiptUploadDialog);
