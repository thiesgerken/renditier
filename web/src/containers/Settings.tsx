import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import moment from 'moment';

import { buildCommit, buildDate } from '../git';
import { formatDateTime } from '../format';
import type { RootState } from '../store';

const Settings = ({ updateAvailable }: Props) => {
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

const mapStateToProps = ({ notifications }: RootState) => ({
  updateAvailable: notifications.updateAvailable,
});

const connector = connect(mapStateToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(Settings);
