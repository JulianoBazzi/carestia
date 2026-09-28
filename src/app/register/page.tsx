import { RegisterForm } from '~/app/register/components/register-form';
import { RegistrationClosed } from '~/app/register/components/registration-closed';
import { isRegistrationOpen } from '~/lib/registration';

// Dinâmica: REGISTRATION_OPEN é lido em runtime (estática, a flag congelaria no build).
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return isRegistrationOpen() ? <RegisterForm /> : <RegistrationClosed />;
}
