/**
 * Cria automaticamente usuários de teste no emulador do Firebase Auth.
 * Popula o Firestore com membros, transações e estoque.
 */

const PROJECT_ID = 'sistematemfe';
const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_EMULATOR = 'http://localhost:8080';
const API_KEY = 'fake-api-key-emulator';

const TEST_USERS = [
  { email: 'admin@tem.local', password: 'senha123', displayName: 'Admin Local', role: 'DIRETORIA' },
  { email: 'mae@tem.local', password: 'senha123', displayName: 'Mãe de Santo', role: 'PAI/MÃE PEQUENO' },
  { email: 'membro@tem.local', password: 'senha123', displayName: 'Membro Teste', role: 'MÉDIUM' },
];

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
  throw new Error('Emulador Auth não respondeu a tempo.');
}

async function createUser(user) {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
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

function formatFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(formatFirestoreValue) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, formatFirestoreValue(val)])
    )}};
  }
  return { stringValue: String(v) };
}

async function firestoreCreate(collection, id, data) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${id}`;
  const body = {
    fields: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, formatFirestoreValue(v)])
    ),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Erro ao criar documento ${id} em ${collection}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function firestoreList(collection) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.documents || [];
}

async function seedFirestore() {
  console.log('⏳ Aguardando Firestore emulator estar 100% pronto...');
  // Um pequeno delay extra garante que o Firestore processou as novas regras antes do seed
  await new Promise(r => setTimeout(r, 5000));

  const existingMembers = await firestoreList('members');
  if (existingMembers.length > 0) {
    console.log(`✅ Firestore já contém dados (${existingMembers.length} membros). Pulando seed.`);
    return;
  }

  // 1. Membros
  const sampleMembers = [
    {
      id: 'seed-admin-id',
      name: 'Administrador do Sistema',
      cpf: '123.456.789-00',
      email: 'admin@tem.local',
      phone: '(11) 98888-7777',
      role: 'DIRETORIA',
      status: 'Ativo',
      deleted: false,
      showSpiritualData: true,
      entryDate: new Date('2010-01-01'),
      address: {
        cep: '01001-000',
        street: 'Praça da Sé',
        number: '100',
        complement: 'Apto 1',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP'
      },
      rituals: { initiation: new Date('2010-06-15'), baptism: new Date('2010-02-20') },
      consecrations: { oxala: new Date('2015-12-25'), ogum: new Date('2012-04-23') },
      createdAt: new Date(), updatedAt: new Date()
    },
    {
      id: 'seed-mae-id',
      name: 'Mãe de Santo Teste',
      cpf: '222.333.444-55',
      email: 'mae@tem.local',
      phone: '(11) 97777-6666',
      role: 'PAI/MÃE PEQUENO',
      status: 'Ativo',
      deleted: false,
      showSpiritualData: true,
      entryDate: new Date('2015-05-10'),
      address: {
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1500',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP'
      },
      rituals: { initiation: new Date('2015-10-10'), coronation: new Date('2020-11-20') },
      consecrations: { iemanja: new Date('2016-02-02'), oxum: new Date('2017-12-08') },
      createdAt: new Date(), updatedAt: new Date()
    },
    {
      id: 'seed-membro-id',
      name: 'Membro Teste da Silva',
      cpf: '999.888.777-66',
      email: 'membro@tem.local',
      phone: '(11) 96666-5555',
      role: 'MÉDIUM',
      status: 'Ativo',
      deleted: false,
      showSpiritualData: false,
      entryDate: new Date('2023-01-01'),
      address: {
        cep: '04571-010',
        street: 'Rua Berrini',
        number: '500',
        neighborhood: 'Brooklin',
        city: 'São Paulo',
        state: 'SP'
      },
      rituals: { baptism: new Date('2023-03-15') },
      consecrations: {},
      createdAt: new Date(), updatedAt: new Date()
    }
  ];

  for (const m of sampleMembers) {
    await firestoreCreate('members', m.id, m);
  }

  // 2. Financeiro
  const sampleTx = [
    { id: 'seed-tx-1', description: 'Mensalidade Janeiro - Admin', value: 100, type: 'Entrada', category: 'Mensalidade', date: new Date(), deleted: false },
    { id: 'seed-tx-2', description: 'Doação Reforma Telhado', value: 1500, type: 'Entrada', category: 'Doação', date: new Date(), deleted: false },
    { id: 'seed-tx-3', description: 'Pagamento Luz', value: -250.50, type: 'Saída', category: 'Contas Fixas', date: new Date(), deleted: false },
    { id: 'seed-tx-4', description: 'Compra de Velas e Defumador', value: -180, type: 'Saída', category: 'Material', date: new Date(), deleted: false },
    { id: 'seed-tx-5', description: 'Mensalidade Fevereiro - Membro', value: 100, type: 'Entrada', category: 'Mensalidade', date: new Date(), deleted: false },
  ];
  for (const t of sampleTx) {
    await firestoreCreate('transactions', t.id, t);
  }

  // 3. Estoque
  const sampleStock = [
    { id: 'seed-stock-1', name: 'Vela Branca 7 Dias', category: 'Velas', quantity: 45, minStock: 10, unit: 'un', deleted: false, updatedAt: new Date() },
    { id: 'seed-stock-2', name: 'Vela Vermelha Palito', category: 'Velas', quantity: 120, minStock: 50, unit: 'un', deleted: false, updatedAt: new Date() },
    { id: 'seed-stock-3', name: 'Defumador Completo', category: 'Ervas', quantity: 5, minStock: 10, unit: 'cx', deleted: false, updatedAt: new Date() },
    { id: 'seed-stock-4', name: 'Guia de Cristal Oxalá', category: 'Ritualística', quantity: 2, minStock: 5, unit: 'un', deleted: false, updatedAt: new Date() },
  ];
  for (const s of sampleStock) {
    await firestoreCreate('stock', s.id, s);
  }

  // 4. Avisos
  const sampleNotices = [
    { id: 'seed-n-1', title: 'Festa de Iemanjá', subtitle: 'Dia 02/02 às 18h', content: 'Todos de branco. Trazer flores e oferendas biodegradáveis.', type: 'event', date: new Date('2026-02-02'), expirationDate: new Date('2027-02-03'), deleted: false, createdAt: new Date() },
    { id: 'seed-n-2', title: 'Aviso de Tesouraria', content: 'As mensalidades podem agora ser pagas via PIX na secretaria.', type: 'payment', date: new Date(), deleted: false, createdAt: new Date() },
    { id: 'seed-n-3', title: 'Manutenção do Terreiro', content: 'Mutirão de limpeza no próximo sábado às 09h.', type: 'warning', date: new Date(), deleted: false, createdAt: new Date() },
  ];
  for (const n of sampleNotices) {
    await firestoreCreate('notices', n.id, n);
  }

  // Verificação final
  const membersCount = (await firestoreList('members')).length;
  const txCount = (await firestoreList('transactions')).length;
  const stockCount = (await firestoreList('stock')).length;

  console.log(`✅ Firestore populado: ${membersCount} membros, ${txCount} transações, ${stockCount} itens.`);
  
  if (membersCount === 0) {
    console.warn('⚠️ AVISO: O Firestore parece estar vazio após o seed. Verifique se o Emulador está rodando corretamente em localhost:8080.');
  }
}

async function main() {
  console.log('\n🔥 Seed do emulador Firebase (Completo)\n');
  await waitForEmulator();

  const existing = await listUsers();
  const users = existing.userInfo || [];

  for (const user of TEST_USERS) {
    if (!users.some((u) => u.email === user.email)) {
      await createUser(user);
      console.log(`✅ Usuário criado: ${user.email}`);
    } else {
      console.log(`ℹ️  Usuário já existe: ${user.email}`);
    }
  }

  console.log('\n🗄️  Populando Firestore...');
  try {
    await seedFirestore();
  } catch (err) {
    console.error('\n❌ Erro durante o seed do Firestore:', err.message);
  }

  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  Ambiente de Teste Pronto!           │');
  console.log('├─────────────────────────────────────┤');
  console.log('│  Admin: admin@tem.local / senha123   │');
  console.log('│  Mãe:   mae@tem.local   / senha123   │');
  console.log('│  Membro: membro@tem.local/ senha123  │');
  console.log('└─────────────────────────────────────┘\n');
}

main().catch(console.error);
