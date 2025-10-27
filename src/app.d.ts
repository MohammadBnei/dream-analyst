// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: {
        id: string;
      };
    }
    // interface PageData {}
    // interface Platform {}
  }
}

declare module '$env/dynamic/private' {
    export const DATABASE_URL: string;
    // Add other dynamic private variables here
}


export {}
