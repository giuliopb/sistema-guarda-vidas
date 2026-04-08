CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    senha VARCHAR(200),
    tipo VARCHAR(20) -- admin ou gv
);

CREATE TABLE postos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100)
);

CREATE TABLE divisoes (
    id SERIAL PRIMARY KEY,
    posto_id INT REFERENCES postos(id),
    nome VARCHAR(100)
);

CREATE TABLE itens (
    id SERIAL PRIMARY KEY,
    divisao_id INT REFERENCES divisoes(id),
    nome VARCHAR(100),
    quantidade_padrao INT,
    quantidade_atual INT
);

CREATE TABLE conferencias (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    posto_id INT REFERENCES postos(id),
    data TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conferencia_divisoes (
    id SERIAL PRIMARY KEY,
    conferencia_id INT REFERENCES conferencias(id),
    divisao_id INT REFERENCES divisoes(id),
    data_hora TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alteracoes (
    id SERIAL PRIMARY KEY,
    item_id INT REFERENCES itens(id),
    conferencia_id INT REFERENCES conferencias(id),
    quantidade_encontrada INT,
    descricao TEXT,
    resolvido BOOLEAN DEFAULT FALSE
);

CREATE TABLE tarefas_diarias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL,
    dia_semana SMALLINT NOT NULL,
    todos_postos BOOLEAN NOT NULL DEFAULT FALSE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tarefas_diarias_postos (
    tarefa_id INT NOT NULL REFERENCES tarefas_diarias(id) ON DELETE CASCADE,
    posto_id INT NOT NULL REFERENCES postos(id) ON DELETE CASCADE,
    PRIMARY KEY (tarefa_id, posto_id)
);
