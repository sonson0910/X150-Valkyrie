// Mock for react-native-svg
import React from 'react';

const Svg = React.forwardRef((props, ref) => 
  React.createElement('View', { ...props, ref })
);

const Circle = React.forwardRef((props, ref) => 
  React.createElement('View', { ...props, ref })
);

const Path = React.forwardRef((props, ref) => 
  React.createElement('View', { ...props, ref })
);

const G = React.forwardRef((props, ref) => 
  React.createElement('View', { ...props, ref })
);

export { Svg, Circle, Path, G };
export default Svg;

