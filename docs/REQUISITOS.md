# Estado do EditPDF — ferramentas gratuitas e permissivas

O usuário escolheu manter dependências gratuitas/permissivas e aceitar limites na edição do PDF original. Não foi adotado motor AGPL ou SDK comercial.

## Dois modos de edição

- **PDF:** mantém páginas originais e adiciona anotações. “Corrigir texto” permite selecionar trechos extraídos, alterar texto, fonte/tamanho/cor/alinhamento e aplicar correção visual. A região original é coberta de branco; o conteúdo original continua no PDF. Não é remoção segura, nem substituição estrutural do texto.
- **Documento:** importa o texto selecionável para um editor de parágrafos (Tiptap), com digitação livre, negrito, itálico, sublinhado, títulos, listas, alinhamento e inserção/exclusão/dimensionamento de imagens novas. Exporta um PDF novo em A4 com quebra automática de linhas/páginas (pdfmake). O usuário aceita a conversão antes de iniciá-la; imagens originais, tabelas, layout e anotações do modo PDF não são importados. O original e o rascunho ficam separados.

## Funções e limites

| Pedido | Implementação atual | Limite |
| --- | --- | --- |
| Salvar arquivos e edições | IndexedDB guarda bytes, metadados, favoritos, anotações e rascunho Documento | Dados locais podem ser apagados ao desinstalar/limpar dados; exportar backups |
| Biblioteca do celular | Seletor de arquivos, busca e favoritos | Não varre automaticamente todo o armazenamento |
| Leitura móvel | Página ajustada à largura, pinça, duplo toque e navegação | Testada em navegador móvel emulado; validar WebView e aparelho físico |
| Corrigir texto existente | Seleção de trechos com texto inicial preenchido e editor de bloco | Correção por sobreposição branca, não edição real dos operadores PDF; texto inclinado/rotacionado e OCR não suportados |
| Escrever como documento | Editor de parágrafos com fluxo e paginação na exportação | Conversão sem layout original; ordem textual de PDFs em colunas pode precisar de correção manual |
| Imagens | Inserir PNG/JPEG, selecionar/mover/redimensionar/trocar/excluir imagens adicionadas; tamanho/exclusão no Documento | Objetos de imagem originais não são selecionáveis ou removidos do PDF |
| Cobrir regiões | Retângulo opaco com nome e aviso claros | Não apaga dados sensíveis, objetos originais ou texto copiável |
| Histórico | Desfazer/refazer a primeira edição, separado por documento; gesto de movimento salva uma ação | Histórico transitório; edições finais persistem, mas pilha não sobrevive à reinicialização |
| Navegação | Importa bookmarks do PDF e usa miniaturas reais carregadas sob demanda | Não detecta sumário por OCR nem cria links internos novos automaticamente |
| Recorte/rotação | Exporta alterações de página; coordenadas de anotações levam rotação em conta | Edição sobre páginas com recorte complexo deve ser conferida após exportar |
| Texto exportado | Quebra linhas, incorpora Roboto, suporta acentos e rejeita caixas pequenas em vez de cortar silenciosamente | Fontes originais não são recriadas; nem todos os alfabetos/símbolos estão cobertos |

## Validação

Testes unitários cobrem armazenamento, histórico, geometria rotacionada, quebra de linhas, overflow e paginação do Documento. Testes Playwright em viewport 390×844 cobrem importação, correção, persistência após reload, exportação com extração do texto resultante, desfazer/refazer e gestos de toque. A CI executa essas verificações antes de compilar o APK debug.

Ainda não é um editor equivalente ao Word para qualquer PDF. Edição fiel de objetos originais, remoção segura, OCR, recomposição de tabelas/colunas e preservação exata de fontes/layout exigem trabalho adicional e/ou outro motor. O modo Documento fornece edição fluida com uma conversão explícita e perda de layout conhecida.
