import { useEffect, useRef } from 'react';
import { authApi } from '../../services/api';
import { useApp } from '../../context/AppContext';

export function AuthLinkHandler() {
  const { openAuthModal, showToast } = useApp();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get('verifyEmailToken');
    if (verificationToken) {
      void authApi.verifyEmail(verificationToken).then(() => {
        window.history.replaceState({}, '', window.location.pathname);
        showToast('Email verified successfully.', 'success');
      }).catch(error => showToast(error instanceof Error ? error.message : 'Email verification failed.', 'warning'));
    }
    if (params.get('resetPasswordToken')) openAuthModal('forgot');
  }, [openAuthModal, showToast]);
  return null;
}
