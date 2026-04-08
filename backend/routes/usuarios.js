const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");

const SECRET = "segredo_super_secreto";
let colunaAutorizadoVerificada = false;
let colunaAutorizadoDisponivel = true;

async function garantirColunaAutorizado() {
    if (colunaAutorizadoVerificada) return colunaAutorizadoDisponivel;

    try {
        await pool.query(`
            ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS autorizado BOOLEAN NOT NULL DEFAULT true
        `);
        colunaAutorizadoDisponivel = true;
    } catch (error) {
        console.warn('Aviso: não foi possível garantir coluna autorizado automaticamente:', error.message);
        colunaAutorizadoDisponivel = false;
    }

    colunaAutorizadoVerificada = true;
    return colunaAutorizadoDisponivel;
}

function validarCamposBasicos(nome, email, senha) {
    if (!nome || !nome.trim()) return "Nome completo é obrigatório";
    if (!email || !email.trim()) return "Email é obrigatório";
    if (!senha || !senha.trim()) return "Senha é obrigatória";
    return null;
}

// LOGIN
router.post("/login", async (req, res) => {
    let { email, senha } = req.body;

    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        if (!email || !senha) {
            return res.status(400).json({ erro: "Email e senha são obrigatórios" });
        }

        email = email.trim().toLowerCase();
        senha = senha.trim();

        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: "Usuário não encontrado" });
        }

        const usuario = result.rows[0];

        if (usuario.senha !== senha) {
            return res.status(401).json({ erro: "Senha inválida" });
        }

        if (possuiAutorizado && !usuario.autorizado) {
            return res.status(403).json({ erro: "Cadastro pendente de autorização do administrador" });
        }

        const token = jwt.sign({ id: usuario.id, tipo: usuario.tipo }, SECRET, { expiresIn: "8h" });

        res.json({
            sucesso: true,
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo
            }
        });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ erro: "Erro interno do servidor" });
    }
});

// AUTO CADASTRO (aguarda autorização)
router.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    const erro = validarCamposBasicos(nome, email, senha);
    if (erro) return res.status(400).json({ erro });

    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        const existe = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
        if (existe.rows.length) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        const result = possuiAutorizado
            ? await pool.query(
                `INSERT INTO usuarios (nome, email, senha, tipo, autorizado)
                 VALUES ($1, $2, $3, 'gv', false)
                 RETURNING id, nome, email, tipo, autorizado`,
                [nome.trim(), email.trim().toLowerCase(), senha.trim()]
            )
            : await pool.query(
                `INSERT INTO usuarios (nome, email, senha, tipo)
                 VALUES ($1, $2, $3, 'gv')
                 RETURNING id, nome, email, tipo, true AS autorizado`,
                [nome.trim(), email.trim().toLowerCase(), senha.trim()]
            );

        res.status(201).json({ ok: true, usuario: result.rows[0], mensagem: 'Cadastro criado. Aguarde autorização do administrador.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar cadastro' });
    }
});

// LISTA DE CADASTROS
router.get('/', async (req, res) => {
    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        const result = await pool.query(
            `SELECT id, nome, email, tipo, ${possuiAutorizado ? 'autorizado' : 'true AS autorizado'}
             FROM usuarios
             ORDER BY autorizado ASC, nome ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao listar usuários' });
    }
});

// CRIAR CADASTRO (ADMIN)
router.post('/', async (req, res) => {
    const { nome, email, senha, tipo = 'gv', autorizado = true } = req.body;
    const erro = validarCamposBasicos(nome, email, senha);
    if (erro) return res.status(400).json({ erro });

    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        const existe = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
        if (existe.rows.length) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        const result = possuiAutorizado
            ? await pool.query(
                `INSERT INTO usuarios (nome, email, senha, tipo, autorizado)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, nome, email, tipo, autorizado`,
                [nome.trim(), email.trim().toLowerCase(), senha.trim(), tipo, Boolean(autorizado)]
            )
            : await pool.query(
                `INSERT INTO usuarios (nome, email, senha, tipo)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, nome, email, tipo, true AS autorizado`,
                [nome.trim(), email.trim().toLowerCase(), senha.trim(), tipo]
            );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar usuário' });
    }
});

// AUTORIZAR CADASTRO
router.put('/:id/autorizar', async (req, res) => {
    const { id } = req.params;

    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        if (!possuiAutorizado) {
            return res.status(400).json({ erro: 'Autorização de cadastro indisponível neste banco' });
        }

        const result = await pool.query(
            'UPDATE usuarios SET autorizado = true WHERE id = $1 RETURNING id, nome, email, tipo, autorizado',
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao autorizar cadastro' });
    }
});

// EDITAR CADASTRO
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, senha, tipo, autorizado } = req.body;

    try {
        const possuiAutorizado = await garantirColunaAutorizado();

        const atual = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (!atual.rows.length) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        const novoNome = ((nome ?? atual.rows[0].nome) || '').trim();
        const novoEmail = ((email ?? atual.rows[0].email) || '').trim().toLowerCase();
        const novaSenha = ((senha ?? atual.rows[0].senha) || '').trim();
        const novoTipo = tipo ?? atual.rows[0].tipo;
        const novoAutorizado = possuiAutorizado
            ? (autorizado === undefined ? atual.rows[0].autorizado : Boolean(autorizado))
            : true;

        const erro = validarCamposBasicos(novoNome, novoEmail, novaSenha);
        if (erro) return res.status(400).json({ erro });

        const conflito = await pool.query(
            'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
            [novoEmail, id]
        );
        if (conflito.rows.length) {
            return res.status(400).json({ erro: 'Email já cadastrado para outro usuário' });
        }

        const result = possuiAutorizado
            ? await pool.query(
                `UPDATE usuarios
                 SET nome = $1, email = $2, senha = $3, tipo = $4, autorizado = $5
                 WHERE id = $6
                 RETURNING id, nome, email, tipo, autorizado`,
                [novoNome, novoEmail, novaSenha, novoTipo, novoAutorizado, id]
            )
            : await pool.query(
                `UPDATE usuarios
                 SET nome = $1, email = $2, senha = $3, tipo = $4
                 WHERE id = $5
                 RETURNING id, nome, email, tipo, true AS autorizado`,
                [novoNome, novoEmail, novaSenha, novoTipo, id]
            );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao editar usuário' });
    }
});

// EXCLUIR CADASTRO
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao excluir usuário' });
    }
});

module.exports = router;
