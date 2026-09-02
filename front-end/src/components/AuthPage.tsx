import React, { useState } from 'react';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = () => {
  const [isLogin, setIsLogin] = useState(true);

  if (isLogin) {
    return <LoginPage onSwitchToRegister={() => setIsLogin(false)} />;
  }

  return <RegisterPage onSwitchToLogin={() => setIsLogin(true)} />;
};
