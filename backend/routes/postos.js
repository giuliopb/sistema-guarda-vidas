const express = require('express');
const router = express.Router();
const pool = require('../db');

function validarPostoCompleto(nome, divisoes) {
    if (!nome || !nome.trim()) {
        return 'Nome do posto é obrigatório';
    }

    if (!Array.isArray(divisoes) || divisoes.length === 0) {
        return 'O posto deve ter ao menos 1 divisão';
    }

    for (const divisao of divisoes) {
        if (!divisao.nome || !divisao.nome.trim()) {
            return 'Todas as divisões precisam de nome';
        }

        if (!Array.isArray(divisao.itens) || divisao.itens.length === 0) {
            return `A divisão "${divisao.nome}" deve ter ao menos 1 item`;
        }
    }

    const nomesUnicos = new Set(divisoes.map((d) => d.nome.trim().toLowerCase()));
    if (nomesUnicos.size !== divisoes.length) {
        return 'As divisões de um posto devem ter nomes únicos';
    }

    return null;
}

async function limparDependenciasPosto(client, postoId) {
    await client.query(
        `DELETE FROM alteracoes
         WHERE item_id IN (
             SELECT i.id
             FROM itens i
             JOIN divisoes d ON d.id = i.divisao_id
             WHERE d.posto_id = $1
         )`,
        [postoId]
    );

    await client.query(
        `DELETE FROM alteracoes
         WHERE conferencia_id IN (
             SELECT id FROM conferencias WHERE posto_id = $1
         )`,
        [postoId]
    );

    await client.query(
        `DELETE FROM conferencia_divisoes
         WHERE divisao_id IN (
             SELECT id FROM divisoes WHERE posto_id = $1
         )`,
        [postoId]
    );

    await client.query('DELETE FROM conferencias WHERE posto_id = $1', [postoId]);

    await client.query(
        `DELETE FROM itens
         WHERE divisao_id IN (
             SELECT id FROM divisoes WHERE posto_id = $1
         )`,
        [postoId]
    );

    await client.query('DELETE FROM divisoes WHERE posto_id = $1', [postoId]);
}

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

router.post('/completo', async (req, res) => {
    const { nome, divisoes } = req.body;
    const erroValidacao = validarPostoCompleto(nome, divisoes);

    if (erroValidacao) {
        return res.status(400).json({ erro: erroValidacao });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const postoResult = await client.query(
            'INSERT INTO postos (nome) VALUES ($1) RETURNING id, nome',
            [nome.trim()]
        );

        const posto = postoResult.rows[0];

        for (const divisao of divisoes) {
            const divisaoResult = await client.query(
                'INSERT INTO divisoes (nome, posto_id) VALUES ($1, $2) RETURNING id, nome',
                [divisao.nome.trim(), posto.id]
            );

            const divisaoCriada = divisaoResult.rows[0];

            for (const item of divisao.itens) {
                const nomeItem = (item.nome || '').trim();
                if (!nomeItem) {
                    throw new Error(`Item sem nome na divisão ${divisaoCriada.nome}`);
                }

                await client.query(
                    'INSERT INTO itens (nome, divisao_id, quantidade_padrao, quantidade_atual) VALUES ($1, $2, $3, $3)',
                    [nomeItem, divisaoCriada.id, Number(item.quantidade_padrao || 0)]
                );
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            mensagem: 'Posto cadastrado com divisões e itens',
            posto
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar posto completo' });
    } finally {
        client.release();
    }
});

router.get('/:id/completo', async (req, res) => {
    const { id } = req.params;

    try {
        const postoResult = await pool.query('SELECT id, nome FROM postos WHERE id = $1', [id]);

        if (!postoResult.rows.length) {
            return res.status(404).json({ erro: 'Posto não encontrado' });
        }

        const divisoesResult = await pool.query(
            'SELECT id, nome FROM divisoes WHERE posto_id = $1 ORDER BY id',
            [id]
        );

        const divisoes = [];

        for (const divisao of divisoesResult.rows) {
            const itensResult = await pool.query(
                'SELECT id, nome, quantidade_padrao, quantidade_atual FROM itens WHERE divisao_id = $1 ORDER BY id',
                [divisao.id]
            );

            divisoes.push({
                id: divisao.id,
                nome: divisao.nome,
                itens: itensResult.rows
            });
        }

        res.json({
            id: postoResult.rows[0].id,
            nome: postoResult.rows[0].nome,
            divisoes
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar posto completo' });
    }
});

router.put('/:id/completo', async (req, res) => {
    const { id } = req.params;
    const { nome, divisoes } = req.body;
    const erroValidacao = validarPostoCompleto(nome, divisoes);

    if (erroValidacao) {
        return res.status(400).json({ erro: erroValidacao });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const postoAtual = await client.query('SELECT id FROM postos WHERE id = $1', [id]);
        if (!postoAtual.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Posto não encontrado' });
        }

        await client.query('UPDATE postos SET nome = $1 WHERE id = $2', [nome.trim(), id]);

        await limparDependenciasPosto(client, id);

        for (const divisao of divisoes) {
            const divisaoResult = await client.query(
                'INSERT INTO divisoes (nome, posto_id) VALUES ($1, $2) RETURNING id, nome',
                [divisao.nome.trim(), id]
            );

            for (const item of divisao.itens) {
                const nomeItem = (item.nome || '').trim();
                if (!nomeItem) {
                    throw new Error(`Item sem nome na divisão ${divisaoResult.rows[0].nome}`);
                }

                await client.query(
                    'INSERT INTO itens (nome, divisao_id, quantidade_padrao, quantidade_atual) VALUES ($1, $2, $3, $3)',
                    [nomeItem, divisaoResult.rows[0].id, Number(item.quantidade_padrao || 0)]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ ok: true, mensagem: 'Posto atualizado com sucesso' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar posto completo' });
    } finally {
        client.release();
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
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const postoResult = await client.query('SELECT id FROM postos WHERE id = $1', [id]);
        if (!postoResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Posto não encontrado' });
        }

        await limparDependenciasPosto(client, id);
        await client.query('DELETE FROM postos WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ ok: true, mensagem: 'Posto, divisões e itens excluídos' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir posto' });
    } finally {
        client.release();
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
        const conflito = await pool.query(
            'SELECT id FROM divisoes WHERE posto_id = $1 AND LOWER(nome) = LOWER($2) LIMIT 1',
            [postoId, nome.trim()]
        );

        if (conflito.rows.length) {
            return res.status(400).json({ erro: 'Esta divisão já existe neste posto' });
        }

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
        const divisaoAtual = await pool.query('SELECT posto_id FROM divisoes WHERE id = $1', [id]);

        if (!divisaoAtual.rows.length) {
            return res.status(404).json({ erro: 'Divisão não encontrada' });
        }

        const conflito = await pool.query(
            `SELECT id FROM divisoes
             WHERE posto_id = $1 AND LOWER(nome) = LOWER($2) AND id <> $3
             LIMIT 1`,
            [divisaoAtual.rows[0].posto_id, nome.trim(), id]
        );

        if (conflito.rows.length) {
            return res.status(400).json({ erro: 'Já existe divisão com esse nome neste posto' });
        }

        const result = await pool.query(
            'UPDATE divisoes SET nome = $1 WHERE id = $2 RETURNING *',
            [nome.trim(), id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar divisão' });
    }
});

router.delete('/divisoes/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM itens WHERE divisao_id = $1', [id]);
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
            'INSERT INTO itens (nome, divisao_id, quantidade_padrao, quantidade_atual) VALUES ($1, $2, $3, $3) RETURNING *',
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
