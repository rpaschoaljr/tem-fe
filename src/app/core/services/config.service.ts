import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Observable, from, map, of, switchMap, combineLatest, forkJoin } from 'rxjs';
import { ModuleConfig, DynamicField, FieldOption, PermissionConfig, ModulePermissions } from '../models/system-config.model';

@Injectable({ providedIn: 'root' })
export class ConfigService {
    private firestore = inject(Firestore);
    private COL = 'system_configs';
    private PERM_COL = 'permissions';

    getConfig(moduleId: string): Observable<ModuleConfig> {
        const docRef = doc(this.firestore, this.COL, moduleId);
        return from(getDoc(docRef)).pipe(
            map(snap => {
                if (snap.exists()) {
                    return snap.data() as ModuleConfig;
                } else {
                    return this.getDefaultConfig(moduleId);
                }
            })
        );
    }

    saveConfig(config: ModuleConfig): Observable<void> {
        const docRef = doc(this.firestore, this.COL, config.id);
        return from(setDoc(docRef, { ...config, updatedAt: new Date() }));
    }

    // --- PERMISSÕES ---

    getRolePermission(roleName: string): Observable<PermissionConfig> {
        const safeId = `role_${roleName.replace(/\//g, '_')}`;
        const docRef = doc(this.firestore, this.PERM_COL, safeId);
        
        return from(getDoc(docRef)).pipe(
            map(snap => {
                if (snap.exists()) {
                    return snap.data() as PermissionConfig;
                } else {
                    return this.getDefaultRolePermission(safeId, roleName);
                }
            })
        );
    }

    savePermission(perm: PermissionConfig): Observable<void> {
        const docRef = doc(this.firestore, this.PERM_COL, perm.id);
        return from(setDoc(docRef, { ...perm, updatedAt: new Date() }));
    }

    getAllRolePermissions(roleNames: string[]): Observable<PermissionConfig[]> {
        if (roleNames.length === 0) return of([]);
        const fetches = roleNames.map(role => this.getRolePermission(role));
        return forkJoin(fetches);
    }

    getUserPermission(email: string): Observable<PermissionConfig> {
        const safeId = email;
        const docRef = doc(this.firestore, this.PERM_COL, safeId);
        return from(getDoc(docRef)).pipe(
            map(snap => {
                if (snap.exists()) {
                    return snap.data() as PermissionConfig;
                }
                return this.getDefaultUserPermission(email);
            })
        );
    }

    saveUserPermission(perm: PermissionConfig): Observable<void> {
        const docRef = doc(this.firestore, this.PERM_COL, perm.id);
        return from(setDoc(docRef, { ...perm, updatedAt: new Date() }));
    }

    private getDefaultUserPermission(email: string): PermissionConfig {
        const defaultModulePerm: ModulePermissions = { read: false, write: false };
        return {
            id: email,
            type: 'user',
            target: email,
            hierarchyLevel: 1,
            modules: {
                dashboard: { ...defaultModulePerm },
                members: { ...defaultModulePerm },
                finance: { ...defaultModulePerm },
                stock: { ...defaultModulePerm },
                notices: { ...defaultModulePerm },
                settings: { ...defaultModulePerm }
            },
            updatedAt: new Date()
        };
    }

    private getDefaultRolePermission(id: string, roleName: string): PermissionConfig {
        const defaultModulePerm: ModulePermissions = { read: false, write: false };
        return {
            id,
            type: 'role',
            target: roleName,
            hierarchyLevel: 1,
            modules: {
                dashboard: { ...defaultModulePerm },
                members: { ...defaultModulePerm },
                finance: { ...defaultModulePerm },
                stock: { ...defaultModulePerm },
                notices: { ...defaultModulePerm },
                settings: { ...defaultModulePerm }
            },
            updatedAt: new Date()
        };
    }

    // --- FIM PERMISSÕES ---

    ensureInitialized(moduleId: string): Observable<void> {
        const docRef = doc(this.firestore, this.COL, moduleId);
        return from(getDoc(docRef)).pipe(
            switchMap(snap => {
                if (!snap.exists()) {
                    return this.saveConfig(this.getDefaultConfig(moduleId));
                }
                return of(undefined);
            })
        );
    }

    private getDefaultConfig(moduleId: string): ModuleConfig {
        let fields: DynamicField[] = [];

        if (moduleId === 'stock') {
            fields = [
                { 
                    key: 'category', 
                    label: 'Categoria', 
                    type: 'select', 
                    options: [
                        { label: 'VELAS', deleted: false },
                        { label: 'ERVAS', deleted: false },
                        { label: 'BEBIDAS', deleted: false },
                        { label: 'LITURGIA', deleted: false },
                        { label: 'LIMPEZA', deleted: false },
                        { label: 'OUTROS', deleted: false }
                    ], 
                    required: true, 
                    order: 1, 
                    isSystem: true 
                },
                { 
                    key: 'unit', 
                    label: 'Unidade de Medida', 
                    type: 'select', 
                    options: [
                        { label: 'UN', deleted: false },
                        { label: 'KG', deleted: false },
                        { label: 'G', deleted: false },
                        { label: 'L', deleted: false },
                        { label: 'ML', deleted: false },
                        { label: 'CX', deleted: false },
                        { label: 'PCT', deleted: false },
                        { label: 'MAÇO', deleted: false }
                    ], 
                    required: true, 
                    order: 2, 
                    isSystem: true 
                }
            ];
        } else if (moduleId === 'finance') {
            fields = [
                { 
                    key: 'category', 
                    label: 'Categoria Financeira', 
                    type: 'select', 
                    options: [
                        { label: 'DOAÇÃO', deleted: false, meta: 'Entrada', requiresMember: false },
                        { label: 'MENSALIDADE', deleted: false, meta: 'Entrada', requiresMember: true },
                        { label: 'CONTAS', deleted: false, meta: 'Saída', requiresMember: false },
                        { label: 'MANUTENÇÃO', deleted: false, meta: 'Saída', requiresMember: false },
                        { label: 'EVENTO', deleted: false, meta: 'Entrada', requiresMember: false }
                    ], 
                    required: true, 
                    order: 1, 
                    isSystem: true 
                }
            ];
        } else if (moduleId === 'members') {
            fields = [
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
                    key: 'role',
                    label: 'Função / Cargo',
                    type: 'select',
                    options: [
                        { label: 'MÉDIUM', deleted: false },
                        { label: 'CAMBONO', deleted: false },
                        { label: 'OGÃ', deleted: false },
                        { label: 'PAI/MÃE PEQUENO', deleted: false },
                        { label: 'DIRETORIA', deleted: false },
                        { label: 'CONSULENTE', deleted: false }
                    ],
                    required: true,
                    order: 12,
                    isSystem: true,
                    section: 'Vida Espiritual'
                },
      { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Ativo', deleted: false }, { label: 'Inativo', deleted: false }], required: true, order: 13, isSystem: true, section: 'Vida Espiritual' },
      { key: 'isExempt', label: 'Isento de Mensalidade', type: 'boolean', required: false, order: 14, isSystem: true, section: 'Vida Espiritual' },
      { key: 'showSpiritualData', label: 'Liberar Dados Espirituais', type: 'boolean', required: false, order: 15, isSystem: true, section: 'Vida Espiritual' },
      { key: 'entryDate', label: 'Data de Entrada', type: 'date', required: true, order: 16, isSystem: true, section: 'Vida Espiritual' },
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
            ];
        }

        return {
            id: moduleId,
            fields: fields,
            updatedAt: new Date()
        };
    }
}
