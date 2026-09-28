import { LoginForm } from '~/app/login/components/login-form';
import { isRegistrationOpen } from '~/lib/registration';

// Dinâmica: REGISTRATION_OPEN é lido em runtime (estática, a flag congelaria no build).
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm registrationOpen={isRegistrationOpen()} />;
}
