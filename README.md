# Whitelist Roblox + Discord

Esse projeto entrega 3 partes:

1. `server`: API externa que salva nick do Roblox, valida permissao e gera codigo.
2. `bot`: bot do Discord com slash command `/gerar-codigo`.
3. `roblox`: scripts do jogo para travar o player, esconder UIs, validar o codigo e liberar a entrada.

## Importante sobre hospedagem

- `Render` e `SquareCloud` sao os mais indicados para esse projeto do jeito que ele esta.
- `Vercel` nao e uma boa opcao para o bot do Discord com `discord.js`, porque o bot precisa ficar conectado o tempo todo.
- A API deste projeto usa arquivo JSON para persistencia. Em `Vercel`, isso nao persiste entre execucoes. Se voce quiser usar Vercel na API, troque o storage por banco real, como MongoDB, Redis ou Postgres.
- No `Render`, voce tem dois jeitos:
  - `1 unico Web Service` rodando API + bot no mesmo processo
  - `2 servicos`, sendo `1 Web Service` para API e `1 Background Worker` para o bot
- O projeto agora suporta os dois modos.

## Arquivos para subir

Se voce vai usar Render com GitHub, suba o repositorio inteiro, incluindo:

```text
package.json
render.yaml
render.multi-service.yaml
src/
roblox/
data/.gitkeep
README.md
.env.example
.gitignore
```

Nao suba:

```text
node_modules/
.env
data/*.json
```

O `.gitignore` do projeto ja foi preparado para isso.

## Estrutura

```text
src/
  all-in-one/
  bot/
  server/
  shared/
roblox/
data/
```

## Como funciona

1. O usuario roda `/gerar-codigo` no Discord.
2. Se ele nao tiver nick salvo, o bot abre um modal com textbox para ele informar o nick do Roblox.
3. Se ele ja tiver nick salvo, o bot responde so para ele com botoes `Confirmar` e `Trocar`.
4. O bot envia a requisicao para a API.
5. A API verifica se o usuario tem algum cargo permitido.
6. Se tiver, a API gera um codigo unico, vinculado ao nick salvo do Roblox.
7. No jogo, o player entra travado, com `ForceField`, sem conseguir se mover e com as outras UIs escondidas.
8. Ao enviar o codigo, o Roblox chama a API.
9. A API valida:
   - se o codigo existe
   - se ainda nao expirou
   - se ainda nao foi usado
   - se o codigo pertence exatamente ao nick daquele player
10. Se estiver tudo certo, o player e liberado.

## Configuracao

1. Copie `.env.example` para `.env`.
2. Preencha as variaveis.
3. Rode:

```bash
npm install
```

## Rodar localmente

API:

```bash
npm run server
```

Bot:

```bash
npm run bot
```

Cheque sintaxe:

```bash
npm run check
```

## Variaveis

- `INTERNAL_API_KEY`: chave usada entre bot e API.
- `ROBLOX_SHARED_SECRET`: chave usada entre Roblox e API.
- `DISCORD_ALLOWED_ROLE_IDS`: cargos que podem gerar codigo.
- `CODE_TTL_MINUTES`: tempo de vida do codigo.
- `DATA_FILE`: arquivo onde os nicks e codigos ficam salvos.
- `API_BASE_URL`: URL completa da API, usada localmente.
- `API_HOSTPORT`: usado no Render para o bot falar com a API pela rede privada interna.

## Deploy no Render

### Entendendo o que vai para o GitHub

Voce nao precisa separar `roblox`, `api`, `bot` e `data` em repositorios diferentes.

Pode ficar tudo junto no mesmo repo, por exemplo:

```text
meu-repo/
  src/
    all-in-one/
    bot/
    server/
    shared/
  roblox/
  data/
  package.json
  render.yaml
  README.md
```

O GitHub guarda o codigo.
O Render escolhe qual comando executar desse mesmo repo.

Entao:

- o repo continua `tudo junto`
- a separacao acontece so no `startCommand`, se voce quiser
- ou nem isso, se usar modo `1 servico`

### Resumo rapido

Voce pode escolher entre dois modelos.

### Modelo 1: um servico so

Esse e o mais simples.

Voce cria:

1. `1 Web Service`
2. `1 Persistent Disk`

Esse unico servico roda:

- API
- bot do Discord
- storage JSON

### Modelo 2: dois servicos

Esse e o modelo mais organizado.

Voce cria:

1. `1 Web Service` para a API
2. `1 Background Worker` para o bot
3. `1 Persistent Disk` preso na API

### Qual eu recomendo para voce agora

Como voce quer simplicidade, eu recomendo `1 unico Web Service`.

Foi por isso que eu mudei o [render.yaml](./render.yaml) para esse modo.

### Onde o storage fica

Mesmo no modo de `1 servico`, o storage continua num disco persistente em:

```text
/var/data
```

O arquivo JSON do sistema vai ficar em:

```text
/var/data/whitelist-storage.json
```

### Importante antes de criar

- `Persistent Disk` exige servico pago no Render.
- Se voce usar `2 servicos`, o `Background Worker` tambem nao usa plano `free`.
- Se voce usar `1 unico Web Service`, normalmente fica mais simples e mais barato do que separar em dois servicos.

### Jeito mais facil: usar o `render.yaml`

O projeto ja inclui [render.yaml](./render.yaml). Ele cria:

- `roblox-whitelist-app` como `1 unico Web Service`
- `1 Persistent Disk` montado em `/var/data`
- todas as env vars necessarias no mesmo servico

### Se quiser o modo com 2 servicos

Tambem deixei pronto o arquivo [render.multi-service.yaml](./render.multi-service.yaml).

Esse modo cria:

- `roblox-whitelist-api` como `Web Service`
- `roblox-whitelist-bot` como `Background Worker`
- `1 Persistent Disk` na API

### Passo a passo

1. Suba este projeto para um repositorio no GitHub.
2. Entre no Render.
3. Clique em `New`.
4. Clique em `Blueprint`.
5. Conecte seu GitHub, se ainda nao estiver conectado.
6. Escolha o repositorio deste projeto.
7. O Render vai ler o `render.yaml`.
8. Preencha as variaveis secretas que ele pedir.
9. Confirme a criacao do servico.
10. Espere o deploy terminar.

### Variaveis que voce vai preencher no Render

#### Servico unico

- `DISCORD_ALLOWED_ROLE_IDS`
  - Coloque os IDs dos cargos que podem gerar codigo.
  - Se for mais de um, separe por virgula.
  - Exemplo:

```text
123456789012345678,987654321098765432
```

- `ROBLOX_SHARED_SECRET`
  - Crie um segredo forte.
  - Esse mesmo valor precisa ser colocado no script do Roblox.

- `DISCORD_TOKEN`
  - Token do seu bot.

- `DISCORD_CLIENT_ID`
  - Application ID do bot.

- `DISCORD_GUILD_ID`
  - ID do servidor do Discord onde o slash command sera registrado.

- `INTERNAL_API_KEY`
  - O `render.yaml` ja gera automaticamente esse valor.
  - Nao precisa inventar manualmente, a nao ser que voce queira trocar depois.

### Como pegar os IDs do Discord

- `DISCORD_CLIENT_ID`
  - Discord Developer Portal
  - `Applications` > seu bot > `General Information` > `Application ID`

- `DISCORD_GUILD_ID`
  - Ative `Developer Mode` no Discord
  - Clique com botao direito no servidor
  - `Copy Server ID`

- `DISCORD_ALLOWED_ROLE_IDS`
  - Ative `Developer Mode`
  - Clique com botao direito no cargo
  - `Copy Role ID`

### O que o servico unico vai rodar

- Tipo: `Web Service`
- Build Command:

```bash
npm install
```

- Start Command:

```bash
npm run app
```

- Health Check Path:

```text
/api/health
```

- Persistent Disk:
  - Mount Path: `/var/data`
  - Arquivo usado pelo projeto: `/var/data/whitelist-storage.json`

### Se voce quiser criar manualmente sem `render.yaml`

#### Modo 1: um servico so

- Type: `Web Service`
- Runtime: `Node`
- Root Directory: repo inteiro
- Build Command: `npm install`
- Start Command: `npm run app`
- Health Check Path: `/api/health`
- Disk:
  - Mount Path: `/var/data`
  - Size: `1 GB`
- Environment Variables:
  - `DATA_FILE=/var/data/whitelist-storage.json`
  - `INTERNAL_API_KEY=um segredo forte`
  - `ROBLOX_SHARED_SECRET=um segredo forte`
  - `DISCORD_ALLOWED_ROLE_IDS=ids,dos,cargos`
  - `CODE_TTL_MINUTES=15`
  - `DISCORD_TOKEN=seu token`
  - `DISCORD_CLIENT_ID=seu client id`
  - `DISCORD_GUILD_ID=seu guild id`

#### Modo 2: dois servicos

Se quiser separar depois, use o arquivo [render.multi-service.yaml](./render.multi-service.yaml) como referencia.

### Depois do deploy

1. Abra a URL publica da API no navegador:

```text
https://seu-servico.onrender.com/api/health
```

2. Ela deve responder algo como:

```json
{"ok":true}
```

3. Verifique os logs do bot.
4. Ele deve subir e registrar o comando `/gerar-codigo`.
5. Teste no Discord com um usuario que tenha o cargo permitido.

### Configurar o Roblox para falar com a API do Render

No arquivo [roblox/WhitelistServer.server.lua](./roblox/WhitelistServer.server.lua), troque:

- `VALIDATION_URL`
  - Exemplo:

```lua
local VALIDATION_URL = "https://roblox-whitelist-app.onrender.com/api/roblox/validate"
```

- `SHARED_SECRET`
  - Coloque exatamente o mesmo valor de `ROBLOX_SHARED_SECRET` da API no Render.

### Observacoes importantes

- O arquivo JSON de dados fica salvo no disco da API, nao no bot.
- No modo de `1 servico`, API e bot rodam juntos.
- No modo de `2 servicos`, o bot nao precisa de disco.
- Se voce redeployar a API sem disco, perdera todos os nicks e codigos.
- Com disco, os dados persistem entre reinicios e deploys.
- Como a API usa disco persistente, esse servico nao tera zero-downtime deploy.
- Se um dia voce quiser escalar muito, o ideal e trocar o JSON por banco real.

## Roblox

Leia [roblox/SETUP.md](./roblox/SETUP.md) para montar a GUI e colocar os scripts no lugar certo.

## Slash command

O Discord nao aceita slash command com espaco ou acento no nome, entao o comando registrado e:

```text
/gerar-codigo
```
