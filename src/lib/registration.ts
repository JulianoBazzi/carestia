import 'server-only';

/**
 * Beta fechado: novos cadastros ficam desabilitados até `REGISTRATION_OPEN=true`
 * no ambiente. Server-only — as telas recebem o valor por prop para esconder os
 * links de "Criar conta".
 */
export function isRegistrationOpen(): boolean {
  return process.env.REGISTRATION_OPEN === 'true';
}
