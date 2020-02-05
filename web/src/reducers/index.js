import { combineReducers } from 'redux';
import todos from './todos';
import visibilityFilter from './visibilityFilter';
import performance from './performance';
import authentication from './authentication';

const todoApp = combineReducers({
  todos,
  visibilityFilter,
  performance,
  authentication,
});

export default todoApp;
