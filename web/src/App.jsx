import React from 'react';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';

import Footer from './components/Footer';
import AddTodo from './containers/AddTodo';
import VisibleTodoList from './containers/VisibleTodoList';

import './App.css';

const App = () => (
  <div className="AppContainer">
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/login">Login</Link>
            </li>
          </ul>
        </nav>
        <Switch>
          <Route path="/login">
            <div className="App">Test</div>
          </Route>
          <Route path="/">
            <h1>My Todo List</h1>
            <div className="App">
              <AddTodo />
              <VisibleTodoList />
              <Footer />
            </div>
          </Route>
        </Switch>
      </div>
    </Router>
  </div>
);

export default App;
