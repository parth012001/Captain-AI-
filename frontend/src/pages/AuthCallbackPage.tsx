// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';
import AuthCallback from '../components/AuthCallback';

export default function AuthCallbackPage() {
	return (
		<AppLayout>
			<AuthCallback />
		</AppLayout>
	);
}
