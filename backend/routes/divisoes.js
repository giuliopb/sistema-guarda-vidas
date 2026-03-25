const express = require('express');
const router = express.Router();
const pool = require('../db');


// ======================================
// LISTAR ITENS DE UMA DIVISÃO
// ======================================

router.get('/:id/itens', async (req, res) => {

    const divisaoId = req.params.id;

    try {

        const result = await pool.query(
            'SELECT * FROM itens WHERE divisao_id=$1 ORDER BY id',
            [divisaoId]
        );

        const itens = result.rows;

        const mapa = {};
        const raiz = [];

        itens.forEach(item => {
            item.subitens = [];
            mapa[item.id] = item;
        });

        itens.forEach(item => {

            if (item.item_pai) {

                mapa[item.item_pai].subitens.push(item);

            } else {

                raiz.push(item);

            }

        });

        res.json(raiz);

    } catch (error) {

        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar itens' });

    }

});


// ======================================
// SALVAR CHECKLIST DA DIVISÃO
// ======================================

router.post('/conferir', async (req, res) => {

    const { posto_id, divisao_id, usuario_id, alteracoes } = req.body;

    try {

        // criar conferencia se não existir
        const conferencia = await pool.query(
            'INSERT INTO conferencias (posto_id,usuario_id) VALUES ($1,$2) RETURNING *',
            [posto_id, usuario_id]
        );

        const conferenciaId = conferencia.rows[0].id;


        // registrar divisão conferida
        await pool.query(
            `INSERT INTO conferencia_divisoes 
            (conferencia_id,divisao_id,usuario_id) 
            VALUES ($1,$2,$3)`,
            [conferenciaId, divisao_id, usuario_id]
        );


        // registrar alterações
        for (const alt of alteracoes) {

            await pool.query(
                `INSERT INTO alteracoes
                (item_id,conferencia_id,quantidade_encontrada,descricao)
                VALUES ($1,$2,$3,$4)`,
                [
                    alt.item_id,
                    conferenciaId,
                    alt.quantidade_encontrada,
                    alt.descricao
                ]
            );

        }


        // verificar se todas divisões do posto foram feitas
        const totalDivisoes = await pool.query(
            'SELECT COUNT(*) FROM divisoes WHERE posto_id=$1',
            [posto_id]
        );

        const feitas = await pool.query(
            `SELECT COUNT(*) 
            FROM conferencia_divisoes cd
            JOIN divisoes d ON cd.divisao_id = d.id
            WHERE d.posto_id=$1`,
            [posto_id]
        );


        if (Number(feitas.rows[0].count) >= Number(totalDivisoes.rows[0].count)) {

            await pool.query(
                `UPDATE postos
                SET ultima_conferencia = NOW(),
                ultimo_usuario = $1
                WHERE id=$2`,
                [usuario_id, posto_id]
            );

        }

        res.json({
            mensagem: "Divisão registrada com sucesso"
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({
            erro: "Erro ao registrar checklist"
        });

    }

});

module.exports = router;