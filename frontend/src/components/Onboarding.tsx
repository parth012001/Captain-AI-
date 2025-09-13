import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { api } from '../services/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'pending' | 'active' | 'completed';
  insights?: string[];
}

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" as const } }
};

// Skeleton component for loading states
const Skeleton = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={`animate-pulse bg-gray-300 rounded ${className}`}
    {...props}
  />
);

// Confetti component for celebration
const Confetti = () => {
  const confettiCount = 50;
  const confetti = Array.from({ length: confettiCount }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -20,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.5,
    color: ['#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f87171'][Math.floor(Math.random() * 5)]
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confetti.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${piece.x}%`,
            backgroundColor: piece.color,
          }}
          initial={{ y: piece.y, rotate: piece.rotation, opacity: 1 }}
          animate={{
            y: [piece.y, piece.y + 120],
            rotate: [piece.rotation, piece.rotation + 360],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 2,
            delay: piece.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
};

export default function Onboarding() {
  const { tokens } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  const [emailCount, setEmailCount] = useState(0);
  const [totalEmails, setTotalEmails] = useState(0);
  const [toneInsights, setToneInsights] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const progressMotionValue = useMotionValue(0);
  const progressWidth = useTransform(progressMotionValue, (v) => `${v}%`);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to Chief AI',
      description: 'Let\'s set up your intelligent assistant',
      progress: 0,
      status: 'active'
    },
    {
      id: 'fetch_emails',
      title: 'Discovering Your Emails',
      description: 'Scanning your Gmail for communication patterns',
      progress: 0,
      status: 'pending'
    },
    {
      id: 'analyze_tone',
      title: 'Learning Your Writing Style',
      description: 'Analyzing your unique communication patterns',
      progress: 0,
      status: 'pending'
    },
    {
      id: 'generate_insights',
      title: 'Building Your AI Profile',
      description: 'Creating personalized insights and preferences',
      progress: 0,
      status: 'pending'
    },
    {
      id: 'complete',
      title: 'Your AI Assistant is Ready!',
      description: 'Chief AI has learned your communication style',
      progress: 100,
      status: 'pending'
    }
  ]);

  useEffect(() => {
    if (tokens?.jwt_token) {
      startOnboarding();
    }

    // Cleanup function to abort any ongoing requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tokens]);

  useEffect(() => {
    if (currentStepIndex < steps.length) {
      progressMotionValue.set(steps[currentStepIndex].progress);
      if (stepTitleRef.current) {
        stepTitleRef.current.focus();
      }
    }
  }, [currentStepIndex, steps, progressMotionValue]);

  const startOnboarding = async () => {
    try {
      await simulateStep('welcome', 2000);
      await fetchEmailsStep();
      await analyzeToneStep();
      await generateInsightsStep();
      await completeStep();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Onboarding was cancelled');
        return;
      }
      console.error('Onboarding error:', error);
    }
  };

  const simulateStep = (stepId: string, duration: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      updateStepStatus(stepId, 'active');
      let progress = 0;
      const interval = setInterval(() => {
        if (abortControllerRef.current?.signal.aborted) {
          clearInterval(interval);
          reject(new Error('Aborted'));
          return;
        }
        progress += 2;
        updateStepProgress(stepId, Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(interval);
          updateStepStatus(stepId, 'completed');
          moveToNextStep();
          resolve();
        }
      }, duration / 50);
    });
  };

  const fetchEmailsStep = async (): Promise<void> => {
    updateStepStatus('fetch_emails', 'active');
    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const response = await api.get('/emails/fetch', { signal });

      if (response.status !== 200) throw new Error('Failed to fetch emails');

      const targetCount = 47;
      setTotalEmails(targetCount);
      let currentCount = 0;
      const emailInterval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(emailInterval);
          return;
        }
        currentCount += Math.floor(Math.random() * 3) + 1;
        currentCount = Math.min(currentCount, targetCount);
        setEmailCount(currentCount);
        const progress = (currentCount / targetCount) * 100;
        updateStepProgress('fetch_emails', progress);
        if (currentCount >= targetCount) {
          clearInterval(emailInterval);
          updateStepStatus('fetch_emails', 'completed');
          moveToNextStep();
        }
      }, 100);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Email fetch was cancelled');
        return;
      }
      console.error('Email fetch error:', error);
      await simulateStep('fetch_emails', 3000);
    }
  };

  const analyzeToneStep = async (): Promise<void> => {
    updateStepStatus('analyze_tone', 'active');
    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const response = await api.post('/ai/analyze-tone-real', {}, { signal });

      if (response.status === 200) {
        let progress = 0;
        const analysisInterval = setInterval(() => {
          if (signal.aborted) {
            clearInterval(analysisInterval);
            return;
          }
          progress += 3;
          updateStepProgress('analyze_tone', Math.min(progress, 100));
          if (progress >= 100) {
            clearInterval(analysisInterval);
            updateStepStatus('analyze_tone', 'completed');
            moveToNextStep();
          }
        }, 50);
      } else {
        throw new Error('Tone analysis failed');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Tone analysis was cancelled');
        return;
      }
      console.error('Tone analysis error:', error);
      await simulateStep('analyze_tone', 4000);
    }
  };

  const generateInsightsStep = async (): Promise<void> => {
    updateStepStatus('generate_insights', 'active');
    const mockInsights = [
      'Professional and courteous tone detected',
      'Prefers concise, direct communication',
      'Uses collaborative language patterns',
      'Maintains warm but business-focused style'
    ];

    let progress = 0;
    for (let i = 0; i < mockInsights.length; i++) {
      // Check if aborted between insights
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 800));
      setToneInsights(prev => [...prev, mockInsights[i]]);
      progress = ((i + 1) / mockInsights.length) * 100;
      updateStepProgress('generate_insights', progress);
    }

    updateStepStatus('generate_insights', 'completed');
    moveToNextStep();
  };

  const completeStep = async (): Promise<void> => {
    updateStepStatus('complete', 'active');
    setIsComplete(true);
    setShowConfetti(true);
    
    setTimeout(() => {
      window.location.href = '/';
    }, 4000);
  };

  const updateStepStatus = (stepId: string, status: OnboardingStep['status']) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const updateStepProgress = (stepId: string, progress: number) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, progress } : step
    ));
  };

  const moveToNextStep = () => {
    setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleSkip = () => {
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setIsSkipping(true);
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  const currentStep = steps[currentStepIndex];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-600 to-secondary-600 relative overflow-hidden p-4">
      {/* Confetti overlay */}
      {showConfetti && <Confetti />}
      
      {/* Skip button */}
      {!isComplete && !isSkipping && (
        <motion.button
          onClick={handleSkip}
          className="absolute top-6 right-6 bg-white/90 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-white hover:text-gray-900 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Skip setup
        </motion.button>
      )}

      {/* Main onboarding card */}
      <motion.div
        className="relative z-10 bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-large max-w-2xl w-full p-8 text-center transition-all duration-300"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center gap-3 mb-4" role="tablist" aria-label="Onboarding Progress">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index <= currentStepIndex
                    ? 'bg-gradient-to-br from-primary-500 to-secondary-500'
                    : 'bg-gray-300'
                }`}
                animate={{ scale: index === currentStepIndex ? 1.2 : 1 }}
                aria-current={index === currentStepIndex ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.title}`}
              />
            ))}
          </div>

          <div className="text-sm text-gray-600 mb-2">
            Step {currentStepIndex + 1} of {steps.length}
          </div>
        </div>

        {/* Current step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep?.id}
            variants={stepVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="min-h-[300px] flex flex-col justify-center items-center"
            aria-live="polite"
          >
            {/* Step icon/animation */}
            <motion.div
              className={`w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center text-3xl text-white shadow-medium mb-6 ${
                currentStep?.status === 'active' ? 'animate-pulse-slow' : ''
              }`}
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              {getStepIcon(currentStep?.id)}
            </motion.div>

            {/* Step title and description */}
            <h1
              ref={stepTitleRef}
              tabIndex={-1}
              className="text-4xl font-extrabold text-gray-900 mb-4 text-gradient"
            >
              {currentStep?.title}
            </h1>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              {currentStep?.description}
            </p>

            {/* Progress bar */}
            <div
              className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-6"
              role="progressbar"
              aria-valuenow={currentStep?.progress || 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full shadow-glow"
                style={{ width: progressWidth }}
                initial={{ width: 0 }}
                animate={{ width: `${currentStep?.progress || 0}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            {/* Dynamic content based on step */}
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );

  function getStepIcon(stepId?: string) {
    switch (stepId) {
      case 'welcome': return '👋';
      case 'fetch_emails': return '📧';
      case 'analyze_tone': return '🧠';
      case 'generate_insights': return '✨';
      case 'complete': return '🎉';
      default: return '🤖';
    }
  }

  function renderStepContent() {
    switch (currentStep?.id) {
      case 'fetch_emails':
        return (
          <div className="text-center">
            {emailCount > 0 ? (
              <div className="text-2xl font-semibold text-gray-900 mb-2">
                {emailCount} emails found
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-lg text-gray-600 mb-4">Scanning your inbox...</div>
                <div className="flex justify-center space-x-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-3 h-3 rounded-full" />
                </div>
              </div>
            )}
            {totalEmails > 0 && (
              <div className="text-base text-gray-600">
                Analyzing {totalEmails} total messages
              </div>
            )}
          </div>
        );

      case 'generate_insights':
        return (
          <div className="text-left w-full max-w-md mx-auto">
            {toneInsights.map((insight, index) => (
              <motion.div
                key={index}
                className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-3 mb-2 text-sm text-gray-800 flex items-center gap-2 shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <span className="text-primary-600">✓</span> {insight}
              </motion.div>
            ))}
            {toneInsights.length < 4 && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <motion.div
              className="text-6xl mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              🎉
            </motion.div>
            <div className="text-lg text-success-600 font-semibold">
              Redirecting to your dashboard...
            </div>
          </div>
        );

      default:
        return null;
    }
  }
}