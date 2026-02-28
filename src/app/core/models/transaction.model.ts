export interface Transaction {
    id: string;
    description: string;
    value: number; // Positivo = Entrada, Negativo = Saída
    type: 'Entrada' | 'Saída';
    category: string; // Ex: Mensalidade, Aluguel, Velas
    date: Date;
    deleted: boolean;

    // Vínculo com membro (opcional conforme categoria)
    memberId?: string;
    memberName?: string;
}
