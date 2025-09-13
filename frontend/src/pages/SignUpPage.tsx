// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';
import SignUpForm from '../components/SignUpForm';

export default function SignUpPage() {
  return (
    <AppLayout>
      <SignUpForm />
    </AppLayout>
  );
}
