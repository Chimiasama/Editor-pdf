# Comparação com o pedido original (sem IA)

O app é um protótipo de leitor com anotações e exportação. Ainda não atende à proposta de editor completo de PDFs.

| Pedido | Estado no código | Limitação |
| --- | --- | --- |
| Ler PDFs | Implementado com PDF.js | Validar PDFs grandes, protegidos e digitalizados no Android |
| Pinçar para zoom e diminuir | Hook de pinça, duplo toque e botões | Usabilidade física e conflitos com gestos ainda precisam de teste |
| Lista de PDFs do celular | Importação pelo seletor e biblioteca interna | Não lista automaticamente todos os PDFs do armazenamento |
| Favoritos | Metadados em localStorage e filtro | Arquivos importados não persistem; somente metadados |
| Editar escrita | Inserção/edição de caixas de texto adicionais | Não seleciona nem substitui texto original; fonte Helvetica e linhas simples, sem recomposição tipográfica |
| Remover imagens | Cobertura com retângulo opaco | Imagem/conteúdo original continua dentro do PDF; não serve para apagar dados sensíveis |
| Inserir/substituir imagem | Sobreposição de imagens enviadas pelo usuário | Não extrai nem substitui o objeto original; cobertura não recompõe o fundo |
| Diagramação/enquadramento | Recorte, rotação, posicionamento de anotações | Sem edição estrutural de parágrafos, fluxo de texto ou garantia de ausência de sobreposição |
| Não perder diagramação | Páginas originais são mantidas sob as anotações | Isso preserva a base, mas não garante edição perfeita ou correção de texto existente |
| Índice com navegação | Capítulos previamente cadastrados, sobretudo no exemplo | Não importa os bookmarks originais nem detecta sumário de arquivos novos |
| Simplicidade no celular | Interface responsiva e gestos previstos | Painéis laterais e desenho/seleção de anotações precisam de revisão em telas pequenas |
| Edição completa | Parcial | Sem OCR, assinatura, mesclar/dividir/reordenar páginas, formulários ou edição de objetos originais |

## Problemas adicionais encontrados na revisão

- `pdfBytesCache` fica somente em memória. Ao tentar reabrir documento sem bytes, o app cria outro livro de exemplo em vez de recuperar o arquivo.
- Histórico de desfazer/refazer não começa com o estado original e não é separado por documento; deve ser revisto.
- Atalhos de aranha/brasão são específicos do exemplo, mas aparecem na página 5 de qualquer documento. Eles mudam a página e adicionam anotações usando o estado anterior; a substituição também faz duas atualizações consecutivas que podem sobrescrever a máscara.
- Ferramentas de desenho e exportação não têm cobertura funcional completa. O tipo `draw` existe, mas a exportação não implementa traços livres.
- As mensagens de “remoção” e “diagramação perfeita” são mais fortes que o comportamento real de sobreposição.

## Prioridade sugerida

1. Persistir os bytes com IndexedDB ou armazenamento nativo e recuperar documentos corretamente.
2. Corrigir histórico, gestos de edição e ações do exemplo; validar importação/exportação em aparelhos reais.
3. Distinguir cobertura visual de remoção real e inserção de texto de edição do texto original.
4. Acrescentar edição estrutural/remoção de objetos, gerenciamento de páginas e importação de bookmarks, conforme prioridade do produto.

Esta análise é uma revisão do código, não uma certificação de funcionamento no celular. A IA foi excluída da avaliação e do aplicativo.
