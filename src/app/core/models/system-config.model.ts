export interface DynamicField {
    key: string;        // ex: 'blood_type'
    label: string;      // ex: 'Tipo Sanguíneo'
    type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'mask';
    maskType?: 'cpf' | 'phone' | 'cep';
    options?: string[]; // Para campos do tipo 'select'
    required: boolean;
    order: number;
    isSystem?: boolean; // Se true, não pode ser excluído (campos base)
}

export interface ModuleConfig {
    id: string; // 'members', 'finance', 'stock', 'notices'
    fields: DynamicField[];
    updatedAt: Date;
}
