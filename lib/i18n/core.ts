import { ui } from "./ui.ts";
import { story } from "./story.ts";
import { errors } from "./errors.ts";

export type Locale = "zh" | "en";
export const localeCookie = "crous-locale";
export function parseLocale(value: string | undefined): Locale { return value === "en" ? "en" : "zh"; }
export type Translator = (message: string, ...values: Array<string | number>) => string;
export const englishMessages = { ...ui, ...story, ...errors };

export function translator(locale: Locale): Translator {
  return (message, ...values) => {
    const template = locale === "en" ? englishMessages[message] ?? message : message;
    return template.replace(/\{(\d+)\}/g, (placeholder, index: string) => values[Number(index)] === undefined ? placeholder : String(values[Number(index)]));
  };
}
