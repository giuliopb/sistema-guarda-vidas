const express = require("express");
const router = express.Router();
const pool = require("../db");


// ===============================
// STATUS DAS DIVISÕES DO POSTO
// ===============================

router.get("/posto/:postoId/status", async (req,res)=>{

const postoId = req.params.postoId;

try{

// pegar última conferência
const conferencia = await pool.query(`
SELECT id
FROM conferencias
WHERE posto_id=$1
ORDER BY id DESC
LIMIT 1
`,[postoId]);

let conferenciaId = null;

if(conferencia.rows.length > 0){
conferenciaId = conferencia.rows[0].id;
}

// retornar divisões com status
const result = await pool.query(`
SELECT
d.id,
d.nome,
cd.data_hora
FROM divisoes d

LEFT JOIN conferencia_divisoes cd
ON cd.divisao_id = d.id
AND cd.conferencia_id = $2

WHERE d.posto_id = $1
ORDER BY d.id
`,[postoId, conferenciaId]);

res.json(result.rows);

}catch(err){

console.error(err);

res.status(500).json({
erro:"Erro ao buscar divisões"
});

}

});


// ===============================
// LISTAR ITENS DA DIVISÃO
// ===============================

router.get("/:id/itens", async (req,res)=>{

const divisaoId = req.params.id;

try{

const result = await pool.query(
"SELECT * FROM itens WHERE divisao_id=$1 ORDER BY id",
[divisaoId]
);

if(result.rows.length === 0){

return res.status(400).json({
erro:"Essa divisão não possui itens cadastrados"
});

}

res.json(result.rows);

}catch(err){

console.error(err);

res.status(500).json({
erro:"Erro ao buscar itens"
});

}

});


// ===============================
// REGISTRAR DIVISÃO CONFERIDA
// ===============================

router.post("/conferir", async (req,res)=>{

const {posto_id, divisao_id, usuario_id, itens} = req.body;

try{

if(!posto_id || !divisao_id || !usuario_id){
return res.status(400).json({
erro:"posto_id, divisao_id e usuario_id são obrigatórios"
});
}

if(!Array.isArray(itens) || itens.length === 0){
return res.status(400).json({
erro:"Envie os itens conferidos da divisão"
});
}

const cliente = await pool.connect();

try{

await cliente.query("BEGIN");

// pegar última conferência em aberto do posto
let conferencia = await cliente.query(`
SELECT id
FROM conferencias
WHERE posto_id=$1
ORDER BY id DESC
LIMIT 1
`,[posto_id]);

let conferenciaId;

if(conferencia.rows.length === 0){

const nova = await cliente.query(`
INSERT INTO conferencias (posto_id,usuario_id)
VALUES ($1,$2)
RETURNING id
`,[posto_id,usuario_id]);

conferenciaId = nova.rows[0].id;

}else{

conferenciaId = conferencia.rows[0].id;

}

// registrar alterações dos itens (faltas/defeitos)
for(const item of itens){

if(!item.item_id){
continue;
}

const quantidadePadrao = Number(item.quantidade_padrao);
const quantidadeEncontrada = Number(item.quantidade_encontrada);
const descricao = (item.descricao || "").trim();
const quantidadeInvalida =
Number.isNaN(quantidadeEncontrada) ||
quantidadeEncontrada < 0;

if(quantidadeInvalida){
await cliente.query("ROLLBACK");
return res.status(400).json({
erro:"Quantidade encontrada inválida em um dos itens"
});
}

if(quantidadeEncontrada < quantidadePadrao || descricao){
const alteracaoExistente = await cliente.query(`
SELECT id
FROM alteracoes
WHERE conferencia_id=$1
AND item_id=$2
LIMIT 1
`,[conferenciaId,item.item_id]);

if(alteracaoExistente.rows.length > 0){
await cliente.query(`
UPDATE alteracoes
SET quantidade_encontrada=$1, descricao=$2
WHERE id=$3
`,[quantidadeEncontrada,descricao || null,alteracaoExistente.rows[0].id]);
}else{
await cliente.query(`
INSERT INTO alteracoes
(item_id,conferencia_id,quantidade_encontrada,descricao)
VALUES ($1,$2,$3,$4)
`,[item.item_id,conferenciaId,quantidadeEncontrada,descricao || null]);
}
}

}

// registrar divisão
const divisaoExistente = await cliente.query(`
SELECT id
FROM conferencia_divisoes
WHERE conferencia_id=$1
AND divisao_id=$2
LIMIT 1
`,[conferenciaId,divisao_id]);

if(divisaoExistente.rows.length === 0){
await cliente.query(`
INSERT INTO conferencia_divisoes
(conferencia_id,divisao_id,usuario_id,data_hora)
VALUES ($1,$2,$3,NOW())
`,[conferenciaId,divisao_id,usuario_id]);
}

// se todas as divisões do posto foram conferidas, atualizar posto
const totalDivisoes = await cliente.query(`
SELECT COUNT(*)::int AS total
FROM divisoes
WHERE posto_id=$1
`,[posto_id]);

const totalConferidas = await cliente.query(`
SELECT COUNT(*)::int AS total
FROM conferencia_divisoes cd
INNER JOIN divisoes d
ON d.id = cd.divisao_id
WHERE cd.conferencia_id=$1
AND d.posto_id=$2
`,[conferenciaId,posto_id]);

const concluiuConferencia =
totalDivisoes.rows[0].total > 0 &&
totalConferidas.rows[0].total === totalDivisoes.rows[0].total;

if(concluiuConferencia){
await cliente.query(`
UPDATE postos
SET ultima_conferencia=NOW(),
ultimo_usuario=$1
WHERE id=$2
`,[usuario_id,posto_id]);
}

await cliente.query("COMMIT");

res.json({
ok:true,
conferencia_completa: concluiuConferencia
});

}catch(errorTransacao){
await cliente.query("ROLLBACK");
throw errorTransacao;
}finally{
cliente.release();
}

}catch(err){

console.error(err);

res.status(500).json({
erro:"Erro ao registrar conferência"
});

}

});

module.exports = router;
