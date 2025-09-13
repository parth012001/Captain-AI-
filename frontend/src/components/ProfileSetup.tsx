import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { CheckCircle, User, ArrowRight, Loader } from 'lucide-react';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { tokens } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    firstName: string;
    lastName: string;
    fullName: string;
  } | null>(null);

  useEffect(() => {
    // Get signup data from localStorage
    const signupData = localStorage.getItem('chief_ai_signup_data');
    if (signupData) {
      try {
        const data = JSON.parse(signupData);
        setProfileData(data);
      } catch (error) {
        console.error('Error parsing signup data:', error);
        setError('Invalid signup data. Please try again.');
      }
    } else {
      setError('No signup data found. Please start over.');
    }
  }, []);

  const handleCompleteProfile = async () => {
    if (!profileData || !tokens?.jwt_token) {
      setError('Missing profile data or authentication. Please try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save profile to backend
      const response = await api.post('/api/auth/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName
      });

      if (response.status === 200) {
        // Clear signup data from localStorage
        localStorage.removeItem('chief_ai_signup_data');
        
        // Navigate to existing onboarding
        navigate('/onboarding');
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setError(error.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Clear signup data and go to onboarding
    localStorage.removeItem('chief_ai_signup_data');
    navigate('/onboarding');
  };

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-large max-w-md w-full p-8 text-center">
          <Loader className="w-8 h-8 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center p-4">
      <motion.div
        className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-large max-w-md w-full p-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-medium mx-auto mb-4"
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
          >
            <CheckCircle className="w-8 h-8" />
          </motion.div>
          
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-gradient">
            Almost There!
          </h1>
          <p className="text-gray-600">
            Let's complete your profile setup
          </p>
        </div>

        {/* Profile Summary */}
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {profileData.fullName}
              </h3>
              <p className="text-sm text-gray-600">
                {tokens?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-4 mb-6">
          <h4 className="text-lg font-semibold text-gray-900 text-center">
            What happens next:
          </h4>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Chief AI learns your communication style</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Personalized email signatures with your name</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Smart email responses and calendar automation</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <motion.button
            onClick={handleCompleteProfile}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-medium hover:shadow-large transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Setting up your profile...</span>
              </>
            ) : (
              <>
                <span>Complete Setup</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>

          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="w-full text-gray-600 hover:text-gray-900 transition-colors duration-200 py-2 text-sm"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
