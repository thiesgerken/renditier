import { combineReducers } from 'redux';
import todos from './todos';
import visibilityFilter from './visibilityFilter';
import performance from './performance';
import user from './user';

const todoApp = combineReducers({
  todos,
  visibilityFilter,
  performance,
  user,
});

export default todoApp;
