import { useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { formatDateTime, formatSince } from '../format';
import { buildCommit, buildDate } from '../git';
import { LANGUAGES, chooseLanguage, chosenLanguage } from '../i18n';
import type { Language } from '../i18n';
import { installUpdate } from '../serviceWorker';
import { useAppSelector } from '../store';

// Each language by its own name, so that it can be found in any.
const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
};

// the select's value for following the browser
const AUTOMATIC = 'automatic';

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-9 items-center justify-between gap-4 py-1">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right">{children}</dd>
  </div>
);

const Settings = () => {
  const { t } = useTranslation();
  const [language, setLanguage] = useState(chosenLanguage);
  const updateAvailable = useAppSelector(
    state => state.notifications.updateAvailable
  );

  const choose = (value: string) => {
    const choice = LANGUAGES.find(l => l === value) ?? null;
    setLanguage(choice);
    chooseLanguage(choice);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="px-1 text-lg font-semibold">{t('settings.title')}</h1>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <CardTitle id="settings-language">{t('settings.language')}</CardTitle>
          <Select value={language ?? AUTOMATIC} onValueChange={choose}>
            <SelectTrigger
              aria-labelledby="settings-language"
              className="min-w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={AUTOMATIC}>
                {t('settings.automatic')}
              </SelectItem>
              {LANGUAGES.map(l => (
                <SelectItem key={l} value={l} lang={l}>
                  {LANGUAGE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.about')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label={t('settings.version')}>
              <span className="font-mono">{buildCommit}</span>
            </Row>
            <Row label={t('settings.built')}>
              {formatDateTime(buildDate)}{' '}
              <span className="text-muted-foreground">
                (
                {formatSince(
                  Temporal.Instant.from(buildDate),
                  Temporal.Now.zonedDateTimeISO()
                )}
                )
              </span>
            </Row>
            {updateAvailable && (
              <Row label={t('settings.updateAvailable')}>
                <Button size="sm" onClick={installUpdate}>
                  <RefreshCw />
                  {t('common.reload')}
                </Button>
              </Row>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
