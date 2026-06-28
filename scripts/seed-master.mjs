/**
 * SEED DINÂMICO PARA EMULADOR FIREBASE (MASTER - CARGA PESADA)
 * 50 Financeiro | 50 Estoque | Membros p/ cada Role | 5 Avisos
 * Com VERIFICAÇÃO de leitura final para confirmar a criação.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT || 'demo-sistematemfe';
const AUTH_PORT = process.env.FIREBASE_AUTH_PORT || '9099';
const FIRESTORE_PORT = process.env.FIREBASE_FIRESTORE_PORT || '8080';
const AUTH_EMULATOR = `http://localhost:${AUTH_PORT}`;
const FIRESTORE_API = `http://localhost:${FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
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
  const url = `${FIRESTORE_API}/${collection}/${id}`; // URL direta para o documento
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, formatFirestoreValue(v)])) };
  
  // Usamos PATCH para fazer um UPSERT (cria ou atualiza)
  const res = await fetch(url, { 
    method: 'PATCH', 
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer owner' 
    }, 
    body: JSON.stringify(body) 
  });
  if (!res.ok) {
    const err = await res.json();
    console.error(`❌ Erro ao salvar ${collection}/${id}:`, JSON.stringify(err));
  }
}

async function firestoreDeleteAll(collectionName) {
  const url = `${FIRESTORE_API}/${collectionName}`;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer owner' } });
  const json = await res.json();
  const docs = json.documents || [];
  for (const doc of docs) {
    await fetch(`http://localhost:${FIRESTORE_PORT}/v1/${doc.name}`, { 
      method: 'DELETE', 
      headers: { 'Authorization': 'Bearer owner' } 
    });
  }
}

async function verifyDatabase() {
  console.log('\n🔍 VERIFICANDO BANCO DE DADOS APÓS SEED:');
  const collections = ['members', 'transactions', 'stock', 'permissions', 'sales'];
  
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

// Funções de Normalização e Formatação
function normalize(val) {
  if (!val) return '';
  return val.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function formatCPF(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}

function formatCEP(cep) {
  return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
}

function generateCPF() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const calc = (t) => {
    let s = 0;
    for (let i = 0; i < t; i++) s += n[i] * ((t + 1) - i);
    s = (s * 10) % 11;
    return s === 10 ? 0 : s;
  };
  n.push(calc(9));
  n.push(calc(10));
  return n.join('');
}

async function seed() {
  console.log('\n🚀 Iniciando SEED de alta carga...');
  const collections = ['system_configs', 'members', 'members_private', 'members_spiritual', 'permissions', 'transactions', 'stock', 'notices', 'sales'];
  for (const col of collections) {
    process.stdout.write(`🧹 Limpando ${col}... `);
    await firestoreDeleteAll(col);
    console.log('OK');
  }

  const now = new Date();

  // 1. Permissões e Membros por Role
  console.log('👤 Criando Membros e Permissões (Fatiados)...');
  for (const role of ROLES) {
    const normalizedRole = normalize(role).toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${normalizedRole}@tem.local`;
    const id = `seed-${email}`;
    const rawCpf = generateCPF();
    const rawPhone = `119${Math.floor(10000000 + Math.random() * 90000000)}`;
    const rawCep = '01001000';

    await createUser(email);
    
    // --- FATIA 1: BÁSICA (members) ---
    const memberName = `Membro ${role}`;
    await firestoreCreate('members', id, {
      id, 
      name: memberName, 
      name_search: normalize(memberName),
      email, 
      email_search: email.toLowerCase(),
      role, 
      status: 'Ativo', 
      deleted: false,
      isExempt: role === 'DIRETORIA',
      entryDate: now, createdAt: now, updatedAt: now,
    });

    // --- FATIA 2: PRIVADA (members_private) ---
    await firestoreCreate('members_private', id, {
      id,
      email, // usado para busca e validação de posse
      cpf: formatCPF(rawCpf),
      cpf_search: rawCpf,
      phone: formatPhone(rawPhone),
      phone_search: rawPhone,
      address: { 
        city: 'SÃO PAULO', 
        state: 'SP', 
        neighborhood: 'CENTRO', 
        number: '1', 
        street: 'RUA TESTE', 
        cep: formatCEP(rawCep) 
      },
      cep_search: rawCep,
      updatedAt: now
    });

    // --- FATIA 3: ESPIRITUAL (members_spiritual) ---
    await firestoreCreate('members_spiritual', id, {
      id,
      email,
      showSpiritualData: true,
      rituals: {}, 
      consecrations: {},
      observations: `Observações para o cargo ${role}`,
      updatedAt: now
    });

    await firestoreCreate('permissions', email, {
      id: email, type: 'user', target: role, updatedAt: now,
      hierarchyLevel: role === 'DIRETORIA' || role === 'ADMIN'? 10 : 1, modules: {}
    });
  }

  // Admin Master
  await firestoreCreate('permissions', 'admin@tem.local', {
    id: 'admin@tem.local', type: 'user', target: 'DIRETORIA', updatedAt: now,
    hierarchyLevel: 10, modules: {}
  });

  console.log('🎭 Criando permissões de Role...');
  const rolePermissions = [
    {
      role: 'ADMIN',
      hierarchyLevel: 10,
      modules: {
        members: { read: true, write: true }, finance: { read: true, write: true },
        stock: { read: true, write: true }, settings: { read: true, write: true }, 
        notices: { read: true, write: true }, dashboard: { read: true, write: true }, pdv: { read: true, write: true }
      }
    },
    {
      role: 'DIRETORIA',
      hierarchyLevel: 10,
      modules: {
        members: { read: true, write: true }, finance: { read: true, write: true },
        stock: { read: true, write: true }, settings: { read: true, write: true }, 
        notices: { read: true, write: true }, dashboard: { read: true, write: true }, pdv: { read: true, write: true }
      }
    },
    {
      role: 'PAI/MÃE PEQUENO',
      hierarchyLevel: 5,
      modules: {
        members: { read: true, write: true }, finance: { read: false, write: false },
        stock: { read: true, write: true }, settings: { read: false, write: false }, 
        notices: { read: true, write: true }, dashboard: { read: true, write: true }, pdv: { read: true, write: true }
      }
    },
    {
      role: 'OGÃ',
      hierarchyLevel: 2,
      modules: {
        members: { read: true, write: false }, finance: { read: false, write: false },
        stock: { read: true, write: true }, settings: { read: false, write: false }, 
        notices: { read: true, write: false }, dashboard: { read: true, write: true }, pdv: { read: true, write: true }
      }
    },
    {
      role: 'CAMBONO',
      hierarchyLevel: 2,
      modules: {
        members: { read: true, write: false }, finance: { read: false, write: false },
        stock: { read: true, write: true }, settings: { read: false, write: false }, 
        notices: { read: true, write: false }, dashboard: { read: true, write: true }, pdv: { read: true, write: true }
      }
    },
    {
      role: 'MÉDIUM',
      hierarchyLevel: 1,
      modules: {
        members: { read: true, write: false }, finance: { read: false, write: false },
        stock: { read: false, write: false }, settings: { read: false, write: false }, 
        notices: { read: true, write: false }, dashboard: { read: true, write: true }, pdv: { read: false, write: false }
      }
    },
    {
      role: 'CONSULENTE',
      hierarchyLevel: 0,
      modules: {
        members: { read: false, write: false }, finance: { read: false, write: false },
        stock: { read: false, write: false }, settings: { read: false, write: false }, 
        notices: { read: true, write: false }, dashboard: { read: true, write: false }, pdv: { read: false, write: false }
      }
    }
  ];

  for (const p of rolePermissions) {
    const roleId = `role_${normalize(p.role).replace(/[^A-Z0-9]/g, "")}`;
    await firestoreCreate('permissions', roleId, {
      id: roleId,
      type: 'role',
      target: p.role,
      hierarchyLevel: p.hierarchyLevel,
      modules: p.modules,
      updatedAt: now
    });
  }

  // 2. Financeiro (50 operações)
  console.log('💰 Gerando 50 operações financeiras...');
  const incomeCats = [
    { cat: 'MENSALIDADE', cost: 'RECEITAS OPERACIONAIS' },
    { cat: 'DOAÇÃO', cost: 'RECEITAS OPERACIONAIS' },
    { cat: 'EVENTO', cost: 'RECEITAS OPERACIONAIS' }
  ];
  const expenseCats = [
    { cat: 'CONTAS', cost: 'DESPESAS ADMINISTRATIVAS' },
    { cat: 'MANUTENÇÃO', cost: 'MANUTENÇÃO E OBRAS' },
    { cat: 'VELAS E ERVAS', cost: 'DESPESAS RELIGIOSAS' }
  ];
  const paymentMethods = ['DINHEIRO', 'PIX', 'CARTÃO DE CRÉDITO', 'BOLETO'];
  const bankAccounts = ['CAIXA FÍSICO', 'NUBANK', 'MERCADO PAGO'];

  for (let i = 1; i <= 50; i++) {
    const isIncome = Math.random() > 0.4;
    const value = (Math.random() * 200 + 20) * (isIncome ? 1 : -1);
    const date = new Date();
    
    const catObj = isIncome 
      ? incomeCats[Math.floor(Math.random() * incomeCats.length)]
      : expenseCats[Math.floor(Math.random() * expenseCats.length)];
      
    const payMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const bankAccount = bankAccounts[Math.floor(Math.random() * bankAccounts.length)];
    
    // Calcula taxa fictícia para cartão ou boleto
    let fee = 0;
    if (payMethod === 'CARTÃO DE CRÉDITO') fee = Math.abs(value) * 0.05; // 5%
    if (payMethod === 'BOLETO') fee = 3.50;
    
    const netValue = (Math.abs(value) - fee) * (isIncome ? 1 : -1);

    const desc = `${isIncome ? 'Entrada' : 'Saída'} de teste ${i}`;
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));
    await firestoreCreate('transactions', `t${i}`, {
      id: `t${i}`, description: desc,
      description_search: normalize(desc),
      value, netValue, fee,
      category: catObj.cat,
      category_search: normalize(catObj.cat),
      costCenter: catObj.cost,
      paymentMethod: payMethod,
      bankAccount: bankAccount,
      date, deleted: false, type: isIncome ? 'Entrada' : 'Saída',
      updatedAt: now
    });
  }

  // 3. Estoque (50 itens)
  console.log('📦 Gerando 50 itens de estoque...');
  const stockCats = ['VELAS', 'ERVAS', 'BEBIDAS', 'LITURGIA'];
  const units = ['UN', 'KG', 'PCT', 'L'];
  for (let i = 1; i <= 50; i++) {
    const rand = Math.random();
    let quantity = Math.floor(Math.random() * 50);
    if (rand < 0.2) quantity = 0;
    else if (rand < 0.5) quantity = Math.floor(Math.random() * 5) + 1;
    const itemName = `Item de Estoque ${i}`;
    const catName = stockCats[Math.floor(Math.random() * stockCats.length)];
    
    // Configurações de Venda
    const isForSale = Math.random() > 0.3; // 70% chance de ser vendável
    const salePrice = isForSale ? parseFloat((Math.random() * 50 + 5).toFixed(2)) : undefined;
    const allowBackorder = isForSale && Math.random() > 0.7;

    // Gerar Lotes simulados
    const lots = [];
    let remainingQty = quantity;
    if (remainingQty > 0) {
        const numLots = Math.floor(Math.random() * 3) + 1; // 1 a 3 lotes
        let qtyPerLot = Math.floor(remainingQty / numLots);
        for(let l=0; l<numLots; l++) {
            let lotQty = (l === numLots - 1) ? remainingQty : qtyPerLot;
            remainingQty -= lotQty;
            const lotCost = salePrice ? parseFloat((salePrice * (Math.random() * 0.4 + 0.3)).toFixed(2)) : parseFloat((Math.random() * 30 + 2).toFixed(2));
            const lotDate = new Date();
            lotDate.setDate(lotDate.getDate() - Math.floor(Math.random() * 30)); // Até 30 dias atrás
            lots.push({
                id: `lote_${lotDate.getTime()}_${l}`,
                quantity: lotQty,
                purchasePrice: lotCost,
                date: lotDate
            });
        }
    }

    await firestoreCreate('stock', `s${i}`, {
      id: `s${i}`, name: itemName,
      name_search: normalize(itemName),
      category: catName,
      category_search: normalize(catName),
      quantity, unit: units[i % units.length], minStock: 10,
      deleted: false, updatedAt: now,
      isForSale, salePrice, allowBackorder, lots
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
      { key: 'cpf', label: 'CPF', type: 'mask', maskType: 'cpf', required: true, order: 2, isSystem: true, section: 'Dados Pessoais', showInProfile: true },
      { key: 'email', label: 'E-mail', type: 'text', required: true, order: 3, isSystem: true, section: 'Dados Pessoais', showInProfile: true },
      { key: 'phone', label: 'Telefone/Whatsapp', type: 'mask', maskType: 'phone', required: true, order: 4, isSystem: true, section: 'Dados Pessoais', showInProfile: true },
      { key: 'cep', label: 'CEP', type: 'mask', maskType: 'cep', required: true, order: 5, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'street', label: 'Rua / Logradouro', type: 'text', required: true, order: 6, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'number', label: 'Número', type: 'text', required: true, order: 7, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'complement', label: 'Complemento', type: 'text', required: false, order: 8, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'neighborhood', label: 'Bairro', type: 'text', required: true, order: 9, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'city', label: 'Cidade', type: 'text', required: true, order: 10, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'state', label: 'UF', type: 'text', required: true, order: 11, isSystem: true, section: 'Endereço', showInProfile: true },
      { key: 'role', label: 'Função / Cargo', type: 'select', required: true, order: 12, isSystem: true, section: 'Vida Espiritual', showInProfile: true,
        options: ROLES.map(r => ({ label: r, deleted: false })) },
      { key: 'status', label: 'Status', type: 'select', required: true, order: 13, isSystem: true, section: 'Vida Espiritual', showInProfile: true,
        options: [{ label: 'Ativo', deleted: false }, { label: 'Inativo', deleted: false }] },
      { key: 'isExempt', label: 'Isento de Mensalidade', type: 'boolean', required: false, order: 14, isSystem: true, section: 'Vida Espiritual', showInProfile: true },
      { key: 'showSpiritualData', label: 'Liberar Dados Espirituais', type: 'boolean', required: false, order: 15, isSystem: true, section: 'Vida Espiritual', showInProfile: true },
      { key: 'entryDate', label: 'Data de Entrada', type: 'date', required: true, order: 16, isSystem: true, section: 'Vida Espiritual', showInProfile: true },
      { key: 'exitDate', label: 'Data de Saída', type: 'date', required: false, order: 16, isSystem: true, section: 'Vida Espiritual', showInProfile: true },
      { key: 'observations', label: 'Observações', type: 'text', required: false, order: 17, isSystem: true, section: 'Vida Espiritual', showInProfile: true },
      { key: 'initiation', label: 'Lavagem / Iniciação', type: 'date', required: false, order: 18, isSystem: true, section: 'Rituais', showInProfile: true },
      { key: 'baptism', label: 'Batismo', type: 'date', required: false, order: 19, isSystem: true, section: 'Rituais', showInProfile: true },
      { key: 'baptism1Year', label: 'Batismo (1 Ano)', type: 'date', required: false, order: 20, isSystem: true, section: 'Rituais', showInProfile: true },
      { key: 'coronation', label: 'Coroação', type: 'date', required: false, order: 21, isSystem: true, section: 'Rituais', showInProfile: true },
      { key: 'crownWashing', label: 'Lavagem de Coroa', type: 'date', required: false, order: 22, isSystem: true, section: 'Rituais', showInProfile: true },
      { key: 'oxossi', label: 'Oxóssi', type: 'date', required: false, order: 23, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'iemanja', label: 'Iemanjá', type: 'date', required: false, order: 24, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'oxala', label: 'Oxalá', type: 'date', required: false, order: 25, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'ogum', label: 'Ogum', type: 'date', required: false, order: 26, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'obaluae', label: 'Obaluaê', type: 'date', required: false, order: 27, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'oxum', label: 'Oxum', type: 'date', required: false, order: 28, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'xango', label: 'Xangô', type: 'date', required: false, order: 29, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'oba', label: 'Obá', type: 'date', required: false, order: 30, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'omulu', label: 'Omulú', type: 'date', required: false, order: 31, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'logunan', label: 'Logunã', type: 'date', required: false, order: 32, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'iansa', label: 'Iansã', type: 'date', required: false, order: 33, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'nana', label: 'Nanã', type: 'date', required: false, order: 34, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'oxumare', label: 'Oxumaré', type: 'date', required: false, order: 35, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true },
      { key: 'oroina', label: 'Oroiná (Egunitá)', type: 'date', required: false, order: 36, isSystem: true, section: 'Consagrações (Orixás)', showInProfile: true }
    ]
  });

  await firestoreCreate('system_configs', 'finance', {
    id: 'finance', updatedAt: now,
    fields: [
      { 
        key: 'category', label: 'Categoria Financeira', type: 'select', required: true, order: 1, isSystem: true,
        options: [
          { label: 'DOAÇÃO', deleted: false, meta: 'Entrada', requiresMember: false, costCenter: 'RECEITAS OPERACIONAIS', defaultPaymentMethod: 'PIX', defaultBankAccount: 'CAIXA FÍSICO' },
          { label: 'MENSALIDADE', deleted: false, meta: 'Entrada', requiresMember: true, costCenter: 'RECEITAS OPERACIONAIS', defaultPaymentMethod: 'PIX', defaultBankAccount: 'NUBANK' },
          { label: 'CONTAS', deleted: false, meta: 'Saída', requiresMember: false, costCenter: 'DESPESAS ADMINISTRATIVAS', defaultPaymentMethod: 'BOLETO', defaultBankAccount: 'NUBANK' },
          { label: 'MANUTENÇÃO', deleted: false, meta: 'Saída', requiresMember: false, costCenter: 'MANUTENÇÃO E OBRAS', defaultPaymentMethod: 'PIX', defaultBankAccount: 'CAIXA FÍSICO' },
          { label: 'EVENTO', deleted: false, meta: 'Entrada', requiresMember: false, costCenter: 'RECEITAS OPERACIONAIS', defaultPaymentMethod: 'DINHEIRO', defaultBankAccount: 'CAIXA FÍSICO' },
          { label: 'VELAS E ERVAS', deleted: false, meta: 'Saída', requiresMember: false, costCenter: 'DESPESAS RELIGIOSAS', defaultPaymentMethod: 'CARTÃO DE CRÉDITO', defaultBankAccount: 'NUBANK' }
        ]
      },
      { 
        key: 'paymentMethod', label: 'Forma de Pagamento', type: 'select', required: true, order: 2, isSystem: true,
        options: [
          { label: 'DINHEIRO', deleted: false }, { label: 'PIX', deleted: false },
          { label: 'CARTÃO DE CRÉDITO', deleted: false }, { label: 'CARTÃO DE DÉBITO', deleted: false },
          { label: 'BOLETO', deleted: false }, { label: 'TRANSFERÊNCIA', deleted: false }
        ]
      },
      { 
        key: 'bankAccount', label: 'Conta Bancária / Caixa', type: 'select', required: true, order: 3, isSystem: true,
        options: [
          { label: 'CAIXA FÍSICO', deleted: false }, { label: 'NUBANK', deleted: false },
          { label: 'MERCADO PAGO', deleted: false }, { label: 'BRADESCO', deleted: false }
        ]
      },
      { 
        key: 'costCenter', label: 'Centro de Custo (DRE)', type: 'select', required: true, order: 4, isSystem: true,
        options: [
          { label: 'RECEITAS OPERACIONAIS', deleted: false, meta: 'Entrada' },
          { label: 'DESPESAS ADMINISTRATIVAS', deleted: false, meta: 'Saída' },
          { label: 'DESPESAS RELIGIOSAS', deleted: false, meta: 'Saída' },
          { label: 'DESPESAS FINANCEIRAS', deleted: false, meta: 'Saída' },
          { label: 'DESPESAS COM PESSOAL', deleted: false, meta: 'Saída' },
          { label: 'MANUTENÇÃO E OBRAS', deleted: false, meta: 'Saída' }
        ]
      }
    ]
  });

  await firestoreCreate('system_configs', 'stock', {
    id: 'stock', updatedAt: now,
    fields: [
      { 
        key: 'category', label: 'Categoria', type: 'select', required: true, order: 1, isSystem: true,
        options: [
          { label: 'VELAS', deleted: false }, { label: 'ERVAS', deleted: false },
          { label: 'BEBIDAS', deleted: false }, { label: 'LITURGIA', deleted: false }
        ]
      },
      { 
        key: 'unit', label: 'Unidade de Medida', type: 'select', required: true, order: 2, isSystem: true,
        options: [
          { label: 'UN', deleted: false }, { label: 'KG', deleted: false }, { label: 'L', deleted: false }
        ]
      }
    ]
  });

  await firestoreCreate('system_configs', 'pdv', {
    id: 'pdv', updatedAt: now,
    fields: [
      { 
        key: 'paymentMethods', label: 'Métodos de Pagamento', type: 'select', required: true, order: 1, isSystem: true,
        options: [
          { label: 'PIX', deleted: false }, { label: 'DINHEIRO', deleted: false },
          { label: 'CARTÃO DE CRÉDITO', deleted: false }, { label: 'CARTÃO DE DÉBITO', deleted: false }
        ]
      }
    ]
  });

  console.log('🛒 Criando Vendas do PDV...');
  const sale1Date = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago (fora do tempo)
  const sale2Date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (dentro do tempo)
  const sale3Date = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago (dentro do tempo)

  await firestoreCreate('sales', 'sale-1', {
    totalAmount: 15.00,
    paymentMethod: 'PIX',
    date: sale1Date,
    deleted: false,
    items: [
      { itemId: 'stock-vela-branca', name: 'Vela Branca 7 Dias', quantity: 1, unitPrice: 15.00, totalPrice: 15.00, totalCost: 5.00, fractionFactor: 1 }
    ]
  });

  await firestoreCreate('sales', 'sale-2', {
    totalAmount: 50.00,
    paymentMethod: 'DINHEIRO',
    date: sale2Date,
    deleted: false,
    items: [
      { itemId: 'stock-banho-defesa', name: 'Banho de Defesa', quantity: 2, unitPrice: 25.00, totalPrice: 50.00, totalCost: 15.00, fractionFactor: 1 }
    ]
  });

  await firestoreCreate('sales', 'sale-3', {
    totalAmount: 120.00,
    paymentMethod: 'CARTÃO DE CRÉDITO',
    date: sale3Date,
    deleted: false,
    items: [
      { itemId: 'stock-pemba', name: 'Pemba Branca', quantity: 10, unitPrice: 12.00, totalPrice: 120.00, totalCost: 30.00, fractionFactor: 1 }
    ]
  });

  console.log('\n✅ SEED CONCLUÍDO!');
  await verifyDatabase();
}

waitForEmulator().then(seed).catch(console.error);
