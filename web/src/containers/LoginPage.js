import { connect } from 'react-redux';
import Login from '../components/Login';
import { login } from '../actions/authentication';

const mapDispatchToProps = dispatch => ({
  onSubmit: (user, password) => {
    login(user, password)(dispatch);
  },
});

const mapStateToProps = ({ authentication }) => ({
  message: authentication.message,
  messageType: authentication.messageType,
});

const LoginPage = connect(mapStateToProps, mapDispatchToProps)(Login);

export default LoginPage;
