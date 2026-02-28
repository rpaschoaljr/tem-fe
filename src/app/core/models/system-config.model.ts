export interface FieldOption {
    label: string;
    deleted: boolean;
    meta?: string; // Campo opcional para metadados (ex: 'Entrada', 'Saída', etc)
    requiresMember?: boolean; // Se verdadeiro, exige selecionar um membro no lançamento
}

export interface DynamicField {
    key: string;        // ex: 'category'
    label: string;      // ex: 'Categoria'
    type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'mask';
    maskType?: 'cpf' | 'phone' | 'cep';
    options?: FieldOption[]; // Agora é um objeto com flag de exclusão
    required: boolean;
    order: number;
    isSystem?: boolean;
}

export interface ModuleConfig {
    id: string;
    fields: DynamicField[];
    updatedAt: Date;
}
