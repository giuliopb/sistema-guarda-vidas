const express = require('express');
const router = express.Router();
const pool = require('../db');

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_ENG_TO_NUM = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
};

function nomeDiaSemana(numero) {
    if (numero === null || numero === undefined || Number.isNaN(Number(numero))) return null;
    return DIAS[Number(numero)] || null;
}

function obterDiaSemanaBrasil() {
    const dia = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'America/Sao_Paulo'
    }).format(new Date()).toLowerCase();

    return DIAS_ENG_TO_NUM[dia] ?? new Date().getDay();
}

router.get('/ativa', async (req, res) => {
    try {
        const hoje = obterDiaSemanaBrasil();
        const result = await pool.query(`
            SELECT t.id, t.nome, t.descricao, t.dia_semana, t.todos_postos, t.criada_em,
                   COALESCE(
                     STRING_AGG(DISTINCT p.nome, ', ' ORDER BY p.nome),
                     ''
                   ) AS postos
            FROM tarefas_diarias t
            LEFT JOIN tarefas_diarias_postos tp ON tp.tarefa_id = t.id
            LEFT JOIN postos p ON p.id = tp.posto_id
            WHERE (t.ativa = true OR t.ativa IS NULL)
              AND (t.dia_semana = $1 OR t.dia_semana IS NULL)
            GROUP BY t.id
            ORDER BY t.todos_postos DESC, t.criada_em DESC
            LIMIT 1
        `, [hoje]);

        const tarefa = result.rows[0];
        if (!tarefa) return res.json(null);

        res.json({
            ...tarefa,
            dia_semana_nome: nomeDiaSemana(tarefa.dia_semana),
            postos_texto: tarefa.todos_postos ? 'todos' : (tarefa.postos || '-')
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar tarefa ativa' });
    }
});

router.get('/hoje', async (req, res) => {
    try {
        const hoje = obterDiaSemanaBrasil();
        const result = await pool.query(`
            SELECT t.id, t.nome, t.descricao, t.dia_semana, t.todos_postos, t.criada_em,
                   COALESCE(STRING_AGG(DISTINCT p.nome, ', ' ORDER BY p.nome), '') AS postos
            FROM tarefas_diarias t
            LEFT JOIN tarefas_diarias_postos tp ON tp.tarefa_id = t.id
            LEFT JOIN postos p ON p.id = tp.posto_id
            WHERE (t.ativa = true OR t.ativa IS NULL)
              AND (t.dia_semana = $1 OR t.dia_semana IS NULL)
            GROUP BY t.id
            ORDER BY t.todos_postos DESC, t.criada_em DESC
        `, [hoje]);

        res.json(result.rows.map((t) => ({
            ...t,
            dia_semana_nome: nomeDiaSemana(t.dia_semana),
            postos_texto: t.todos_postos ? 'todos' : (t.postos || '-')
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar tarefas de hoje' });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.id, t.nome, t.descricao, t.dia_semana, t.todos_postos, t.ativa, t.criada_em,
                   COALESCE(
                     ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL),
                     '{}'
                   ) AS posto_ids,
                   COALESCE(
                     STRING_AGG(DISTINCT p.nome, ', ' ORDER BY p.nome),
                     ''
                   ) AS postos
            FROM tarefas_diarias t
            LEFT JOIN tarefas_diarias_postos tp ON tp.tarefa_id = t.id
            LEFT JOIN postos p ON p.id = tp.posto_id
            GROUP BY t.id
            ORDER BY t.todos_postos DESC, t.criada_em DESC
        `);
        res.json(result.rows.map((t) => ({
            ...t,
            dia_semana_nome: nomeDiaSemana(t.dia_semana),
            postos_texto: t.todos_postos ? 'todos' : (t.postos || '-')
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar tarefas' });
    }
});

router.post('/', async (req, res) => {
    const { nome, descricao, dia_semana, todos_postos, posto_ids } = req.body;

    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    if (!descricao || !descricao.trim()) return res.status(400).json({ erro: 'Descrição obrigatória' });
    if (dia_semana === undefined || dia_semana === null || Number(dia_semana) < 0 || Number(dia_semana) > 6) {
        return res.status(400).json({ erro: 'Dia da semana inválido' });
    }
    if (!todos_postos && (!Array.isArray(posto_ids) || posto_ids.length === 0)) {
        return res.status(400).json({ erro: 'Selecione ao menos 1 posto ou marque todos os postos' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            'INSERT INTO tarefas_diarias (nome, descricao, dia_semana, todos_postos, ativa) VALUES ($1, $2, $3, $4, true) RETURNING *',
            [nome.trim(), descricao.trim(), Number(dia_semana), Boolean(todos_postos)]
        );

        const tarefa = result.rows[0];
        if (!todos_postos) {
            for (const postoId of posto_ids) {
                await client.query(
                    'INSERT INTO tarefas_diarias_postos (tarefa_id, posto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [tarefa.id, Number(postoId)]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar tarefa diária' });
    } finally {
        client.release();
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, descricao, dia_semana, todos_postos, posto_ids, ativa } = req.body;

    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    if (!descricao || !descricao.trim()) return res.status(400).json({ erro: 'Descrição obrigatória' });
    if (dia_semana === undefined || dia_semana === null || Number(dia_semana) < 0 || Number(dia_semana) > 6) {
        return res.status(400).json({ erro: 'Dia da semana inválido' });
    }
    if (!todos_postos && (!Array.isArray(posto_ids) || posto_ids.length === 0)) {
        return res.status(400).json({ erro: 'Selecione ao menos 1 posto ou marque todos os postos' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (ativa === true) {
            await client.query('UPDATE tarefas_diarias SET ativa = false WHERE ativa = true');
        }

        const result = await client.query(
            'UPDATE tarefas_diarias SET nome = $1, descricao = $2, dia_semana = $3, todos_postos = $4, ativa = $5 WHERE id = $6 RETURNING *',
            [nome.trim(), descricao.trim(), Number(dia_semana), Boolean(todos_postos), Boolean(ativa), id]
        );

        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }

        await client.query('DELETE FROM tarefas_diarias_postos WHERE tarefa_id = $1', [id]);
        if (!todos_postos) {
            for (const postoId of posto_ids) {
                await client.query(
                    'INSERT INTO tarefas_diarias_postos (tarefa_id, posto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, Number(postoId)]
                );
            }
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa diária' });
    } finally {
        client.release();
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM tarefas_diarias WHERE id = $1 RETURNING id', [id]);

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir tarefa diária' });
    }
});

module.exports = router;
