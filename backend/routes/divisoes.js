const express = require('express');
const router = express.Router();
const pool = require('../db');

async function getOrCreateConferenciaEmAndamento(postoId, usuarioId) {
    const ultimaConferencia = await pool.query(
        'SELECT id FROM conferencias WHERE posto_id = $1 ORDER BY id DESC LIMIT 1',
        [postoId]
    );

    const totalDivisoesResult = await pool.query(
        'SELECT COUNT(*)::int AS total FROM divisoes WHERE posto_id = $1',
        [postoId]
    );

    const totalDivisoes = totalDivisoesResult.rows[0].total;

    if (!ultimaConferencia.rows.length) {
        const nova = await pool.query(
            'INSERT INTO conferencias (posto_id, usuario_id) VALUES ($1, $2) RETURNING id',
            [postoId, usuarioId]
        );
        return { conferenciaId: nova.rows[0].id, totalDivisoes, cicloNovo: true };
    }

    const conferenciaId = ultimaConferencia.rows[0].id;

    const divisoesConferidasResult = await pool.query(
        'SELECT COUNT(DISTINCT divisao_id)::int AS total FROM conferencia_divisoes WHERE conferencia_id = $1',
        [conferenciaId]
    );

    const divisoesConferidas = divisoesConferidasResult.rows[0].total;

    if (totalDivisoes > 0 && divisoesConferidas >= totalDivisoes) {
        const nova = await pool.query(
            'INSERT INTO conferencias (posto_id, usuario_id) VALUES ($1, $2) RETURNING id',
            [postoId, usuarioId]
        );
        return { conferenciaId: nova.rows[0].id, totalDivisoes, cicloNovo: true };
    }

    return { conferenciaId, totalDivisoes, cicloNovo: false };
}

router.get('/posto/:postoId/status', async (req, res) => {
    const postoId = req.params.postoId;

    try {
        const totalDivisoesResult = await pool.query(
            'SELECT COUNT(*)::int AS total FROM divisoes WHERE posto_id = $1',
            [postoId]
        );
        const totalDivisoes = totalDivisoesResult.rows[0].total;

        const conferencia = await pool.query(
            'SELECT id FROM conferencias WHERE posto_id = $1 ORDER BY id DESC LIMIT 1',
            [postoId]
        );

        let conferenciaId = null;
        let cicloConcluido = false;

        if (conferencia.rows.length) {
            conferenciaId = conferencia.rows[0].id;

            const conferidas = await pool.query(
                'SELECT COUNT(DISTINCT divisao_id)::int AS total FROM conferencia_divisoes WHERE conferencia_id = $1',
                [conferenciaId]
            );

            if (totalDivisoes > 0 && conferidas.rows[0].total >= totalDivisoes) {
                cicloConcluido = true;
                conferenciaId = null;
            }
        }

        const result = await pool.query(
            `
            SELECT
                d.id,
                d.nome,
                CASE
                    WHEN $2::int IS NULL THEN NULL
                    ELSE cd.data_hora
                END AS data_hora
            FROM divisoes d
            LEFT JOIN conferencia_divisoes cd
                ON cd.divisao_id = d.id
               AND cd.conferencia_id = $2
            WHERE d.posto_id = $1
            ORDER BY d.id
            `,
            [postoId, conferenciaId]
        );

        res.json({
            cicloConcluido,
            divisoes: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar divisões' });
    }
});

router.get('/:id/itens', async (req, res) => {
    const divisaoId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM itens WHERE divisao_id = $1 ORDER BY id',
            [divisaoId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                erro: 'Essa divisão não possui itens cadastrados'
            });
        }

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar itens' });
    }
});

router.post('/conferir', async (req, res) => {
    const { posto_id, divisao_id, usuario_id, alteracoes = [] } = req.body;

    if (!posto_id || !divisao_id || !usuario_id) {
        return res.status(400).json({ erro: 'posto_id, divisao_id e usuario_id são obrigatórios' });
    }

    try {
        const { conferenciaId, totalDivisoes } = await getOrCreateConferenciaEmAndamento(posto_id, usuario_id);

        const jaConferida = await pool.query(
            'SELECT id FROM conferencia_divisoes WHERE conferencia_id = $1 AND divisao_id = $2 LIMIT 1',
            [conferenciaId, divisao_id]
        );

        if (jaConferida.rows.length) {
            return res.status(400).json({ erro: 'Divisão já conferida neste ciclo' });
        }

        await pool.query(
            `
            INSERT INTO conferencia_divisoes (conferencia_id, divisao_id, usuario_id, data_hora)
            VALUES ($1, $2, $3, NOW())
            `,
            [conferenciaId, divisao_id, usuario_id]
        );

        for (const alt of alteracoes) {
            const itemResult = await pool.query(
                'SELECT quantidade_padrao FROM itens WHERE id = $1 LIMIT 1',
                [alt.item_id]
            );

            if (!itemResult.rows.length) {
                continue;
            }

            const quantidadePadrao = Number(itemResult.rows[0].quantidade_padrao || 0);
            const quantidadeEncontrada = Number(alt.quantidade_encontrada ?? quantidadePadrao);
            const descricao = (alt.descricao || '').trim();
            const abaixoPadrao = quantidadeEncontrada < quantidadePadrao;

            if (!abaixoPadrao && !descricao) {
                continue;
            }

            await pool.query(
                `
                INSERT INTO alteracoes (
                    item_id,
                    conferencia_id,
                    quantidade_encontrada,
                    descricao,
                    status,
                    criada_em
                )
                VALUES ($1, $2, $3, $4, 'pendente', NOW())
                `,
                [alt.item_id, conferenciaId, quantidadeEncontrada, descricao || 'Quantidade abaixo do padrão']
            );
        }

        const conferidasResult = await pool.query(
            'SELECT COUNT(DISTINCT divisao_id)::int AS total FROM conferencia_divisoes WHERE conferencia_id = $1',
            [conferenciaId]
        );

        const totalConferidas = conferidasResult.rows[0].total;
        const postoConcluido = totalDivisoes > 0 && totalConferidas >= totalDivisoes;

        res.json({
            ok: true,
            postoConcluido,
            mensagem: postoConcluido ? 'Conferência de posto realizada' : 'Divisão conferida'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar conferência' });
    }
});

module.exports = router;
