import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LoginPage as PFLoginPage,
  LoginForm,
} from '@patternfly/react-core';
import { api } from '../api';

export function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      const user = await api.login(username, password);
      onLogin(user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Giriş başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PFLoginPage
      loginTitle="Portala giriş yap"
      loginSubtitle="Kısa kullanıcı adınız ve parolanızla giriş yapın"
      textContent="Nöbetçi bilgileri, envanterler ve self-servis hizmetler için tek portal."
    >
      <LoginForm
        usernameLabel="Kullanıcı adı"
        usernameValue={username}
        onChangeUsername={(_e, v) => setUsername(v)}
        passwordLabel="Parola"
        passwordValue={password}
        onChangePassword={(_e, v) => setPassword(v)}
        onLoginButtonClick={submit}
        loginButtonLabel={busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        isLoginButtonDisabled={busy}
        showHelperText={!!error}
        helperText={error}
        isValidUsername={!error}
        isValidPassword={!error}
      />
    </PFLoginPage>
  );
}
