const express = require('express');
const router = express.Router();
const pool = require('../db');


// CRIAR CONFERENCIA
router.post('/', async (req, res) => {

    const { posto_id, usuario_id, alteracoes } = req.body;

    try {

        const conferencia = await pool.query(
            'INSERT INTO conferencias (posto_id,usuario_id) VALUES ($1,$2) RETURNING *',
            [posto_id, usuario_id]
        );

        const conferenciaId = conferencia.rows[0].id;

        for (const alt of alteracoes) {

            await pool.query(
                'INSERT INTO alteracoes (item_id,conferencia_id,quantidade_encontrada,descricao) VALUES ($1,$2,$3,$4)',
                [alt.item_id, conferenciaId, alt.quantidade, alt.descricao]
            );

        }

        res.json({
            mensagem: 'Conferência registrada',
            conferencia_id: conferenciaId
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ erro: 'Erro ao registrar conferência' });

    }

});

module.exports = router;