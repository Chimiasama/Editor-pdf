# APK de teste

A action **Validar e gerar APK** executa TypeScript, testes de exportação PDF e build web. Em seguida gera um APK Android debug usando Capacitor e Java 21. Roda em PRs, pushes para `main` e manualmente em **Actions → Validar e gerar APK → Run workflow**.

Na execução concluída, abra **Artifacts → EditPDF-debug-apk**, baixe e extraia o ZIP. Transfira `app-debug.apk` para o celular Android, permita a instalação por essa origem e instale. É um APK debug para testes, sem assinatura de distribuição ou publicação na Play Store. Cada runner pode gerar uma chave debug diferente: se uma atualização falhar por assinatura incompatível, desinstale a versão anterior (isso apaga seus dados locais).

O APK carrega o build local, sem servidor Express e sem Gemini. Worker PDF.js, mapas de caracteres, fontes PDF e WASM são empacotados com a versão instalada. Fontes da interface ainda podem usar Google Fonts; haverá fallback sem rede. Importação abre o seletor de arquivos; exportação usa o compartilhamento Android para salvar/enviar o PDF.

## Desenvolvimento

Com Node 24.19.0 e Bun 1.4.4:

```sh
bun install --frozen-lockfile
npm run lint
npm test
npm run build
npm run android:prepare
```

O diretório `android/` é gerado e ignorado. Para compilar localmente, instale Java 21 e Android SDK compatível com a versão do Capacitor, configure `ANDROID_HOME` e execute `npm run android:apk`. O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. Não edite o diretório gerado para mudanças que precisem sobreviver a uma geração limpa; registre-as em scripts/configuração.

## Roteiro no celular

- Abrir um PDF pelo seletor, navegar, usar pinça e duplo toque, testar retrato/paisagem.
- Voltar à biblioteca, marcar favorito e filtrar documentos.
- Adicionar texto e imagem, cobrir uma região, recortar e girar a página.
- Exportar pelo compartilhamento, salvar e abrir em outro leitor para verificar as edições.
- Fechar e reabrir: atualmente apenas a lista/metadados persistem; os bytes do PDF ficam em memória. Reabrir um PDF importado após reiniciar é uma limitação conhecida.

A CI não executa emulador nem testes físicos de Android; APK compilado não prova que todos esses fluxos funcionam no aparelho.
