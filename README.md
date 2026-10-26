# EditPDF

Leitor e editor pessoal de PDFs para navegador e Android. Abra um arquivo do aparelho, toque em **Editar**, escolha um texto existente, altere e use **Salvar cópia**. Os arquivos são processados localmente. Sem IA, sem chave de API e sem importação automática de exemplos.

## Esta versão

- MuPDF.js 1.28.1 em Web Worker para leitura e alteração real do conteúdo.
- Substituição e exclusão de trechos de texto, com preservação do fundo e ajuste opcional do tamanho ao espaço original.
- Reutilização das fontes embutidas quando possível, com fonte equivalente quando necessário.
- Inserção de texto, remoção de imagens separadas e inserção de imagens na frente ou no fundo.
- Desfazer/refazer, busca na página, índice original, navegação, zoom e rotação.
- Biblioteca IndexedDB com original preservado e cópia de trabalho salva automaticamente; download no navegador e compartilhamento nativo no Android.
- Interface responsiva em português. O editor de documento com parágrafos continua disponível em **Mais opções**, como conversão opcional para um novo layout.

O plano e os limites estão em [docs/PLANO-MUPDF.md](docs/PLANO-MUPDF.md). Esta fase edita trechos de uma linha; ainda não é um processador de texto com redistribuição de parágrafos entre páginas. Digitalizações precisam de OCR. Imagens sobrepostas, texto com rotação/direção complexa e vetores têm limitações explícitas. Alterar conteúdo invalida assinaturas digitais preexistentes.

## Desenvolvimento

Requer Node.js 24 e Bun 1.4.4 (gerenciador usado pelo lockfile e CI).

```sh
bun install --frozen-lockfile
npm run dev
```

Abra `http://localhost:3000`. Não é necessário configurar serviços de IA.

```sh
npm run lint         # verificação TypeScript
npm test             # conteúdo PDF, histórico, armazenamento e conversão
npm run build
npx playwright install chromium
npm run test:e2e     # interface móvel contra a compilação de produção
```

`npm run preview` serve o build local. Os arquivos WASM, fontes e recursos são empacotados, sem depender de CDNs durante a edição.

## Android

A cada push na `main`, o workflow **Validar e gerar APK** verifica tipos, testes, interface e build, e então compila o APK. Abra a execução em [GitHub Actions](https://github.com/Chimiasama/Editor-pdf/actions), baixe o artefato `EditPDF-debug-apk`, extraia e instale `app-debug.apk` no aparelho. Não há publicação na Play Store.

Para compilar localmente, com JDK 21 e Android SDK configurados:

```sh
npm run android:apk
```

O armazenamento é local à instalação/origem. Limpar dados do aplicativo ou navegador apaga a biblioteca. Use **Salvar cópia** para manter backups externos. A emulação de viewport móvel não substitui validação no aparelho físico.

## Licença

Esta versão combinada com MuPDF é disponibilizada sob **AGPL-3.0-or-later**; veja [LICENSE](LICENSE) e [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). MuPDF/MuPDF.js é Copyright Artifex Software, Inc. Dependências e trechos preexistentes mantêm seus avisos e licenças aplicáveis. O código correspondente da aplicação e as instruções de compilação estão neste repositório. O código do motor está nos projetos oficiais [MuPDF](https://github.com/ArtifexSoftware/mupdf) e [MuPDF.js](https://github.com/ArtifexSoftware/mupdf.js).
