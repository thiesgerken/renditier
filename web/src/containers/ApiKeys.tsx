import { useEffect, useState } from 'react';
import { Check, CircleAlert, Copy, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import FormDialogContent from '../components/FormDialogContent';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { formatDate, formatSince } from '../format';
import { createApiKey, deleteApiKey, fetchApiKeys } from '../slices/apiKeys';
import { useAppDispatch, useAppSelector } from '../store';
import type { ApiKey, ApiKeyAccess, CreatedApiKey } from '../types/api';
import useChange from '../useChange';

// in days; the select's value for "never" is NEVER
const EXPIRIES = ['30', '90', '365'];
const NEVER = 'never';

const KeyFacts = ({ apiKey }: { apiKey: ApiKey }) => {
  const { t } = useTranslation();
  const now = Temporal.Now.zonedDateTimeISO();
  const { createdAt, lastUsedAt, expiresAt } = apiKey;

  const expiry =
    expiresAt === null
      ? t('settings.apiKeys.neverExpires')
      : Temporal.Instant.compare(
            Temporal.Instant.from(expiresAt),
            now.toInstant()
          ) <= 0
        ? t('settings.apiKeys.expired', { date: formatDate(expiresAt) })
        : t('settings.apiKeys.expires', { date: formatDate(expiresAt) });
  const lastUsed =
    lastUsedAt === null
      ? t('settings.apiKeys.neverUsed')
      : t('settings.apiKeys.lastUsed', {
          since: formatSince(Temporal.Instant.from(lastUsedAt), now),
        });

  return (
    <p className="text-sm text-muted-foreground">
      {[
        t('settings.apiKeys.created', { date: formatDate(createdAt) }),
        lastUsed,
        expiry,
      ].join(' · ')}
    </p>
  );
};

const ApiKeyRow = ({ apiKey }: { apiKey: ApiKey }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { failure, pending, run } = useChange(() => setConfirmOpen(false));

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{apiKey.name}</span>
            <Badge variant="secondary">
              {t(`settings.apiKeys.access.${apiKey.access}`)}
            </Badge>
          </div>
          <KeyFacts apiKey={apiKey} />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('settings.apiKeys.delete', { name: apiKey.name })}
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>
      {failure !== null && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.apiKeys.confirmDelete', { name: apiKey.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.apiKeys.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.no')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                void run(
                  dispatch(deleteApiKey(apiKey.id)),
                  t('common.deleteFailed')
                )
              }
            >
              {t('common.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
};

const CreatedKey = ({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('settings.apiKeys.createdTitle')}</DialogTitle>
        <DialogDescription>{t('settings.apiKeys.copyNow')}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">
          {token}
        </code>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('settings.apiKeys.copy')}
          onClick={() =>
            void navigator.clipboard
              .writeText(token)
              .then(() => setCopied(true))
          }
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <DialogFooter className="mt-auto">
        <Button type="button" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </div>
  );
};

// Mounted only while the dialog is open, so every opening starts empty.
const ApiKeyForm = ({
  names,
  onCreated,
  onClose,
}: {
  names: string[];
  onCreated: (created: CreatedApiKey) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [access, setAccess] = useState<ApiKeyAccess>('read');
  const [expiry, setExpiry] = useState(NEVER);
  const [triedToSave, setTriedToSave] = useState(false);
  const { failure, pending, run } = useChange(onCreated);

  const trimmed = name.trim();
  const problem =
    trimmed === ''
      ? t('settings.apiKeys.nameMissing')
      : names.includes(trimmed)
        ? t('settings.apiKeys.nameTaken')
        : null;

  const onSave = () => {
    if (problem !== null) {
      setTriedToSave(true);
      return;
    }

    const expiresAt =
      expiry === NEVER
        ? null
        : Temporal.Now.instant()
            .add({ hours: 24 * Number(expiry) })
            .toString();
    void run(
      dispatch(createApiKey({ name: trimmed, access, expiresAt })),
      t('common.saveFailed')
    );
  };

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={event => {
        event.preventDefault();
        onSave();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('settings.apiKeys.new')}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="api-key-name">{t('common.name')}</Label>
        <Input
          id="api-key-name"
          value={name}
          onChange={event => setName(event.target.value)}
          aria-invalid={problem !== null && triedToSave}
        />
      </div>
      <div className="grid gap-2">
        <Label id="api-key-access">{t('settings.apiKeys.accessLabel')}</Label>
        <Select
          value={access}
          onValueChange={value => setAccess(value as ApiKeyAccess)}
        >
          <SelectTrigger aria-labelledby="api-key-access" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="read">
              {t('settings.apiKeys.access.read')}
            </SelectItem>
            <SelectItem value="write">
              {t('settings.apiKeys.access.write')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label id="api-key-expiry">{t('settings.apiKeys.expiry')}</Label>
        <Select value={expiry} onValueChange={setExpiry}>
          <SelectTrigger aria-labelledby="api-key-expiry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEVER}>{t('settings.apiKeys.never')}</SelectItem>
            {EXPIRIES.map(days => (
              <SelectItem key={days} value={days}>
                {t('settings.apiKeys.days', { days })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {problem !== null && triedToSave && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      {failure !== null && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      )}
      <DialogFooter className="mt-auto">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('settings.apiKeys.create')}
        </Button>
      </DialogFooter>
    </form>
  );
};

// Programs and agents authenticate with a key instead of a session. The
// server only accepts a session here, so no key can manage keys.
const ApiKeys = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const apiKeys = useAppSelector(state => state.apiKeys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  useEffect(() => {
    void dispatch(fetchApiKeys());
  });

  const items = apiKeys.data ?? [];
  const close = () => {
    setDialogOpen(false);
    setCreated(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.apiKeys.title')}</CardTitle>
        <CardDescription>{t('settings.apiKeys.description')}</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus />
            {t('settings.apiKeys.new')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {apiKeys.error !== null ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>
              {apiKeys.error.message ?? t('common.unknownError')}
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {apiKeys.data === null
              ? t('common.loading')
              : t('settings.apiKeys.none')}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map(apiKey => (
              <ApiKeyRow key={apiKey.id} apiKey={apiKey} />
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={isOpen => !isOpen && close()}>
        <FormDialogContent>
          {created === null ? (
            <ApiKeyForm
              names={items.map(k => k.name)}
              onCreated={setCreated}
              onClose={close}
            />
          ) : (
            <CreatedKey token={created.token} onClose={close} />
          )}
        </FormDialogContent>
      </Dialog>
    </Card>
  );
};

export default ApiKeys;
