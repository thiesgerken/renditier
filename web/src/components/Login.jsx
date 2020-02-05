import React from 'react';
import PropTypes from 'prop-types';

const Login = ({ onSubmit, message }) => (
  <div>
    <h3>Login Page</h3>
    {message !== null ? <div>{message}</div> : ''}
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit(e.target.username.value, e.target.password.value);
      }}
    >
      <div>
        <label htmlFor="username">
          Benutzername
          <input type="text" name="username" />
        </label>
      </div>
      <div>
        <label htmlFor="password">
          Passwort
          <input type="password" name="password" />
        </label>
      </div>
      <div>
        <button type="submit">Login</button>
      </div>
    </form>
  </div>
);

Login.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  message: PropTypes.string,
};

Login.defaultProps = {
  message: null,
};

export default Login;
