import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your authentication...');
  const auth = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const success = urlParams.get('success');
        const tokensParam = urlParams.get('tokens');

        console.info('[Route] AuthCallback params', { error, success, hasTokens: !!tokensParam });

        if (error) {
          setStatus('error');
          if (error === 'no_code') {
            setMessage('No authorization code received. Please try signing in again.');
          } else if (error === 'auth_failed') {
            setMessage('Authentication failed. Please try again.');
          } else if (error === 'user_not_found') {
            const email = urlParams.get('email');
            setMessage(`Account not found for ${email}. Please sign up first or check your email address.`);
          } else if (error === 'user_exists') {
            const email = urlParams.get('email');
            setMessage(`Account already exists for ${email}. Please sign in instead.`);
          } else {
            setMessage('Authentication was cancelled or failed.');
          }
          return;
        }

        if (success === 'true' && tokensParam) {
          try {
            const decodedTokens = JSON.parse(atob(decodeURIComponent(tokensParam)));
            console.info('[Route] AuthCallback success');
            setMessage('Authentication successful! Setting up your account...');
            setStatus('success');
            (auth as any).handleAuthSuccess(decodedTokens);
            
            // Check if user needs onboarding (based on backend data)
            if (decodedTokens.needs_onboarding) {
              console.log('🆕 New user or incomplete onboarding - redirecting to profile setup');
              setTimeout(() => {
                window.location.href = '/profile-setup';
              }, 1500);
            } else {
              console.log('✅ Existing user with complete profile - redirecting to dashboard');
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 1500);
            }
          } catch (tokenError) {
            console.error('Error parsing tokens:', tokenError);
            setStatus('error');
            setMessage('Error processing authentication tokens. Please try again.');
          }
        } else {
          setStatus('error');
          setMessage('Invalid authentication response. Please try again.');
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        setStatus('error');
        setMessage('An error occurred during authentication. Please try again.');
      }
    };

    handleCallback();
  }, [auth]);

  const handleRetry = () => {
    console.info('[Route] AuthCallback retry -> /signin');
    window.location.href = '/signin';
  };

  return (
    <div className="callback-container">
      <div className="callback-card">
        <div className="callback-content">
          {status === 'processing' && (
            <>
              <div className="loading-spinner large"></div>
              <h2>Setting up your Chief AI account...</h2>
              <p>{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="success-icon">✅</div>
              <h2>Authentication Successful!</h2>
              <p>{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="error-icon">❌</div>
              <h2>Authentication Failed</h2>
              <p>{message}</p>
              <button onClick={handleRetry} className="retry-btn">
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}