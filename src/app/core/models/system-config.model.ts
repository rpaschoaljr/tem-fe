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
    section?: string;    // Agrupamento para o formulário (ex: 'Dados Pessoais', 'Vida Espiritual')
    deleted?: boolean;   // Soft delete para campos
    showInProfile?: boolean; // Se o campo deve aparecer no perfil do usuário
}

export interface ModuleConfig {
    id: string;
    fields: DynamicField[];
    updatedAt: Date;
}

export interface ModulePermissions {
    read: boolean;
    write: boolean;
}

export interface PermissionConfig {
    id: string; // ex: 'role_DIRETORIA' ou 'user_membro@tem.local'
    type: 'role' | 'user';
    target: string; // Nome da role ou email do usuário
    modules: {
        members: ModulePermissions;
        finance: ModulePermissions;
        stock: ModulePermissions;
        settings: ModulePermissions;
        notices: ModulePermissions;
        [key: string]: ModulePermissions;
    };
    updatedAt: Date;
}
