const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/usuarios', async (req, res) => {
    const solicitanteId = Number(req.query.solicitante_id || 0);

    try {
        const result = await pool.query(
            `
            SELECT id, nome
            FROM usuarios
            WHERE ($1::int = 0 OR id <> $1)
            ORDER BY nome
            `,
            [solicitanteId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar usuários para troca' });
    }
});

router.post('/', async (req, res) => {
    const {
        solicitante_id,
        usuario_troca_id,
        data_servico_cedido,
        posto_cedido_id,
        carga_horaria_cedida,
        possui_retorno,
        data_retorno,
        posto_retorno_id,
        carga_horaria_retorno
    } = req.body;

    const cargaCedida = Number(carga_horaria_cedida);
    const cargaRetorno = Number(carga_horaria_retorno);
    const retornoAtivo = Boolean(possui_retorno);

    if (!solicitante_id || !usuario_troca_id || !data_servico_cedido || !posto_cedido_id) {
        return res.status(400).json({ erro: 'Dados obrigatórios da troca não informados' });
    }

    if (![6, 12].includes(cargaCedida)) {
        return res.status(400).json({ erro: 'A troca cedida deve ser de 6h ou 12h' });
    }

    if (retornoAtivo) {
        if (!data_retorno || !posto_retorno_id) {
            return res.status(400).json({ erro: 'Informe os dados do dia de retorno ou selecione "nenhum"' });
        }

        if (![6, 12].includes(cargaRetorno)) {
            return res.status(400).json({ erro: 'O retorno deve ser de 6h ou 12h' });
        }
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO trocas_servico (
                solicitante_id,
                usuario_troca_id,
                data_servico_cedido,
                posto_cedido_id,
                carga_horaria_cedida,
                possui_retorno,
                data_retorno,
                posto_retorno_id,
                carga_horaria_retorno,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente')
            RETURNING *
            `,
            [
                solicitante_id,
                usuario_troca_id,
                data_servico_cedido,
                posto_cedido_id,
                cargaCedida,
                retornoAtivo,
                retornoAtivo ? data_retorno : null,
                retornoAtivo ? posto_retorno_id : null,
                retornoAtivo ? cargaRetorno : null
            ]
        );

        res.status(201).json({
            ok: true,
            mensagem: 'Solicitação de troca de serviço enviada',
            troca: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao registrar troca de serviço' });
    }
});

router.get('/minhas', async (req, res) => {
    const usuarioId = Number(req.query.usuario_id || 0);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!usuarioId) {
        return res.status(400).json({ erro: 'usuario_id é obrigatório' });
    }

    try {
        const totalResult = await pool.query(
            `
            SELECT COUNT(*)::int AS total
            FROM trocas_servico
            WHERE solicitante_id = $1
               OR usuario_troca_id = $1
            `,
            [usuarioId]
        );

        const total = totalResult.rows[0].total;
        const totalPaginas = Math.max(Math.ceil(total / limit), 1);

        const result = await pool.query(
            `
            SELECT
                ts.id,
                ts.status,
                ts.criada_em,
                ts.data_servico_cedido,
                ts.carga_horaria_cedida,
                ts.possui_retorno,
                ts.data_retorno,
                ts.carga_horaria_retorno,
                s.nome AS solicitante_nome,
                t.nome AS usuario_troca_nome,
                pc.nome AS posto_cedido_nome,
                pr.nome AS posto_retorno_nome
            FROM trocas_servico ts
            JOIN usuarios s ON s.id = ts.solicitante_id
            JOIN usuarios t ON t.id = ts.usuario_troca_id
            JOIN postos pc ON pc.id = ts.posto_cedido_id
            LEFT JOIN postos pr ON pr.id = ts.posto_retorno_id
            WHERE ts.solicitante_id = $1
               OR ts.usuario_troca_id = $1
            ORDER BY ts.criada_em DESC
            LIMIT $2 OFFSET $3
            `,
            [usuarioId, limit, offset]
        );

        res.json({
            pagina: page,
            por_pagina: limit,
            total,
            total_paginas: totalPaginas,
            trocas: result.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar trocas do usuário' });
    }
});

module.exports = router;
