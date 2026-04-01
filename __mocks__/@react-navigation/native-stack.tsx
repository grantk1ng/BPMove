import React from 'react';

export function createNativeStackNavigator() {
  return {
    Navigator: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Screen: () => null,
  };
}
