import React from 'react';
import { View, ViewProps } from 'react-native';
import { tokens } from '../../theme/tokens';

type Props = ViewProps & {
  padded?: boolean;
  center?: boolean;
  full?: boolean;
};

export const Container: React.FC<Props> = ({ padded = true, center = false, full = false, style, children, ...rest }) => {
  return (
    <View
      style={[
        {
          backgroundColor: tokens.palette.background,
          paddingHorizontal: padded ? tokens.spacing.lg : 0,
          paddingVertical: padded ? tokens.spacing.lg : 0,
          flex: full ? 1 : undefined,
        },
        center ? { alignItems: 'center', justifyContent: 'center' } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};


