import { clsx, type ClassValue } from "clsx"; // biblioteca para juntar classes CSS
import { twMerge } from "tailwind-merge"; // remove conflitos de classes Tailwind

export function cn(...inputs: ClassValue[]) { // função utilitária para classes CSS
  return twMerge(clsx(inputs)); // junta classes e resolve conflitos
}