'use client';

// global-error substitui o layout raiz (fora do Provider do Chakra), então usa
// HTML/estilo inline puro. Só dispara em erros do próprio layout raiz.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0f172a',
          color: '#f8fafc',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Algo deu errado</h1>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
            Ocorreu um erro inesperado no aplicativo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#0D9488',
              color: 'white',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
