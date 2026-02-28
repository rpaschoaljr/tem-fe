import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection } from '@angular/fire/firestore';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { ModuleConfig, DynamicField } from '../models/system-config.model';

@Injectable({ providedIn: 'root' })
export class ConfigService {
    private firestore = inject(Firestore);
    private COL = 'system_configs';

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

    // Inicializa o banco com configurações básicas se estiver vazio
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
                    options: ['VELAS', 'ERVAS', 'BEBIDAS', 'LITURGIA', 'LIMPEZA', 'OUTROS'], 
                    required: true, 
                    order: 1, 
                    isSystem: true 
                },
                { 
                    key: 'unit', 
                    label: 'Unidade de Medida', 
                    type: 'select', 
                    options: ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'MAÇO'], 
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
                    options: ['DOAÇÃO', 'MENSALIDADE', 'CONTAS', 'MANUTENÇÃO', 'EVENTO'], 
                    required: true, 
                    order: 1, 
                    isSystem: true 
                }
            ];
        }

        return {
            id: moduleId,
            fields: fields,
            updatedAt: new Date()
        };
    }
}
