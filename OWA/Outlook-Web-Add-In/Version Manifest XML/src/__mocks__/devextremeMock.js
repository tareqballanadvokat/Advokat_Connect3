// Mock for DevExtreme components
const React = require('react');

// Mock notify function
const notify = jest.fn();

// Mock DevExtreme React components
const mockComponent = (name) => {
  return React.forwardRef((props, ref) => {
    return React.createElement('div', { 
      'data-testid': `devextreme-${name.toLowerCase()}`,
      ref,
      ...props 
    }, props.children);
  });
};

module.exports = {
  default: notify,
  TreeList: mockComponent('TreeList'),
  Column: mockComponent('Column'),
  Scrolling: mockComponent('Scrolling'),
  Editing: mockComponent('Editing'),
  Button: mockComponent('Button'),
  DataGrid: mockComponent('DataGrid'),
  List: mockComponent('List'),
  TextBox: mockComponent('TextBox'),
  SelectBox: mockComponent('SelectBox'),
  DateBox: mockComponent('DateBox'),
  Popup: mockComponent('Popup'),
  Form: mockComponent('Form'),
  notify,
};
