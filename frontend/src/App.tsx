import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignUpSignInPage from './pages/SignUpSignInPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import DashboardPage from './pages/DashboardPage';
import SystemStatusPage from './pages/SystemStatusPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/LoadingSpinner';
import Onboarding from './components/Onboarding';

// Import CSS
import './components/SignIn.css';
import './components/AuthCallback.css';
import './components/Dashboard.css';
import './App.css';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuth();
	
	if (isLoading) {
		return <LoadingSpinner />;
	}
	
	return isAuthenticated ? <>{children}</> : <Navigate to="/signin" replace />;
}

// Public route wrapper (redirect if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuth();
	
	if (isLoading) {
		return <LoadingSpinner />;
	}
	
	return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

// App content with routing
function AppContent() {
	return (
		<Router>
			<div className="App">
				<Routes>
					{/* Root route - redirect based on auth status */}
					<Route 
						path="/" 
						element={<Navigate to="/signup-signin" replace />} 
					/>
					{/* Public routes */}
					<Route 
						path="/signup-signin" 
						element={
							<PublicRoute>
								<SignUpSignInPage />
							</PublicRoute>
						} 
					/>
					<Route 
						path="/signup" 
						element={
							<PublicRoute>
								<SignUpPage />
							</PublicRoute>
						} 
					/>
					<Route 
						path="/signin" 
						element={
							<PublicRoute>
								<SignInPage />
							</PublicRoute>
						} 
					/>
					<Route path="/auth/callback" element={<AuthCallbackPage />} />
					
					{/* Protected routes */}
					<Route 
						path="/profile-setup" 
						element={
							<ProtectedRoute>
								<ProfileSetupPage />
							</ProtectedRoute>
						} 
					/>
					<Route 
						path="/onboarding" 
						element={
							<ProtectedRoute>
								<Onboarding />
							</ProtectedRoute>
						} 
					/>
					<Route 
						path="/dashboard" 
						element={
							<ProtectedRoute>
								<DashboardPage />
							</ProtectedRoute>
						} 
					/>
					<Route 
						path="/system-status" 
						element={
							<ProtectedRoute>
								<SystemStatusPage />
							</ProtectedRoute>
						} 
					/>
					
					{/* Fallback route */}
					<Route path="*" element={<NotFoundPage />} />
				</Routes>
			</div>
		</Router>
	);
}

function App() {
	return (
		<AuthProvider>
			<AppContent />
		</AuthProvider>
	);
}

export default App;