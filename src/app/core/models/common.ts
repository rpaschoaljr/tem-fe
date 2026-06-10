export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export interface CepResponse {
  cep: string;
  logradouro: string;
  complemento?: string;
  unidade?: string;
  bairro: string;
  localidade: string;
  uf: string;
  estado: string;
  regiao: string;
  ibge: string;
  gia?: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface UserClaims {
  hierarchyLevel: number;
  perms: Record<string, { read: boolean; write: boolean }>;
}
