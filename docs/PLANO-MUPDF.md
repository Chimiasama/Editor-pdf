# Edição real com MuPDF — plano de execução

Esta fase substitui a correção visual por alteração do conteúdo PDF. O plano anterior (`PLANO-MELHORIAS.md`) descreve a base já existente; esta fase aproveita IndexedDB, Capacitor e a exportação Android. Sem IA ou documentos de exemplo automáticos.

1. **Motor:** integrar MuPDF.js 1.28.1 em Web Worker, extrair trechos e imagens, modificar conteúdo real, manter histórico e salvar sem revisões antigas.
2. **Interface:** biblioteca clara com importação do aparelho; leitor de página com ajuste à largura, navegação, busca e ferramentas acessíveis ao toque; painel de edição simples.
3. **Edição:** selecionar texto original, alterar/remover e reinserir preservando fundo; adicionar texto, remover imagens identificadas, inserir imagens na frente ou no fundo, girar página.
4. **Arquivos:** manter original e cópia de trabalho separados no IndexedDB, salvar alterações automaticamente, oferecer download/compartilhamento da cópia editada. Manter acesso às anotações antigas por conversão explícita.
5. **Validação e entrega:** testes que inspecionam o conteúdo exportado (texto antigo ausente), histórico, imagens, fundos, persistência, interface móvel e build; commit direto na main e CI Android existente.

## Limites desta fase

- Edição por trechos de uma linha; não há redistribuição automática de parágrafos entre páginas.
- A fonte embutida é recarregada dos bytes originais e reutilizada quando contém os caracteres. Fontes de substituição do leitor não são reembutidas, para evitar mapas de caracteres incorretos. Caso contrário, usa-se uma fonte equivalente e informa-se a substituição.
- Rotação/direção complexa e texto sobreposto são bloqueados em vez de danificar outra parte da página.
- Digitalizações exigem OCR, fora desta fase. Não são apresentadas como texto editável.
- Remoção de imagem por região preserva texto e vetores, mas imagens sobrepostas exigem tratamento de objetos mais avançado.
- Fundo inserido atrás de um objeto opaco pode ficar encoberto. Vetores ainda não têm seleção individual.
- PDFs abertos com senha mantêm o original protegido; a cópia de trabalho e a exportação ficam sem senha, conforme aviso antes da abertura.
- Armazenamento é local ao aparelho/origem; baixar uma cópia é o backup externo.
- Mudanças invalidam assinaturas digitais do PDF, como em qualquer editor de conteúdo.

## Licenciamento

MuPDF.js é Copyright Artifex Software, Inc., AGPL-3.0-or-later. Ver `THIRD-PARTY-NOTICES.md`, `public/licenses/AGPL-3.0.txt` e https://artifex.com/licensing. O aplicativo não envia documentos a serviços externos.

## Execução concluída

1. **Concluído:** MuPDF.js em worker com fila de comandos; alteração de conteúdo, histórico nativo e exportação com limpeza de objetos antigos sem corromper o histórico.
2. **Concluído:** nova biblioteca e leitor responsivo, com importação, ferramentas de edição, busca na página e navegação. IA e exemplos automáticos ausentes.
3. **Concluído:** edição/exclusão de texto existente, inserção de texto, remoção e inserção de imagens e rotação. Fontes embutidas são recarregadas para evitar mapas de caracteres remapeados; acentos foram conferidos visualmente.
4. **Concluído:** IndexedDB v2 separa original e cópia de trabalho, mantém a migração explícita das anotações antigas e permite restaurar o original. Exportação de arquivos autenticados por senha produz uma cópia sem senha, com aviso na interface.
5. **Validado localmente:** 20 testes de conteúdo/armazenamento, 9 testes de navegador em viewport móvel (incluindo layout desktop), TypeScript, build de produção e preparação/sincronização Capacitor. Testes verificam ausência do texto antigo na exportação, acentos, fontes embutidas, rollback em erro, imagens/fundos, original preservado, reinício, senha e histórico após salvar.

Capturas de teste foram inspecionadas em celular e desktop. Não houve teste em aparelho Android físico. O push na main aciona o workflow de validação e compilação do APK; o resultado remoto deve ser verificado na execução do GitHub Actions.
