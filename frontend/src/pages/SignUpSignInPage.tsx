// React import not needed for modern JSX transform
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, UserPlus, ArrowRight } from 'lucide-react';

export default function SignUpSignInPage() {
  const navigate = useNavigate();

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center p-4">
      <motion.div
        className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-large max-w-2xl w-full p-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center text-3xl text-white shadow-medium mx-auto mb-6"
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
          >
            🤖
          </motion.div>
          
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 text-gradient">
            Welcome to Chief AI
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Your intelligent email and calendar assistant that learns your style and automates your communications
          </p>
        </div>

        {/* Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Sign Up Card */}
          <motion.div
            className="group cursor-pointer"
            onClick={handleSignUp}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-2xl p-6 h-full transition-all duration-300 group-hover:border-primary-300 group-hover:shadow-medium">
              <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">New to Chief AI?</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Create your account and let Chief AI learn your communication style to provide personalized email assistance.
              </p>
              
              <div className="flex items-center text-primary-600 font-semibold group-hover:text-primary-700">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </motion.div>

          {/* Sign In Card */}
          <motion.div
            className="group cursor-pointer"
            onClick={handleSignIn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 border-2 border-secondary-200 rounded-2xl p-6 h-full transition-all duration-300 group-hover:border-secondary-300 group-hover:shadow-medium">
              <div className="flex items-center justify-center w-12 h-12 bg-secondary-500 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
                <Mail className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">Already have an account?</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Sign in to continue managing your emails with Chief AI's intelligent automation.
              </p>
              
              <div className="flex items-center text-secondary-600 font-semibold group-hover:text-secondary-700">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Features Preview */}
        <div className="bg-gray-50 rounded-2xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            What Chief AI can do for you:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span className="text-gray-700">Smart email responses</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span className="text-gray-700">Calendar automation</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span className="text-gray-700">Learn your style</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
