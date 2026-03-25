const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

const SECRET = "segredo_super_secreto";

router.post('/login', async (req, res) => {

    const { email, senha } = req.body;

    try {

        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email=$1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: 'Usuário não encontrado' });
        }

        const usuario = result.rows[0];

        if (usuario.senha !== senha) {
            return res.status(401).json({ erro: 'Senha inválida' });
        }

        const token = jwt.sign(
            { id: usuario.id, tipo: usuario.tipo },
            SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo
            }
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ erro: 'Erro no servidor' });

    }

});

module.exports = router;