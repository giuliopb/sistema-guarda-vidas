# Detalhamento do Sistema de Conferência de Postos de Guarda-Vidas

## 1. Objetivo
Definir o comportamento funcional do sistema para dois perfis de acesso:
- **Administrador (gestor)**
- **Guarda-vidas (usuário operacional)**

---

## 2. Tela inicial: Login

### 2.1 Entradas
- Campo **login**
- Campo **senha**
- Botão **confirmar**

### 2.2 Regras de autenticação
1. O usuário informa login e senha.
2. O sistema valida as credenciais.
3. O sistema identifica o tipo de usuário:
   - **Admin**
   - **Guarda-vidas**

### 2.3 Saídas após login
- Se for **admin**, redireciona para o **Painel do Administrador**.
- Se for **guarda-vidas**, redireciona para o **Painel do Guarda-Vidas**.

---

## 3. Painel do Administrador

### 3.1 Ações principais
- Botão para **cadastrar postos**.
- Dentro de cada posto, opção para **cadastrar divisões**.
- Dentro de cada divisão, opção para **cadastrar itens**.
- Botão para **adicionar tarefas diárias**.
- Botão para **verificar conferências dos postos** realizadas pelos guarda-vidas.

### 3.2 Área de acompanhamento de problemas
Abaixo dos botões principais, o sistema deve listar todos os problemas/alterações reportados pelos guarda-vidas.

Para cada problema listado, o gestor deve poder:
- visualizar detalhes;
- atualizar o status (por exemplo: pendente, em correção, resolvido);
- manter sem atualização, se desejar.

### 3.3 Regras administrativas obrigatórias
- O admin deve poder **incluir, editar e excluir posto**.
- O admin deve poder **incluir, editar e excluir tarefa diária**.

---

## 4. Painel do Guarda-Vidas

### 4.1 Componentes do painel
- Botão principal (grande): **Iniciar conferência**.
- Botão abaixo: **Solicitações diversas**.
- Caixa/mensagem exibindo a **tarefa diária** (quando existir).

### 4.2 Fluxo de conferência
1. Ao clicar em **Iniciar conferência**, o sistema exibe a lista de **postos**.
2. Ao selecionar um posto, exibe as **divisões**.
3. Ao selecionar uma divisão, exibe os **itens** da divisão para conferência.

---

## 5. Regras funcionais da conferência por posto

### 5.1 Regras por divisão
- As divisões podem ser conferidas em **ordem aleatória**.
- Após concluir todos os itens de uma divisão, essa divisão fica **inacessível** até o fechamento total do posto.

### 5.2 Fechamento da conferência do posto
- Quando todas as divisões do posto forem concluídas, o sistema deve exibir a mensagem:
  - **"Conferência de posto realizada"**
- Após essa conclusão, o sistema deve **liberar novamente todas as divisões** para nova conferência futura.

---

## 6. Regras de conferência de itens

Em cada item da divisão, o guarda-vidas pode:
- marcar como **OK**;
- registrar problema usando um botão de não conformidade.

### 6.1 Opção: Alterar quantidade do item
Quando o usuário altera a quantidade:
- Se nova quantidade for **maior ou igual** ao padrão cadastrado, o sistema não sinaliza problema.
- Se nova quantidade for **menor** que o padrão:
  - exibir um ícone visual indicando não conformidade de quantidade;
  - registrar como **alteração/problema** para aparecer na tela do gestor.

### 6.2 Opção: Reportar alteração
Quando o item está avariado ou com outro problema:
- abrir uma caixa de texto curta para descrição do problema;
- registrar o relato como **alteração/problema** para aparecer na tela do gestor.

---

## 7. Resumo das entidades mínimas
- **Usuário** (com perfil: admin ou guarda-vidas)
- **Posto**
- **Divisão**
- **Item** (com quantidade padrão)
- **Conferência de posto/divisão**
- **Alteração/Problema reportado**
- **Tarefa diária**

---

## 8. Critérios de aceite (alto nível)
- Login redireciona corretamente por perfil.
- Admin consegue manter postos e tarefas (CRUD).
- Guarda-vidas executa fluxo posto → divisão → itens.
- Divisão concluída fica bloqueada até finalizar o posto.
- Ao concluir todas as divisões, sistema exibe mensagem de conferência concluída e libera novo ciclo.
- Problemas de quantidade abaixo do padrão e avarias são enviados ao painel do gestor.
