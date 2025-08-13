import React from 'react';
import { View, ViewProps, useWindowDimensions } from 'react-native';
import { tokens } from '../../theme/tokens';

type Props = ViewProps & {
  minItemWidth?: number; // px
  gap?: number; // px
};

export const ResponsiveGrid: React.FC<Props> = ({ minItemWidth = 280, gap = tokens.spacing.md, style, children, ...rest }) => {
  const { width } = useWindowDimensions();
  const columns = Math.max(1, Math.floor((width - tokens.spacing.lg * 2) / (minItemWidth + gap)));
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }, style]} {...rest}>
      {React.Children.map(children, (child) => (
        <View style={{ width: `${100 / columns}%`, padding: gap / 2 }}>{child}</View>
      ))}
    </View>
  );
};


