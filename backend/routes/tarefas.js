const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/ativa', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, descricao, criada_em
            FROM tarefas_diarias
            WHERE ativa = true
            ORDER BY criada_em DESC
            LIMIT 1
        `);

        res.json(result.rows[0] || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar tarefa ativa' });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, descricao, ativa, criada_em
            FROM tarefas_diarias
            ORDER BY criada_em DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar tarefas' });
    }
});

router.post('/', async (req, res) => {
    const { descricao } = req.body;

    if (!descricao || !descricao.trim()) {
        return res.status(400).json({ erro: 'Descrição obrigatória' });
    }

    try {
        await pool.query('UPDATE tarefas_diarias SET ativa = false WHERE ativa = true');

        const result = await pool.query(
            'INSERT INTO tarefas_diarias (descricao, ativa) VALUES ($1, true) RETURNING *',
            [descricao.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar tarefa diária' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { descricao, ativa } = req.body;

    if (!descricao || !descricao.trim()) {
        return res.status(400).json({ erro: 'Descrição obrigatória' });
    }

    try {
        if (ativa === true) {
            await pool.query('UPDATE tarefas_diarias SET ativa = false WHERE ativa = true');
        }

        const result = await pool.query(
            'UPDATE tarefas_diarias SET descricao = $1, ativa = $2 WHERE id = $3 RETURNING *',
            [descricao.trim(), Boolean(ativa), id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Tarefa não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar tarefa diária' });
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
