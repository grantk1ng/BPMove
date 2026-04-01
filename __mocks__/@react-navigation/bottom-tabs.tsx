import React from 'react';

export function createBottomTabNavigator() {
  return {
    Navigator: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Screen: () => null,
  };
}
