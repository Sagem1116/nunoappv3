export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Permissive Database type — table-specific types are not generated.
export type Database = any;
