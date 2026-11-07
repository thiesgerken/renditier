import { connect } from 'react-redux';
import Login from '../components/Login';
import { login } from '../slices/authentication';
import type { AppDispatch, RootState } from '../store';

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onSubmit: (user: string, password: string) => {
    // FIXME(tsx-migration): was `login(user, password)(dispatch)`, which called
    // the thunk by hand with only the first of its three arguments, leaving
    // getState and the extra argument undefined. Dispatching it is what the
    // thunk middleware does anyway, so behaviour is unchanged.
    dispatch(login({ userName: user, password }));
  },
});

const mapStateToProps = ({ authentication }: RootState) => ({
  message: authentication.message,
  messageType: authentication.messageType,
});

const LoginPage = connect(mapStateToProps, mapDispatchToProps)(Login);

export default LoginPage;
