// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';

export default function NotFoundPage() {
	return (
		<AppLayout>
			<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ textAlign: 'center' }}>
					<h2>Page not found</h2>
					<p>We couldn't find that page.</p>
					<a href="/signin">Go to Sign In</a>
				</div>
			</div>
		</AppLayout>
	);
}
