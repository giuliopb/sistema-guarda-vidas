const pool = require('../db');

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas_diarias (
            id SERIAL PRIMARY KEY,
            descricao TEXT NOT NULL,
            ativa BOOLEAN NOT NULL DEFAULT true,
            criada_em TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        ALTER TABLE alteracoes
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    `);

    await pool.query(`
        ALTER TABLE alteracoes
        ADD COLUMN IF NOT EXISTS resolucao TEXT
    `);

    await pool.query(`
        ALTER TABLE alteracoes
        ADD COLUMN IF NOT EXISTS criada_em TIMESTAMP NOT NULL DEFAULT NOW()
    `);
}

module.exports = initDatabase;
