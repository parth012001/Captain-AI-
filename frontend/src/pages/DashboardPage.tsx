// React import not needed for modern JSX transform
import AppLayout from '../layouts/AppLayout';
import Dashboard from '../components/Dashboard';

export default function DashboardPage() {
	return (
		<AppLayout>
			<Dashboard />
		</AppLayout>
	);
}
