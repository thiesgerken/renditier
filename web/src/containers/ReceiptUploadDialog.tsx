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
} from '@mui/material';
import type { DialogProps } from '@mui/material';
import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import { map } from 'lodash';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { findStock, abbreviateTitle } from '../selectors/stocks';
import { formatCurrency, formatDate, formatNumber } from '../format';
import type { RootState } from '../store';

type Props = ConnectedProps<typeof connector> & {
  open: boolean;
  onClose: () => void;
};

const ReceiptUploadDialog = ({ receipts, stocks, open, onClose }: Props) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const handleDialogClose: DialogProps['onClose'] = (_event, reason) => {
    if (reason === 'backdropClick') return;

    onClose();
  };

  return (
    <Dialog
      fullScreen={!mdUp}
      open={open && (receipts.isUploading || receipts.lastUpload !== null)}
      onClose={handleDialogClose}
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
            {receipts.uploadError.message}
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
                // `findStock` returns the Stock row; the rendered label is a
                // string, so the two cannot share one binding under TS.
                const found = findStock(stocks, x.isin);
                const stock = found
                  ? abbreviateTitle(found.title, true)
                  : x.isin;

                return (
                  <ListItem>
                    <ListItemText
                      primary={`${formatDate(x.date)}: ${formatNumber(
                        x.units
                      )} von ${stock} für ${formatCurrency(x.amount / 100)}`}
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

const mapStateToProps = (state: RootState) => {
  const { receipts, stocks } = state;

  return {
    receipts,
    stocks,
  };
};

const connector = connect(mapStateToProps);

export default connector(ReceiptUploadDialog);
