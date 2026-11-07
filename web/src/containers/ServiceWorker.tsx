import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';

import * as serviceWorker from '../serviceWorker';
import { updateAvailable as updateAvailableAction } from '../slices/notifications';
import type { AppDispatch } from '../store';

const ServiceWorker = ({ updateAvailable }: Props) => {
  serviceWorker.register({
    onUpdate: () => {
      updateAvailable();
    },
  });

  return <></>;
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updateAvailable: () => dispatch(updateAvailableAction()),
});

const connector = connect(null, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(ServiceWorker);
