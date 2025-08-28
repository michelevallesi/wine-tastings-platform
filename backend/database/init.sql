-- Inizializzazione database PostgreSQL
CREATE DATABASE vinbooking_db;

-- Connessione al database
\c vinbooking_db;

-- Estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
