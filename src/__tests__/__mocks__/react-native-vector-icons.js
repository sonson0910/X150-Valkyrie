// Mock for react-native-vector-icons
import React from 'react';

const createIconSet = () => {
  return React.forwardRef((props, ref) => {
    return React.createElement('Text', { ...props, ref }, props.children || '');
  });
};

export default createIconSet;
export { createIconSet };

