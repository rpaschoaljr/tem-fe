
const PROJECT_ID = process.env.FIREBASE_PROJECT || 'demo-sistematemfe';
const FIRESTORE_PORT = process.env.FIREBASE_FIRESTORE_PORT || '8080';
const FIRESTORE_API = `http://localhost:${FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function migrate() {
  console.log('🔄 Iniciando migração de transações com categoria VENDAS para DOAÇÃO...');
  try {
    const res = await fetch(`${FIRESTORE_API}/transactions`, {
      headers: { 'Authorization': 'Bearer owner' }
    });
    if (!res.ok) {
      throw new Error(`Erro ao buscar transações: ${res.statusText}`);
    }
    const json = await res.json();
    const docs = json.documents || [];
    
    let count = 0;
    for (const doc of docs) {
      const fields = doc.fields || {};
      const category = fields.category?.stringValue;
      
      if (category === 'VENDAS') {
        const docId = doc.name.split('/').pop();
        console.log(`✏️ Atualizando transação ${docId}...`);
        
        // Mantemos os campos existentes e atualizamos a categoria
        fields.category = { stringValue: 'DOAÇÃO' };
        if (fields.category_search) {
          fields.category_search = { stringValue: 'DOACAO' };
        }
        
        const updateRes = await fetch(`${FIRESTORE_API}/transactions/${docId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer owner'
          },
          body: JSON.stringify({ fields })
        });
        
        if (updateRes.ok) {
          count++;
        } else {
          console.error(`❌ Falha ao atualizar transação ${docId}:`, await updateRes.text());
        }
      }
    }
    console.log(`✅ Migração concluída! ${count} transações atualizadas.`);
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  }
}

migrate();
