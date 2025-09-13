// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';
import ProfileSetup from '../components/ProfileSetup';

export default function ProfileSetupPage() {
  return (
    <AppLayout>
      <ProfileSetup />
    </AppLayout>
  );
}
