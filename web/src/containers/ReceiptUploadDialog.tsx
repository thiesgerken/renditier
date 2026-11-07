import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import FormDialogContent from '../components/FormDialogContent';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { formatCurrency, formatDate, formatUnits } from '../format';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import { useAppSelector } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ReceiptUploadDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const receipts = useAppSelector(state => state.receipts);
  const stocks = useAppSelector(state => state.stocks);

  return (
    <Dialog
      open={open && (receipts.isUploading || receipts.lastUpload !== null)}
      onOpenChange={isOpen => !isOpen && onClose()}
    >
      <FormDialogContent>
        <div className="flex flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('receipts.title')}</DialogTitle>
          </DialogHeader>
          {receipts.isUploading && (
            <LoaderCircle
              aria-label={t('receipts.uploading')}
              className="mx-auto my-6 size-8 animate-spin text-muted-foreground"
            />
          )}
          {!receipts.isUploading && receipts.uploadError !== null && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{t('receipts.failed')}</AlertTitle>
              <AlertDescription>
                {receipts.uploadError.message}
              </AlertDescription>
            </Alert>
          )}
          {!receipts.isUploading && receipts.data !== null && (
            <>
              <Alert>
                <CircleCheck />
                <AlertTitle>{t('receipts.succeeded')}</AlertTitle>
                <AlertDescription>
                  {t('receipts.added', { count: receipts.data.length })}
                </AlertDescription>
              </Alert>
              <ul className="grid gap-1 text-sm">
                {receipts.data.map(x => {
                  const found = findStock(stocks, x.isin);
                  const stock = found
                    ? abbreviateTitle(found.title, true)
                    : x.isin;

                  return (
                    <li key={x.id}>
                      {t('receipts.transaction', {
                        date: formatDate(x.date),
                        units: formatUnits(x.units, { maxDigits: 2 }),
                        stock,
                        amount: formatCurrency(x.amount / 100),
                      })}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <DialogFooter className="mt-auto">
            <Button type="button" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </div>
      </FormDialogContent>
    </Dialog>
  );
};

export default ReceiptUploadDialog;
