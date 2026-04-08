const pool = require('../db');

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas_diarias (
            id SERIAL PRIMARY KEY,
            nome TEXT,
            descricao TEXT NOT NULL,
            dia_semana SMALLINT,
            todos_postos BOOLEAN NOT NULL DEFAULT false,
            ativa BOOLEAN NOT NULL DEFAULT true,
            criada_em TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        ALTER TABLE tarefas_diarias
        ADD COLUMN IF NOT EXISTS nome TEXT
    `);

    await pool.query(`
        ALTER TABLE tarefas_diarias
        ADD COLUMN IF NOT EXISTS dia_semana SMALLINT
    `);

    await pool.query(`
        ALTER TABLE tarefas_diarias
        ADD COLUMN IF NOT EXISTS todos_postos BOOLEAN NOT NULL DEFAULT false
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas_diarias_postos (
            tarefa_id INT NOT NULL REFERENCES tarefas_diarias(id) ON DELETE CASCADE,
            posto_id INT NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
            PRIMARY KEY (tarefa_id, posto_id)
        )
    `);

    await pool.query(`
        ALTER TABLE itens
        ADD COLUMN IF NOT EXISTS quantidade_atual INT
    `);

    await pool.query(`
        UPDATE itens
        SET quantidade_atual = quantidade_padrao
        WHERE quantidade_atual IS NULL
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
