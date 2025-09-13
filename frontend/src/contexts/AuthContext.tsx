import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Define types directly in this file to avoid import issues
export interface AuthTokens {
  jwt_token: string;
  user_id: string;
  email: string;
  expires_at?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: AuthTokens | null;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'chief_ai_auth_tokens';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    tokens: null,
    error: null,
  });

  // Load tokens from localStorage on app start
  useEffect(() => {
    const loadSavedTokens = () => {
      try {
        const savedTokens = localStorage.getItem(STORAGE_KEY);
        if (savedTokens) {
          const tokens: AuthTokens = JSON.parse(savedTokens);
          
          // Check if tokens are expired
          if (tokens.expires_at && Date.now() > tokens.expires_at) {
            localStorage.removeItem(STORAGE_KEY);
            setAuthState(prev => ({ ...prev, isLoading: false }));
            return;
          }

          setAuthState(prev => ({
            ...prev,
            isAuthenticated: true,
            tokens,
            isLoading: false,
          }));
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading saved tokens:', error);
        localStorage.removeItem(STORAGE_KEY);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSavedTokens();
  }, []);

  const signIn = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Get auth URL from backend with signin intent
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/auth/signin`);
      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to initiate sign in. Please try again.',
      }));
    }
  };

  const signUp = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Get auth URL from backend with signup intent
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/auth/signup`);
      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Sign up error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to initiate sign up. Please try again.',
      }));
    }
  };

  const signOut = async () => {
    try {
      // Call backend logout endpoint if we have a token
      if (authState.tokens?.jwt_token) {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        await fetch(`${backendUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.tokens.jwt_token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Continue with local logout even if backend fails
    }

    // Always clear local storage and state
    localStorage.removeItem(STORAGE_KEY);
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      error: null,
    });
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  // Function to handle successful authentication (called from callback)
  const handleAuthSuccess = (tokens: AuthTokens) => {
    const tokensWithExpiry = {
      ...tokens,
      expires_at: Date.now() + (3600 * 1000), // 1 hour from now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokensWithExpiry));
    setAuthState({
      isAuthenticated: true,
      isLoading: false,
      tokens: tokensWithExpiry,
      error: null,
    });
  };

  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signOut,
    clearError,
  };

  // Expose handleAuthSuccess for callback component
  (contextValue as any).handleAuthSuccess = handleAuthSuccess;

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}