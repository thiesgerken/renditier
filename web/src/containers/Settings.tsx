import moment from 'moment';

import { buildCommit, buildDate } from '../git';
import { formatDateTime } from '../format';
import { useAppSelector } from '../store';

const Settings = () => {
  const updateAvailable = useAppSelector(
    state => state.notifications.updateAvailable
  );

  return (
    <div>
      <div>
        Version #{buildCommit}, gebaut {formatDateTime(buildDate)} (
        {moment(buildDate).fromNow()})
      </div>
      {updateAvailable && (
        <div>
          Es ist eine Aktualisierung verfügbar, zum Installieren bitte die App
          neustarten.
        </div>
      )}
    </div>
  );
};

export default Settings;
