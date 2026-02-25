/**
 * Cria automaticamente um usuário de teste no emulador do Firebase Auth.
 * Executar após os emuladores já estarem rodando: node scripts/seed-emulator.mjs
 */

const PROJECT_ID = 'sistematemfe';
const AUTH_EMULATOR = 'http://localhost:9099';
const API_KEY = 'fake-api-key-emulator'; // Qualquer valor funciona no emulador

const TEST_USER = {
  email: 'admin@tem.local',
  password: 'senha123',
  displayName: 'Admin Local',
};

async function waitForEmulator(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(`${AUTH_EMULATOR}/`);
      return;
    } catch {
      process.stdout.write(`\r⏳ Aguardando emulador Auth iniciar... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Emulador Auth não respondeu a tempo. Verifique se "npm run emulators" está rodando.');
}

async function createUser() {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
        displayName: TEST_USER.displayName,
        returnSecureToken: false,
      }),
    }
  );
  return res.json();
}

async function listUsers() {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return res.json();
}

async function main() {
  console.log('\n🔥 Seed do emulador Firebase\n');

  await waitForEmulator();
  process.stdout.write('\r');

  // Verifica se usuário já existe
  const existing = await listUsers();
  const users = existing.userInfo || [];
  const alreadyExists = users.some((u) => u.email === TEST_USER.email);

  if (alreadyExists) {
    console.log(`✅ Usuário já existe no emulador.`);
  } else {
    const result = await createUser();
    if (result.error) {
      console.error('❌ Erro ao criar usuário:', result.error.message);
      process.exit(1);
    }
    console.log('✅ Usuário criado com sucesso!');
  }

  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  Credenciais para login local        │');
  console.log('├─────────────────────────────────────┤');
  console.log(`│  E-mail:  ${TEST_USER.email.padEnd(26)}│`);
  console.log(`│  Senha:   ${TEST_USER.password.padEnd(26)}│`);
  console.log('├─────────────────────────────────────┤');
  console.log('│  UI Emuladores: http://localhost:4000│');
  console.log('│  App:           http://localhost:4200│');
  console.log('└─────────────────────────────────────┘\n');
}

main().catch((e) => {
  console.error('\n❌ Falha no seed:', e.message);
  process.exit(1);
});
