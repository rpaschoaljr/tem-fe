export interface StockItem {
    id: string;
    name: string;
    category: string; // Ex: Velas, Ervas, Bebidas
    quantity: number;
    minStock?: number; // Opcional (para o alerta Laranja)
    unit: string; // Ex: un, kg, cx
    deleted: boolean;
    updatedAt: Date;
}