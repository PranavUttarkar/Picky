declare module 'leo-profanity' {
  interface LeoProfanity {
    check(text: string): boolean;
    clean(text: string, replaceWith?: string): string;
    list(): string[];
    getDictionary(lang?: string): string[];
    add(words: string[] | string): void;
    clearList(): void;
  }
  const leo: LeoProfanity;
  export default leo;
}
