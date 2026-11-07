import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { formatDateTime } from '../format';
import { buildCommit, buildDate } from '../git';
import { useAppSelector } from '../store';

const UNITS = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const;

const relativeTime = new Intl.RelativeTimeFormat('de');

// "vor 3 Tagen": the largest unit the time span reaches.
export const formatSince = (
  instant: Temporal.Instant,
  now: Temporal.ZonedDateTime
): string => {
  const since = now.since(instant.toZonedDateTimeISO(now.timeZoneId), {
    largestUnit: 'years',
  });
  const unit = UNITS.find(u => since[u] !== 0) ?? 'seconds';

  return relativeTime.format(-since[unit], unit);
};

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
