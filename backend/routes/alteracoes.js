const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/", async (req, res) => {

  const {
    item_id,
    conferencia_id,
    quantidade_encontrada,
    descricao
  } = req.body;

  await db.query(
    `INSERT INTO alteracoes
    (item_id, conferencia_id, quantidade_encontrada, descricao)
    VALUES($1,$2,$3,$4)`,
    [item_id, conferencia_id, quantidade_encontrada, descricao]
  );

  res.json({ ok: true });
});

router.get("/", async (req, res) => {

  const result = await db.query(`
  SELECT alteracoes.*, itens.nome as item
  FROM alteracoes
  JOIN itens ON itens.id = alteracoes.item_id
  WHERE resolvido = false
  `);

  res.json(result.rows);
});

module.exports = router;