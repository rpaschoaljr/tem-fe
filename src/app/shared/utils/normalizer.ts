export class Normalizer {
  /**
   * Versão para busca: Sem acentos, sem espaços extras e em CAIXA ALTA.
   */
  static search(val: string | null | undefined): string {
    if (!val) return '';
    return val
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  /**
   * Mantém apenas números.
   * Ideal para CPF, CEP, Telefone.
   */
  static numbers(val: string | null | undefined): string {
    if (!val) return '';
    return val.replace(/\D/g, '');
  }

  /**
   * Normaliza e-mail (minúsculo e sem espaços).
   */
  static email(val: string | null | undefined): string {
    if (!val) return '';
    return val.trim().toLowerCase();
  }
}
