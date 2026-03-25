const express = require('express');
const router = express.Router();
const pool = require('../db');


// ======================================
// DASHBOARD ADMINISTRADOR
// ======================================

router.get('/postos', async (req, res) => {

    try {

        const result = await pool.query(

        `SELECT 
            p.id,
            p.nome,
            p.ultima_conferencia,
            u.nome as ultimo_usuario
        FROM postos p
        LEFT JOIN usuarios u
        ON p.ultimo_usuario = u.id
        ORDER BY p.nome`

        )

        res.json(result.rows)

    } catch (error) {

        console.error(error)

        res.status(500).json({
            erro: "Erro ao carregar dashboard"
        })

    }

})

module.exports = router