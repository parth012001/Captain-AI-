// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';
import SignIn from '../components/SignIn';

export default function SignInPage() {
	return (
		<AppLayout>
			<SignIn />
		</AppLayout>
	);
}
