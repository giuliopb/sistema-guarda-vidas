const express = require('express');
const router = express.Router();
const pool = require('../db');


// LISTAR POSTOS
router.get('/', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT * FROM postos ORDER BY nome'
        );

        res.json(result.rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar postos' });

    }

});


// LISTAR DIVISOES DE UM POSTO
router.get('/:id/divisoes', async (req, res) => {

    const postoId = req.params.id;

    try {

        const result = await pool.query(
            'SELECT * FROM divisoes WHERE posto_id=$1 ORDER BY nome',
            [postoId]
        );

        res.json(result.rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar divisões' });

    }

});

module.exports = router;