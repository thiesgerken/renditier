import React from 'react';
import { Button, Input } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { addTodo } from '../actions';

import './AddTodo.css';

// let AddTodo = ;
const AddTodo = connect()(({ dispatch }) => {
  return (
    <div className="AddTodo">
      <form
        onSubmit={e => {
          e.preventDefault();
          const input = document.querySelector('input[name=todo]');
          if (!input.value.trim()) {
            return;
          }
          dispatch(addTodo(input.value));
          input.value = '';
        }}
      >
        <Input className="TodoText" placeholder="Task..." name="todo" />
        <Button className="TodoButton" basic type="submit">
          New Todo
        </Button>
      </form>
    </div>
  );
});

export default AddTodo;
