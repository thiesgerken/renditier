import { useState } from 'react';
import { CircleAlert, CircleCheck, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AuthenticationState } from '../types/store';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  onSubmit: (username: string, password: string) => void;
  message?: string | null;
  messageType?: AuthenticationState['messageType'];
}

const Login = ({ onSubmit, message = null, messageType = null }: Props) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <TrendingUp className="size-6" />
          </span>
          <CardTitle>
            <h1 className="text-xl">Aktienverwaltung</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault();
              onSubmit(username, password);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">{t('login.username')}</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- the login form is the whole page
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="mt-2 w-full">
              {t('login.submit')}
            </Button>
          </form>
          {message !== null && messageType !== null && (
            <Alert
              variant={messageType === 'error' ? 'destructive' : 'default'}
            >
              {messageType === 'error' ? <CircleAlert /> : <CircleCheck />}
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
