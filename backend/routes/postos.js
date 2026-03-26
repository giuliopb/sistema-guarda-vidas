const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM postos ORDER BY nome');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar postos' });
    }
});

router.post('/', async (req, res) => {
    const { nome } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome do posto é obrigatório' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO postos (nome) VALUES ($1) RETURNING *',
            [nome.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar posto' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome do posto é obrigatório' });
    }

    try {
        const result = await pool.query(
            'UPDATE postos SET nome = $1 WHERE id = $2 RETURNING *',
            [nome.trim(), id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Posto não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar posto' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM postos WHERE id = $1 RETURNING id', [id]);

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Posto não encontrado' });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir posto' });
    }
});

router.get('/:id/divisoes', async (req, res) => {
    const postoId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM divisoes WHERE posto_id = $1 ORDER BY nome',
            [postoId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar divisões' });
    }
});

router.post('/:id/divisoes', async (req, res) => {
    const postoId = req.params.id;
    const { nome } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome da divisão é obrigatório' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO divisoes (nome, posto_id) VALUES ($1, $2) RETURNING *',
            [nome.trim(), postoId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar divisão' });
    }
});

router.put('/divisoes/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome da divisão é obrigatório' });
    }

    try {
        const result = await pool.query(
            'UPDATE divisoes SET nome = $1 WHERE id = $2 RETURNING *',
            [nome.trim(), id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Divisão não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar divisão' });
    }
});

router.delete('/divisoes/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM divisoes WHERE id = $1 RETURNING id', [id]);

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Divisão não encontrada' });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir divisão' });
    }
});

router.get('/divisoes/:id/itens', async (req, res) => {
    const divisaoId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM itens WHERE divisao_id = $1 ORDER BY nome',
            [divisaoId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar itens' });
    }
});

router.post('/divisoes/:id/itens', async (req, res) => {
    const divisaoId = req.params.id;
    const { nome, quantidade_padrao } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome do item é obrigatório' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO itens (nome, divisao_id, quantidade_padrao) VALUES ($1, $2, $3) RETURNING *',
            [nome.trim(), divisaoId, Number(quantidade_padrao || 0)]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar item' });
    }
});

router.put('/itens/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, quantidade_padrao } = req.body;

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome do item é obrigatório' });
    }

    try {
        const result = await pool.query(
            'UPDATE itens SET nome = $1, quantidade_padrao = $2 WHERE id = $3 RETURNING *',
            [nome.trim(), Number(quantidade_padrao || 0), id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar item' });
    }
});

router.delete('/itens/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM itens WHERE id = $1 RETURNING id', [id]);

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir item' });
    }
});

module.exports = router;
