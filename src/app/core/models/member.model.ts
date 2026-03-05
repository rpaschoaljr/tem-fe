export interface Member {
    id: string;
    // --- Identificação ---
    name: string;
    cpf: string;
    email: string;
    phone: string;
    photoUrl?: string; // Mantemos para futuro

    // --- Endereço ---
    address: {
        cep: string;
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
    };

    // --- Sistema ---
    status: 'Ativo' | 'Inativo'; // Derivado do is_deleted ou manual
    deleted: boolean;
    isFirstAccess?: boolean; // Novo campo para controle de primeiro acesso
    showSpiritualData?: boolean; // Permissão para o próprio membro ver sua vida espiritual

    // --- Vínculo e Histórico ---
    role: 'MÉDIUM' | 'CAMBONO' | 'OGÃ' | 'PAI/MÃE PEQUENO' | 'DIRETORIA'; // Exemplo
    entryDate: Date;
    exitDate?: Date | null;
    observations?: string;

    // --- Rituais ---
    rituals: {
        initiation?: Date | null;    // Lavagem/Iniciação
        baptism?: Date | null;
        baptism1Year?: Date | null;
        coronation?: Date | null;
        crownWashing?: Date | null;  // Lavagem de Coroa
    };

    // --- Consagrações (Matriz Orixás) ---
    consecrations: {
        oxossi?: Date | null;
        iemanja?: Date | null;
        oxala?: Date | null;
        ogum?: Date | null;
        obaluae?: Date | null;
        oxum?: Date | null;
        xango?: Date | null;
        oba?: Date | null;
        omulu?: Date | null;
        logunan?: Date | null;
        iansa?: Date | null;
        nana?: Date | null;
        oxumare?: Date | null;
        oroina?: Date | null; // Egunitá
    };

    // --- Auditoria ---
    createdAt: Date;
    updatedAt: Date;
    updatedBy?: string;

    // --- Campos Dinâmicos ---
    customFields?: { [key: string]: any };
}