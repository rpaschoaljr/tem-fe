import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection } from '@angular/fire/firestore';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { ModuleConfig, DynamicField, FieldOption } from '../models/system-config.model';

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
                        { label: 'DOAÇÃO', deleted: false },
                        { label: 'MENSALIDADE', deleted: false },
                        { label: 'CONTAS', deleted: false },
                        { label: 'MANUTENÇÃO', deleted: false },
                        { label: 'EVENTO', deleted: false }
                    ], 
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
