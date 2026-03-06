/**
 * SEED DINÂMICO PARA EMULADOR FIREBASE (MASTER - CARGA PESADA)
 * 50 Financeiro | 50 Estoque | Membros p/ cada Role | 5 Avisos
 * Com VERIFICAÇÃO de leitura final para confirmar a criação.
 */

const PROJECT_ID = 'sistematemfe';
const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_API = 'http://localhost:8080/v1/projects/sistematemfe/databases/(default)/documents';
const API_KEY = 'fake-api-key-emulator';

const ROLES = ['ADMIN','DIRETORIA', 'PAI/MÃE PEQUENO', 'OGÃ', 'CAMBONO', 'MÉDIUM', 'CONSULENTE'];

async function waitForEmulator(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${AUTH_EMULATOR}/`);
      if (res.ok) return;
    } catch {
      process.stdout.write(`\r⏳ Aguardando emuladores... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function createUser(email, password = 'senha123') {
  await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
}

function formatFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(formatFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, formatFirestoreValue(val)]))}};
  return { stringValue: String(v) };
}

async function firestoreCreate(collection, id, data) {
  const url = `${FIRESTORE_API}/${collection}?documentId=${id}`;
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, formatFirestoreValue(v)])) };
  const res = await fetch(url, { 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer owner' 
    }, 
    body: JSON.stringify(body) 
  });
  if (!res.ok) {
    const err = await res.json();
    console.error(`❌ Erro ao criar ${collection}/${id}:`, JSON.stringify(err));
  }
}

async function firestoreDeleteAll(collectionName) {
  const url = `${FIRESTORE_API}/${collectionName}`;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer owner' } });
  const json = await res.json();
  const docs = json.documents || [];
  for (const doc of docs) {
    await fetch(`http://localhost:8080/v1/${doc.name}`, { 
      method: 'DELETE', 
      headers: { 'Authorization': 'Bearer owner' } 
    });
  }
}

async function verifyDatabase() {
  console.log('\n🔍 VERIFICANDO BANCO DE DADOS APÓS SEED:');
  const collections = ['members', 'transactions', 'stock', 'permissions'];
  
  for (const col of collections) {
    const res = await fetch(`${FIRESTORE_API}/${col}`, {
      headers: { 'Authorization': 'Bearer owner' }
    });
    const json = await res.json();
    const count = json.documents ? json.documents.length : 0;
    if (count > 0) {
      console.log(`✅ Coleção '${col}': ${count} documentos criados.`);
    } else {
      console.error(`🛑 ERRO: Coleção '${col}' está VAZIA.`);
    }
  }
}

async function seed() {
  console.log('\n🚀 Iniciando SEED de alta carga...');
  const collections = ['system_configs', 'members', 'permissions', 'transactions', 'stock', 'notices'];
  for (const col of collections) {
    process.stdout.write(`🧹 Limpando ${col}... `);
    await firestoreDeleteAll(col);
    console.log('OK');
  }

  const now = new Date();

  // 1. Permissões e Membros por Role
  console.log('👤 Criando Membros e Permissões...');
  for (const role of ROLES) {
    const email = `${role.toLowerCase().replace(/[^a-z]/g, '')}@tem.local`;
    const id = `seed-${email}`;
    await createUser(email);
    await firestoreCreate('permissions', email, {
      id: email, type: 'user', target: role, updatedAt: now,
      hierarchyLevel: role === 'DIRETORIA' || role === 'ADMIN'? 10 : 1, modules: {}
    });
    await firestoreCreate('members', id, {
      id, name: `MEMBRO ${role}`, email, role, status: 'Ativo', deleted: false,
      entryDate: now, createdAt: now, updatedAt: now,
      address: { city: 'SÃO PAULO', state: 'SP', neighborhood: 'CENTRO', number: '1', street: 'RUA TESTE', cep: '01001-000' }
    });
  }

  // Admin Master
  await firestoreCreate('permissions', 'admin@tem.local', {
    id: 'admin@tem.local', type: 'user', target: 'DIRETORIA', updatedAt: now,
    hierarchyLevel: 10, modules: {}
  });

  await firestoreCreate('permissions', 'role_DIRETORIA', {
    id: 'role_DIRETORIA', type: 'role', target: 'DIRETORIA', updatedAt: now,
    hierarchyLevel: 10,
    modules: {
      members: { read: true, write: true }, finance: { read: true, write: true },
      stock: { read: true, write: true }, settings: { read: true, write: true }, 
      notices: { read: true, write: true }, dashboard: { read: true, write: true }
    }
  });

  // 2. Financeiro (50 operações)
  console.log('💰 Gerando 50 operações financeiras...');
  const categories = ['DOAÇÃO', 'MENSALIDADE', 'CONTAS', 'MANUTENÇÃO'];
  for (let i = 1; i <= 50; i++) {
    const isIncome = Math.random() > 0.4;
    const value = (Math.random() * 200 + 20) * (isIncome ? 1 : -1);
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));
    await firestoreCreate('transactions', `t${i}`, {
      id: `t${i}`, description: `${isIncome ? 'ENTRADA' : 'SAÍDA'} DE TESTE ${i}`,
      value, category: categories[Math.floor(Math.random() * categories.length)],
      date, deleted: false, type: isIncome ? 'Entrada' : 'Saída'
    });
  }

  // 3. Estoque (50 itens)
  console.log('📦 Gerando 50 itens de estoque...');
  const stockCats = ['VELAS', 'ERVAS', 'BEBIDAS', 'LIMPEZA'];
  const units = ['UN', 'KG', 'PCT', 'L'];
  for (let i = 1; i <= 50; i++) {
    const rand = Math.random();
    let quantity = Math.floor(Math.random() * 50);
    if (rand < 0.2) quantity = 0;
    else if (rand < 0.5) quantity = Math.floor(Math.random() * 5) + 1;
    await firestoreCreate('stock', `s${i}`, {
      id: `s${i}`, name: `ITEM DE ESTOQUE ${i}`, 
      category: stockCats[Math.floor(Math.random() * stockCats.length)],
      quantity, unit: units[i % units.length], minStock: 10,
      deleted: false, updatedAt: now
    });
  }

  // 4. Avisos
  console.log('📢 Gerando 5 avisos...');
  const noticeTypes = ['event', 'warning', 'payment', 'info'];
  for (let i = 1; i <= 5; i++) {
    const exp = new Date();
    exp.setDate(exp.getDate() + 7);
    await firestoreCreate('notices', `n${i}`, {
      id: `n${i}`, title: `AVISO ${i}`, subtitle: `SUBTÍTULO ${i}`,
      content: `Conteúdo do aviso de teste número ${i}.`,
      type: noticeTypes[i % noticeTypes.length], date: now, expirationDate: exp,
      deleted: false, createdAt: now, updatedAt: now
    });
  }

  // 5. Configurações
  await firestoreCreate('system_configs', 'members', {
    id: 'members', updatedAt: now,
    fields: [
      { key: 'name', label: 'Nome Completo', type: 'text', required: true, order: 1, isSystem: true, section: 'Dados Pessoais', showInProfile: true },
      { key: 'email', label: 'E-mail', type: 'text', required: true, order: 3, isSystem: true, section: 'Dados Pessoais', showInProfile: true },
      { key: 'role', label: 'Cargo', type: 'select', required: true, order: 4, isSystem: true, section: 'Vida Espiritual', showInProfile: true,
        options: ROLES.map(r => ({ label: r, deleted: false })) }
    ]
  });

  console.log('\n✅ SEED CONCLUÍDO!');
  await verifyDatabase();
}

waitForEmulator().then(seed).catch(console.error);
