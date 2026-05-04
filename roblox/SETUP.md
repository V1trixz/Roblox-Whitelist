# Setup Roblox

## Hierarquia da GUI

Monte sua GUI exatamente assim:

```text
StarterGui
  Whitelist (ScreenGui)
    Prompt (Frame)
      Window (Frame)
        Yes (TextButton)
        No (TextButton)
        Code (TextBox)
```

## Onde colocar os scripts

```text
StarterPlayer
  StarterPlayerScripts
    WhitelistClient.client.lua

ServerScriptService
  WhitelistServer.server.lua
```

## Ajustes importantes

1. Em `Home > Game Settings > Security`, ative `Enable Studio Access to API Services` para testes e `Allow HTTP Requests`.
2. No arquivo [WhitelistServer.server.lua](E:\Whitelist-discord\roblox\WhitelistServer.server.lua), troque:
   - `VALIDATION_URL`
   - `SHARED_SECRET`
3. No `ScreenGui` `Whitelist`, deixe `ResetOnSpawn = false`.
4. O `TextBox` `Code` pode ter o placeholder que voce quiser, por exemplo `Digite seu codigo`.
5. O script ja esconde as outras UIs e depois reativa so as que estavam ligadas antes.

## Comportamento implementado

- Player entra bloqueado.
- Player ganha `ForceField`.
- Player nao consegue se mover.
- Outras UIs somem enquanto a whitelist estiver aberta.
- Botao `No` remove o player do jogo.
- Codigo errado mostra mensagem vermelha.
- Codigo certo mostra animacao de `Carregando.` `Carregando..` `Carregando...`.
- Ao validar, a GUI some e somente as UIs que estavam ativas antes voltam.
