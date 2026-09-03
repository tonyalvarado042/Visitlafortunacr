/** Un texto a babosa de URL: sin tildes, minúsculas, guiones. */
export function babosaDe(valor: string, largo = 80): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, largo);
}
