import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import moment from 'moment';
import 'moment/locale/de';

import { buildCommit, buildDate } from '../git';
import type { RootState } from '../types/store';

const Settings = ({ updateAvailable }: Props) => {
  moment.locale('de');

  return (
    <div>
      <div>
        Version #{buildCommit}, gebaut {moment(buildDate).format('LLL')} (
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
