import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { formatDateTime, formatSince } from '../format';
import { buildCommit, buildDate } from '../git';
import { useAppSelector } from '../store';

const Settings = () => {
  const updateAvailable = useAppSelector(
    state => state.notifications.updateAvailable
  );

  return (
    <Card className="mx-auto max-w-(--breakpoint-xl)">
      <CardHeader>
        <CardTitle>Einstellungen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>
          Version #{buildCommit}, gebaut {formatDateTime(buildDate)} (
          {formatSince(
            Temporal.Instant.from(buildDate),
            Temporal.Now.zonedDateTimeISO()
          )}
          )
        </p>
        {updateAvailable && (
          <p>
            Es ist eine Aktualisierung verfügbar, zum Installieren bitte die App
            neustarten.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default Settings;
