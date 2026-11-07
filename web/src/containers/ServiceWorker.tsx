import * as serviceWorker from '../serviceWorker';
import { updateAvailable } from '../slices/notifications';
import { useAppDispatch } from '../store';

const ServiceWorker = () => {
  const dispatch = useAppDispatch();

  serviceWorker.register({
    onUpdate: () => {
      dispatch(updateAvailable());
    },
  });

  return <></>;
};

export default ServiceWorker;
