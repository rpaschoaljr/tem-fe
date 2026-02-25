/**
 * Cria automaticamente um usuário de teste no emulador do Firebase Auth.
 * Se o emulador Firestore estiver rodando, também popula as collections.
 * Executar após os emuladores já estarem rodando: node scripts/seed-emulator.mjs
 */

const PROJECT_ID = 'sistematemfe';
const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_EMULATOR = 'http://localhost:8080';
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

async function isFirestoreRunning() {
  try {
    const res = await fetch(`${FIRESTORE_EMULATOR}/`);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
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

// --- Firestore REST helpers ---

async function firestoreGet(collection) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.documents || [];
}

async function firestoreCreate(collection, id, fields) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${id}`;
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => {
        if (v === null || v === undefined) return [k, { nullValue: null }];
        if (typeof v === 'boolean') return [k, { booleanValue: v }];
        if (typeof v === 'number') return [k, { doubleValue: v }];
        if (v instanceof Date) return [k, { timestampValue: v.toISOString() }];
        return [k, { stringValue: String(v) }];
      })
    ),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function seedFirestore() {
  const members = await firestoreGet('members');
  if (members.length > 0) {
    console.log(`✅ Firestore: members já populado (${members.length} docs).`);
  } else {
    const sampleMembers = [
      { id: 'membro-1', name: 'Maria das Graças', role: 'Ialorixá', status: 'Ativo', deleted: false, entryDate: new Date('2020-01-15'), email: 'maria@tem.local', phone: '11999990001', createdAt: new Date(), updatedAt: new Date() },
      { id: 'membro-2', name: 'João da Silva', role: 'Ogã', status: 'Ativo', deleted: false, entryDate: new Date('2021-06-10'), email: 'joao@tem.local', phone: '11999990002', createdAt: new Date(), updatedAt: new Date() },
      { id: 'membro-3', name: 'Ana Lima', role: 'Ekede', status: 'Inativo', deleted: false, entryDate: new Date('2019-03-22'), email: 'ana@tem.local', phone: '11999990003', createdAt: new Date(), updatedAt: new Date() },
    ];
    for (const m of sampleMembers) {
      await firestoreCreate('members', m.id, m);
    }
    console.log(`✅ Firestore: ${sampleMembers.length} membros criados.`);
  }

  const transactions = await firestoreGet('transactions');
  if (transactions.length > 0) {
    console.log(`✅ Firestore: transactions já populado (${transactions.length} docs).`);
  } else {
    const sampleTx = [
      { id: 'tx-1', description: 'Doação Gira de Oxum', value: 500, type: 'Entrada', category: 'Doação', date: new Date('2025-12-15'), deleted: false },
      { id: 'tx-2', description: 'Compra de Velas', value: -120, type: 'Saída', category: 'Material', date: new Date('2025-12-20'), deleted: false },
    ];
    for (const t of sampleTx) {
      await firestoreCreate('transactions', t.id, t);
    }
    console.log(`✅ Firestore: ${sampleTx.length} transações criadas.`);
  }

  const stock = await firestoreGet('stock');
  if (stock.length > 0) {
    console.log(`✅ Firestore: stock já populado (${stock.length} docs).`);
  } else {
    const sampleStock = [
      { id: 'stock-1', name: 'Vela Branca Palito', category: 'Velas', quantity: 150, minStock: 50, unit: 'un', deleted: false, updatedAt: new Date() },
      { id: 'stock-2', name: 'Pemba Branca', category: 'Ritualística', quantity: 0, minStock: 5, unit: 'cx', deleted: false, updatedAt: new Date() },
    ];
    for (const s of sampleStock) {
      await firestoreCreate('stock', s.id, s);
    }
    console.log(`✅ Firestore: ${sampleStock.length} itens de estoque criados.`);
  }
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

  // Tenta seed Firestore (opcional — só disponível com Java 21+)
  const firestoreOk = await isFirestoreRunning();
  if (firestoreOk) {
    console.log('\n🗄️  Populando Firestore...');
    await seedFirestore();
  } else {
    console.log('\nℹ️  Emulador Firestore não disponível (requer Java 21+). Usando localStorage como fallback.');
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

