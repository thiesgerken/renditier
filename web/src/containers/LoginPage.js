import { connect } from 'react-redux';
import Login from '../components/Login';
import { login } from '../actions/authentication';

const mapDispatchToProps = dispatch => ({
  onSubmit: (user, password) => {
    login(user, password)(dispatch);
  },
});

const LoginPage = connect(null, mapDispatchToProps)(Login);

export default LoginPage;
