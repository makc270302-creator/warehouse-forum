export type UserRole = "employee" | "shift_lead" | "admin";
export type UserStatus = "active" | "inactive";
export type PostType = "announcement" | "discussion" | "instruction";
export type Priority = "normal" | "important" | "critical";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
