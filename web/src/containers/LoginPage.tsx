import Login from '../components/Login';
import { login } from '../slices/authentication';
import { useAppDispatch, useAppSelector } from '../store';

const LoginPage = () => {
  const dispatch = useAppDispatch();
  const { message, messageType } = useAppSelector(
    state => state.authentication
  );

  return (
    <Login
      message={message}
      messageType={messageType}
      onSubmit={(userName, password) => {
        dispatch(login({ userName, password }));
      }}
    />
  );
};

export default LoginPage;
