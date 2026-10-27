# EditPDF no Windows e atualizações pelo aplicativo

O mesmo repositório mantém Android, navegador e Windows. O Tauri 2 empacota a interface e o MuPDF no instalador Windows x64. Não há servidor Node instalado no computador do usuário. O programa usa WebView2 e processa PDFs localmente.

## Instalação

O workflow `Windows — instalador e atualizações` executa automaticamente a cada push na main. Ele verifica tipos e testes, compila o executável Rust e publica o instalador `.exe` em [Releases](https://github.com/Chimiasama/Editor-pdf/releases/latest). A versão Windows é `0.2.<número da execução>`, incrementada sem alterar manualmente o package.json. O APK continua no workflow Android existente.

Baixe o `EditPDF_..._x64-setup.exe` e execute. Instalação para o usuário atual, sem publicação em lojas. A biblioteca do PC é separada da biblioteca do celular; não há sincronização de PDFs entre aparelhos.

## Como a atualização funciona

1. Um push na main dispara a compilação automaticamente. Uma atualização ainda precisa ser compilada; o usuário não precisa abrir nem executar Actions.
2. Quando a assinatura estiver configurada, o workflow publica também `latest.json` e assinaturas do instalador.
3. Ao iniciar, o app consulta a atualização. Há também o botão **Verificar atualizações**.
4. O usuário escolhe **Atualizar e reiniciar**. A assinatura é verificada pelo updater do Tauri. A edição deve estar concluída e salva; a tela é bloqueada durante a instalação para evitar alterações que seriam perdidas no reinício.
5. O identificador e o diretório de dados permanecem estáveis, preservando a biblioteca. Faça backups externos dos PDFs como de costume.

A assinatura do updater é diferente do certificado comercial Authenticode do Windows. O primeiro instalador ainda pode receber um aviso do SmartScreen por não ter um certificado reconhecido.

## Ativação única da assinatura (proprietário)

O acesso do assistente ao repositório não permite gerenciar Actions Secrets (403). Por isso o primeiro build funciona como instalador, mas **não anuncia a atualização automática como ativa**. Não há chave privada embutida ou publicada.

Uma única vez, no computador do proprietário, com Node.js 24, Bun e GitHub CLI instalados:

```sh
git clone https://github.com/Chimiasama/Editor-pdf.git
cd Editor-pdf
bun install --frozen-lockfile
gh auth login
npm run desktop:setup-updater
```

O script gera a chave localmente sem imprimir o conteúdo, grava a chave privada no secret `TAURI_SIGNING_PRIVATE_KEY` e a pública na variável `TAURI_UPDATER_PUBLIC_KEY`. A pasta `.desktop-signing` está ignorada pelo Git. **Guarde essa pasta como backup privado e não troque a chave após distribuir versões com atualização ativa.** Não é necessário Rust para executar este script de configuração.

Depois execute um novo workflow Windows (`workflow_dispatch`) ou faça um novo push na main. Instale manualmente esse primeiro instalador com assinatura configurada. A partir dele, as próximas versões podem ser instaladas pelo app, sem baixar o instalador manualmente.

As chaves não usam senha adicional; o armazenamento do GitHub Secret é criptografado. Nunca cole a chave privada em issues, commits, releases ou no chat.

## Desenvolvimento

Com Rust estável, ferramentas C++ de compilação do Windows, WebView2 e Node/Bun:

```sh
npm run desktop:dev
npm run desktop:build
```

O comando de salvar abre uma janela nativa e só escreve no caminho escolhido pelo usuário. Cancelar o diálogo não informa sucesso. O app não concede acesso nativo a páginas remotas. As atualizações não modificam a instalação Android.

A compilação no Windows é verificada pelo Actions. A instalação e a interação com janelas nativas ainda exigem validação em um PC físico.
