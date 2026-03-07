export class Normalizer {
  /**
   * Remove acentos, espaços extras e converte para CAIXA ALTA.
   * Ideal para nomes, categorias e descrições.
   */
  static text(val: string | null | undefined): string {
    if (!val) return '';
    return val
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
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
