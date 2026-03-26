const express = require('express');
const cors = require('cors');
const path = require('path');

const usuariosRoutes = require('./routes/usuarios');
const postosRoutes = require('./routes/postos');
const divisoesRoutes = require('./routes/divisoes');
const dashboardRoutes = require('./routes/dashboard');
const tarefasRoutes = require('./routes/tarefas');
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

initDatabase()
    .then(() => {
        app.listen(3000, () => {
            console.log('Servidor rodando na porta 3000');
        });
    })
    .catch((error) => {
        console.error('Falha ao inicializar banco:', error);
        process.exit(1);
    });
