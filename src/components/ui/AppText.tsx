import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { tokens } from '../../theme/tokens';

type Props = RNTextProps & {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'body2' | 'caption';
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
};

export const AppText: React.FC<Props> = ({ variant = 'body', color = tokens.palette.text, weight, style, children, ...rest }) => {
  const tv = tokens.typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        { color, fontSize: tv.fontSize, fontWeight: weight || (tv as any).fontWeight, letterSpacing: (tv as any).letterSpacing, fontFamily: (tokens.typography as any).fontFamily },
        style,
      ]}
    >
      {children}
    </RNText>
  );
};


