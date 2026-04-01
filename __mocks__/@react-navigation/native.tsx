import React from 'react';

export const NavigationContainer = ({children}: {children: React.ReactNode}) => <>{children}</>;
export const useNavigation = () => ({navigate: jest.fn(), goBack: jest.fn()});
export const useRoute = () => ({params: {}});
