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

const {posto_id, divisao_id, usuario_id} = req.body;

try{

// pegar última conferência
let conferencia = await pool.query(`
SELECT id
FROM conferencias
WHERE posto_id=$1
ORDER BY id DESC
LIMIT 1
`,[posto_id]);

let conferenciaId;

if(conferencia.rows.length === 0){

const nova = await pool.query(`
INSERT INTO conferencias (posto_id,usuario_id)
VALUES ($1,$2)
RETURNING id
`,[posto_id,usuario_id]);

conferenciaId = nova.rows[0].id;

}else{

conferenciaId = conferencia.rows[0].id;

}

// registrar divisão
await pool.query(`
INSERT INTO conferencia_divisoes
(conferencia_id,divisao_id,usuario_id,data_hora)
VALUES ($1,$2,$3,NOW())
`,[conferenciaId,divisao_id,usuario_id]);

res.json({ok:true});

}catch(err){

console.error(err);

res.status(500).json({
erro:"Erro ao registrar conferência"
});

}

});

module.exports = router;