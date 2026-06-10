/**
 * SEED DINÂMICO PARA EMULADOR FIREBASE (v3)
 * Popula todas as coleções do sistema com dados padronizados e COMPLETOS.
 * Inclui todos os campos obrigatórios dos formulários (entryDate, content, etc).
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT || 'demo-sistematemfe';
const AUTH_EMULATOR = `http://localhost:${process.env.FIREBASE_AUTH_PORT || '9099'}`;
const FIRESTORE_EMULATOR = `http://localhost:${process.env.FIREBASE_FIRESTORE_PORT || '8080'}`;
const API_KEY = 'fake-api-key-emulator';

const TEST_USERS = [
  { email: 'admin@tem.local', password: 'senha123', displayName: 'ADMIN LOCAL', role: 'DIRETORIA' },
  { email: 'mae@tem.local', password: 'senha123', displayName: 'MÃE DE SANTO', role: 'PAI/MÃE PEQUENO' },
  { email: 'membro@tem.local', password: 'senha123', displayName: 'MEMBRO TESTE', role: 'MÉDIUM' },
];

async function waitForEmulator(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(`${AUTH_EMULATOR}/`);
      return;
    } catch {
      process.stdout.write(`\r⏳ Aguardando emuladores iniciarem... (${i + 1}/${maxRetries})`);
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

// --- Firestore Helpers ---

function standardize(text) {
  return (text || '').trim().toUpperCase();
}

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
  return res.json();
}

async function firestoreDeleteAll(collectionName) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}`;
  const res = await fetch(url);
  const json = await res.json();
  const docs = json.documents || [];
  
  for (const doc of docs) {
    await fetch(`${FIRESTORE_EMULATOR}/v1/${doc.name}`, { method: 'DELETE' });
  }
}

async function seedFirestore() {
  console.log('🗄️  Limpando e populando Firestore...');

  const collections = ['system_configs', 'members', 'stock', 'transactions', 'notices', 'permissions', 'user_roles'];
  for (const col of collections) await firestoreDeleteAll(col);

  const now = new Date();

  // 0. Permissões
  const permissions = [
    {
      id: 'role_DIRETORIA', type: 'role', target: 'DIRETORIA', updatedAt: now,
      modules: {
        members: { read: true, write: true }, finance: { read: true, write: true },
        stock: { read: true, write: true }, settings: { read: true, write: true }, notices: { read: true, write: true },
        dashboard: { read: true, write: true }
      }
    },
    {
      id: 'role_PAI_MÃE PEQUENO', type: 'role', target: 'PAI/MÃE PEQUENO', updatedAt: now,
      modules: {
        members: { read: true, write: true }, finance: { read: false, write: false },
        stock: { read: true, write: true }, settings: { read: false, write: false }, notices: { read: true, write: true },
        dashboard: { read: true, write: true }
      }
    },
    {
      id: 'role_MÉDIUM', type: 'role', target: 'MÉDIUM', updatedAt: now,
      modules: {
        members: { read: true, write: false }, finance: { read: false, write: false },
        stock: { read: false, write: false }, settings: { read: false, write: false }, notices: { read: true, write: false },
        dashboard: { read: true, write: true }
      }
    },
    // Exemplo de permissão individual
    {
      id: 'membro@tem.local', type: 'user', target: 'membro@tem.local', updatedAt: now,
      modules: {
        members: { read: true, write: false }, finance: { read: false, write: false },
        stock: { read: true, write: true }, 
        settings: { read: false, write: false }, notices: { read: true, write: false },
        dashboard: { read: true, write: true }
      }
    }
  ];
  for (const p of permissions) await firestoreCreate('permissions', p.id, p);

  // 0.1 Mapeamento de Roles por Email (Para uso nas firestore.rules)
  const userRoles = [
    { id: 'admin@tem.local', role: 'DIRETORIA', permissionId: 'role_DIRETORIA' },
    { id: 'mae@tem.local', role: 'PAI/MÃE PEQUENO', permissionId: 'role_PAI_MÃE PEQUENO' },
    { id: 'membro@tem.local', role: 'MÉDIUM', permissionId: 'role_MÉDIUM' }
  ];
  for (const ur of userRoles) await firestoreCreate('user_roles', ur.id, ur);

  // 1. Configurações
  const configs = [
    {
      id: 'stock',
      fields: [
        { 
          key: 'category', label: 'Categoria', type: 'select', required: true, order: 1, isSystem: true,
          options: [
            { label: 'VELAS', deleted: false }, { label: 'ERVAS', deleted: false }, 
            { label: 'BEBIDAS', deleted: false }, { label: 'LITURGIA', deleted: false },
            { label: 'LIMPEZA', deleted: false }, { label: 'OUTROS', deleted: false }
          ]
        },
        { 
          key: 'unit', label: 'Unidade', type: 'select', required: true, order: 2, isSystem: true,
          options: [
            { label: 'UN', deleted: false }, { label: 'KG', deleted: false }, 
            { label: 'L', deleted: false }, { label: 'PCT', deleted: false }
          ]
        }
      ],
      updatedAt: now
    },
    {
      id: 'finance',
      fields: [
        { 
          key: 'category', label: 'Categoria Financeira', type: 'select', required: true, order: 1, isSystem: true,
          options: [
            { label: 'DOAÇÃO', deleted: false, meta: 'Entrada' }, 
            { label: 'MENSALIDADE', deleted: false, meta: 'Entrada', requiresMember: true }, 
            { label: 'CONTAS', deleted: false, meta: 'Saída' }, 
            { label: 'MANUTENÇÃO', deleted: false, meta: 'Saída' }
          ]
        }
      ],
      updatedAt: now
    },
    {
      id: 'members',
      fields: [
        // Dados Pessoais
        { key: 'name', label: 'Nome Completo', type: 'text', required: true, order: 1, isSystem: true, section: 'Dados Pessoais' },
        { key: 'cpf', label: 'CPF', type: 'mask', maskType: 'cpf', required: true, order: 2, isSystem: true, section: 'Dados Pessoais' },
        { key: 'email', label: 'E-mail', type: 'text', required: true, order: 3, isSystem: true, section: 'Dados Pessoais' },
        { key: 'phone', label: 'Telefone/Whatsapp', type: 'mask', maskType: 'phone', required: true, order: 4, isSystem: true, section: 'Dados Pessoais' },

        // Endereço
        { key: 'cep', label: 'CEP', type: 'mask', maskType: 'cep', required: true, order: 5, isSystem: true, section: 'Endereço' },
        { key: 'street', label: 'Rua / Logradouro', type: 'text', required: true, order: 6, isSystem: true, section: 'Endereço' },
        { key: 'number', label: 'Número', type: 'text', required: true, order: 7, isSystem: true, section: 'Endereço' },
        { key: 'complement', label: 'Complemento', type: 'text', required: false, order: 8, isSystem: true, section: 'Endereço' },
        { key: 'neighborhood', label: 'Bairro', type: 'text', required: true, order: 9, isSystem: true, section: 'Endereço' },
        { key: 'city', label: 'Cidade', type: 'text', required: true, order: 10, isSystem: true, section: 'Endereço' },
        { key: 'state', label: 'UF', type: 'text', required: true, order: 11, isSystem: true, section: 'Endereço' },

        // Vida Espiritual
        { 
          key: 'role', label: 'Função / Cargo', type: 'select', required: true, order: 12, isSystem: true, section: 'Vida Espiritual',
          options: [
            { label: 'MÉDIUM', deleted: false }, { label: 'CAMBONO', deleted: false }, 
            { label: 'OGÃ', deleted: false }, { label: 'PAI/MÃE PEQUENO', deleted: false },
            { label: 'DIRETORIA', deleted: false }, { label: 'CONSULENTE', deleted: false }
          ]
        },
        { 
          key: 'status', label: 'Status', type: 'select', required: true, order: 13, isSystem: true, section: 'Vida Espiritual',
          options: [
            { label: 'Ativo', deleted: false }, { label: 'Inativo', deleted: false }
          ]
        },
        { key: 'showSpiritualData', label: 'Liberar Dados Espirituais', type: 'boolean', required: false, order: 14, isSystem: true, section: 'Vida Espiritual' },
        { key: 'entryDate', label: 'Data de Entrada', type: 'date', required: true, order: 15, isSystem: true, section: 'Vida Espiritual' },
        { key: 'exitDate', label: 'Data de Saída', type: 'date', required: false, order: 16, isSystem: true, section: 'Vida Espiritual' },
        { key: 'observations', label: 'Observações', type: 'text', required: false, order: 17, isSystem: true, section: 'Vida Espiritual' },

        // Rituais
        { key: 'initiation', label: 'Lavagem / Iniciação', type: 'date', required: false, order: 18, isSystem: true, section: 'Rituais' },
        { key: 'baptism', label: 'Batismo', type: 'date', required: false, order: 19, isSystem: true, section: 'Rituais' },
        { key: 'baptism1Year', label: 'Batismo (1 Ano)', type: 'date', required: false, order: 20, isSystem: true, section: 'Rituais' },
        { key: 'coronation', label: 'Coroação', type: 'date', required: false, order: 21, isSystem: true, section: 'Rituais' },
        { key: 'crownWashing', label: 'Lavagem de Coroa', type: 'date', required: false, order: 22, isSystem: true, section: 'Rituais' },

        // Orixás
        { key: 'oxossi', label: 'Oxóssi', type: 'date', required: false, order: 23, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'iemanja', label: 'Iemanjá', type: 'date', required: false, order: 24, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'oxala', label: 'Oxalá', type: 'date', required: false, order: 25, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'ogum', label: 'Ogum', type: 'date', required: false, order: 26, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'obaluae', label: 'Obaluaê', type: 'date', required: false, order: 27, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'oxum', label: 'Oxum', type: 'date', required: false, order: 28, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'xango', label: 'Xangô', type: 'date', required: false, order: 29, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'oba', label: 'Obá', type: 'date', required: false, order: 30, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'omulu', label: 'Omulú', type: 'date', required: false, order: 31, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'logunan', label: 'Logunã', type: 'date', required: false, order: 32, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'iansa', label: 'Iansã', type: 'date', required: false, order: 33, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'nana', label: 'Nanã', type: 'date', required: false, order: 34, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'oxumare', label: 'Oxumaré', type: 'date', required: false, order: 35, isSystem: true, section: 'Consagrações (Orixás)' },
        { key: 'oroina', label: 'Oroiná (Egunitá)', type: 'date', required: false, order: 36, isSystem: true, section: 'Consagrações (Orixás)' }
      ],
      updatedAt: now
    }
  ];
  for (const c of configs) await firestoreCreate('system_configs', c.id, c);

  // 2. Membros (Com TODOS os campos obrigatórios do formulário)
  const members = [
    {
      id: 'seed-admin',
      name: standardize('Administrador do Sistema'),
      cpf: '111.111.111-11',
      email: 'admin@tem.local',
      phone: '(11) 99999-9999',
      role: 'DIRETORIA',
      status: 'Ativo',
      deleted: false,
      entryDate: new Date('2020-01-01'),
      showSpiritualData: true,
      address: { 
        cep: '01001-000', street: standardize('Praça da Sé'), number: '1', 
        neighborhood: standardize('Centro'), city: standardize('São Paulo'), state: 'SP' 
      },
      rituals: { baptism: new Date('2020-01-01'), initiation: new Date('2020-06-15') },
      consecrations: { oxossi: new Date('2021-01-20'), ogum: new Date('2021-04-23') },
      createdAt: now, updatedAt: now
    },
    {
      id: 'seed-mae',
      name: standardize('Mãe de Santo Teste'),
      cpf: '222.222.222-22',
      email: 'mae@tem.local',
      phone: '(11) 88888-8888',
      role: 'PAI/MÃE PEQUENO',
      status: 'Ativo',
      deleted: false,
      entryDate: new Date('2015-10-10'),
      showSpiritualData: true,
      address: { 
        cep: '01001-000', street: standardize('Rua das Flores'), number: '10', 
        neighborhood: standardize('Jardins'), city: standardize('São Paulo'), state: 'SP' 
      },
      rituals: { coronation: new Date('2015-12-25') },
      consecrations: { iemanja: new Date('2016-02-02') },
      createdAt: now, updatedAt: now
    },
    {
      id: 'seed-membro',
      name: standardize('Membro Teste da Silva'),
      cpf: '333.333.333-33',
      email: 'membro@tem.local',
      phone: '(11) 77777-7777',
      role: 'MÉDIUM',
      status: 'Ativo',
      deleted: false,
      entryDate: new Date('2023-01-01'),
      showSpiritualData: false,
      address: { 
        cep: '01001-000', street: standardize('Avenida Paulista'), number: '500', 
        neighborhood: standardize('Bela Vista'), city: standardize('São Paulo'), state: 'SP' 
      },
      rituals: { baptism: new Date('2023-10-10') },
      consecrations: {},
      createdAt: now, updatedAt: now
    }
  ];
  for (const m of members) await firestoreCreate('members', m.id, m);

  // 3. Estoque
  const stockItems = [
    { id: 's1', name: standardize('Vela Branca 7 Dias'), category: 'VELAS', quantity: 50, unit: 'UN', deleted: false, updatedAt: now },
    { id: 's2', name: standardize('Vela Azul Palito'), category: 'VELAS', quantity: 120, unit: 'UN', deleted: false, updatedAt: now },
    { id: 's3', name: standardize('Erva Guiné Seca'), category: 'ERVAS', quantity: 15, unit: 'PCT', deleted: false, updatedAt: now },
    { id: 's4', name: standardize('Cachaça 600ml'), category: 'BEBIDAS', quantity: 0, unit: 'UN', deleted: false, updatedAt: now },
  ];
  for (const s of stockItems) await firestoreCreate('stock', s.id, s);

  // 4. Financeiro
  const transactions = [
    { id: 't1', description: standardize('Doação Anônima'), value: 500, type: 'Entrada', category: 'DOAÇÃO', date: now, deleted: false },
    { id: 't2', description: standardize('Mensalidade Membros'), value: 1200, type: 'Entrada', category: 'MENSALIDADE', date: now, deleted: false },
    { id: 't3', description: standardize('Conta de Luz'), value: -350.50, type: 'Saída', category: 'CONTAS', date: now, deleted: false },
  ];
  for (const t of transactions) await firestoreCreate('transactions', t.id, t);

  // 5. Avisos (Notices)
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  const notices = [
    {
      id: 'n1',
      title: standardize('Festa de Ogum'),
      subtitle: 'PRÓXIMO SÁBADO',
      content: 'Nossa festa anual de Ogum será realizada no próximo sábado às 19h. Todos os médiuns devem vir de branco.',
      type: 'event',
      date: now,
      expirationDate: nextMonth,
      deleted: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'n2',
      title: standardize('Aviso de Mensalidade'),
      subtitle: 'VENCIMENTO DIA 10',
      content: 'Lembramos a todos que o vencimento da mensalidade é dia 10. Favor regularizar com a tesouraria.',
      type: 'payment',
      date: now,
      expirationDate: nextMonth,
      deleted: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'n3',
      title: standardize('Manutenção do Telhado'),
      subtitle: 'SEM GIRA NA SEGUNDA',
      content: 'O terreiro passará por manutenção na segunda-feira. Não haverá gira.',
      type: 'warning',
      date: now,
      expirationDate: nextMonth,
      deleted: false,
      createdAt: now,
      updatedAt: now
    }
  ];
  for (const n of notices) await firestoreCreate('notices', n.id, n);

  console.log('✅ Base de dados restaurada com sucesso!');
  console.log('   - 3 Membros (Com data de entrada e endereço)');
  console.log('   - 4 Itens de Estoque');
  console.log('   - 3 Lançamentos Financeiros');
  console.log('   - 3 Avisos Ativos (Com conteúdo corrigido)');
}

async function main() {
  console.log('\n🔥 SEED DO EMULADOR FIREBASE 🔥\n');
  await waitForEmulator();
  const existing = await listUsers();
  const users = existing.userInfo || [];
  for (const user of TEST_USERS) {
    if (!users.some((u) => u.email === user.email)) await createUser(user);
  }
  await seedFirestore();
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  Ambiente Pronto para Uso!           │');
  console.log('└─────────────────────────────────────┘\n');
}

main().catch(console.error);