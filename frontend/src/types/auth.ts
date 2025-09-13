export interface AuthTokens {
  access_token: string;
  refresh_token: string;
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
  signOut: () => void;
  clearError: () => void;
}