# Sistema de Conferência de Postos de Guarda-Vidas

Sistema web para gestão e conferência de equipamentos em postos de guarda-vidas.

## Objetivo

Permitir o controle digital da conferência diária de equipamentos nos postos de guarda-vidas, garantindo maior segurança operacional e rastreabilidade das alterações.

---

# Tecnologias Utilizadas

Backend
- Node.js
- Express

Banco de dados
- PostgreSQL

Frontend
- HTML
- CSS
- JavaScript

Controle de versão
- Git
- GitHub

---

# Estrutura do Projeto
sistema-guarda-vidas

backend
│
├── server.js
├── db.js
│
└── routes
├── usuarios.js
├── postos.js
├── divisoes.js
└── dashboard.js

frontend
│
├── index.html
└── admin.html


---

# Funcionalidades

## Administrador

- Login no sistema
- Visualização de todos os postos
- Identificação de postos conferidos ou não
- Visualização da última conferência
- Consulta de alterações registradas
- Cadastro de postos, divisões e itens

---

## Guarda-vidas

- Login no sistema
- Seleção do posto
- Seleção da divisão
- Realização de checklist
- Registro de alterações
- Salvamento automático por divisão

---

# Fluxo do Sistema

Guarda-vidas:
Login
↓
Selecionar posto
↓
Selecionar divisão
↓
Checklist dos itens
↓
Registrar alterações
↓
Salvar divisão


Administrador:
Login
↓
Dashboard
↓
Visualização dos postos
↓
Consulta de alterações


---

# Banco de Dados

Principais tabelas:

- usuarios
- postos
- divisoes
- itens
- conferencias
- conferencia_divisoes
- alteracoes

---

# Como executar o projeto

1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/sistema-guarda-vidas


2. Entrar na pasta backend


cd backend


3. Instalar dependências


npm install


4. Iniciar o servidor


node server.js


5. Abrir no navegador


http://localhost:3000


---

# Autor

Projeto desenvolvido como parte do curso de Engenharia de Software.