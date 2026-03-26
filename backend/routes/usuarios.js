const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

const SECRET = "segredo_super_secreto";


// ==============================
// LOGIN
// ==============================

router.post("/login", async (req, res) => {

    let { email, senha } = req.body;

    try {

        // validação básica
        if (!email || !senha) {
            return res.status(400).json({
                erro: "Email e senha são obrigatórios"
            });
        }

        // normalizar dados
        email = email.trim().toLowerCase();
        senha = senha.trim();

        // buscar usuário
        const result = await pool.query(
            "SELECT * FROM usuarios WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                erro: "Usuário não encontrado"
            });
        }

        const usuario = result.rows[0];

        // validar senha
        if (usuario.senha !== senha) {
            return res.status(401).json({
                erro: "Senha inválida"
            });
        }

        // gerar token
        const token = jwt.sign(
            {
                id: usuario.id,
                tipo: usuario.tipo
            },
            SECRET,
            {
                expiresIn: "8h"
            }
        );

        // resposta
        res.json({
            sucesso: true,
            token: token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo
            }
        });

    } catch (error) {

        console.error("Erro no login:", error);

        res.status(500).json({
            erro: "Erro interno do servidor"
        });

    }

});

module.exports = router;