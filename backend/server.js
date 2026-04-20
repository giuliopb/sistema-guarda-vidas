const express = require('express');
const cors = require('cors');
const path = require('path');

const usuariosRoutes = require('./routes/usuarios');
const postosRoutes = require('./routes/postos');
const divisoesRoutes = require('./routes/divisoes');
const dashboardRoutes = require('./routes/dashboard');
const tarefasRoutes = require('./routes/tarefas');
const trocasRoutes = require('./routes/trocas');
const initDatabase = require('./database/init');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/usuarios', usuariosRoutes);
app.use('/postos', postosRoutes);
app.use('/divisoes', divisoesRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tarefas', tarefasRoutes);
app.use('/trocas', trocasRoutes);

initDatabase()
    .then(() => {
        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Falha ao inicializar banco:', error);
        process.exit(1);
    });
