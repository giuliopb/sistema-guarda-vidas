const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/postos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.nome,
                MAX(cd.data_hora) AS ultima_conferencia,
                (
                    SELECT u.nome
                    FROM conferencia_divisoes cd2
                    JOIN usuarios u ON u.id = cd2.usuario_id
                    JOIN divisoes d2 ON d2.id = cd2.divisao_id
                    WHERE d2.posto_id = p.id
                    ORDER BY cd2.data_hora DESC
                    LIMIT 1
                ) AS ultimo_usuario
            FROM postos p
            LEFT JOIN divisoes d ON d.posto_id = p.id
            LEFT JOIN conferencia_divisoes cd ON cd.divisao_id = d.id
            GROUP BY p.id, p.nome
            ORDER BY p.nome
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao carregar conferências dos postos' });
    }
});

router.get('/alteracoes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                a.id,
                a.descricao,
                a.quantidade_encontrada,
                a.status,
                a.resolucao,
                a.criada_em,
                i.nome AS item_nome,
                i.quantidade_padrao,
                d.nome AS divisao_nome,
                p.nome AS posto_nome
            FROM alteracoes a
            JOIN itens i ON i.id = a.item_id
            JOIN divisoes d ON d.id = i.divisao_id
            JOIN postos p ON p.id = d.posto_id
            WHERE a.status <> 'resolvido'
            ORDER BY
                CASE a.status
                    WHEN 'pendente' THEN 0
                    WHEN 'em_correcao' THEN 1
                    ELSE 2
                END,
                a.criada_em DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar alterações' });
    }
});

router.put('/alteracoes/:id', async (req, res) => {
    const { id } = req.params;
    const { status, resolucao } = req.body;

    const statusValidos = ['pendente', 'em_correcao', 'resolvido'];

    if (!statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'Status inválido' });
    }

    try {
        const result = await pool.query(
            'UPDATE alteracoes SET status = $1, resolucao = $2 WHERE id = $3 RETURNING *',
            [status, resolucao || null, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Alteração não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar alteração' });
    }
});



router.put('/alteracoes/:id/resolver', async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const alteracaoResult = await client.query(
            `SELECT a.id, a.item_id, i.quantidade_padrao
             FROM alteracoes a
             JOIN itens i ON i.id = a.item_id
             WHERE a.id = $1`,
            [id]
        );

        if (!alteracaoResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Alteração não encontrada' });
        }

        const alteracao = alteracaoResult.rows[0];

        await client.query(
            'UPDATE alteracoes SET quantidade_encontrada = $1, status = $2, resolucao = $3 WHERE id = $4',
            [alteracao.quantidade_padrao, 'resolvido', 'Resolvido pelo admin', id]
        );

        await client.query('DELETE FROM alteracoes WHERE id = $1', [id]);

        await client.query('COMMIT');

        res.json({ ok: true, mensagem: 'Problema resolvido e removido da lista' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: 'Erro ao resolver alteração' });
    } finally {
        client.release();
    }
});

module.exports = router;
