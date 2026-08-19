# Evidência — Video Clone gerado com a amostra automática do treino como áudio

Data da apuração: 2026-08-19 (consulta read-only via service role, tabela `video_clones`
cruzada com `profiles`; padrão buscado: `audio_path LIKE '%/sample.wav'`).

## Números

- **85 Video Clones** foram gerados usando a amostra do treino como áudio.
- **65 alunos distintos** afetados. Primeiro caso: 2026-07-17. Último: 2026-08-19 (o dia da apuração — o problema estava ativo).
- **633 linhas** `sample.wav` ready estavam expostas no seletor `/api/v1/videos/audios` no momento da apuração.
- Dessas, 632 têm `name = 'Amostra automática'` — **1 foi renomeada pelo aluno**, por isso o filtro do fix usa o PATH (determinístico, `${userId}/${voiceId}/sample.wav`, o aluno não edita) e não o name.
- Nenhum desses clones falhou: todos saem `ready`. Zero erro em log, zero incidente — o único sinal é o aluno reclamando de "qualidade" (caso itamar.vanzin, 3 reclamações, 1190 créditos nos 2 vídeos, 15 dias sem gerar desde então).

## O que é o sample.wav (correção de diagnóstico)

Não é a gravação crua que o aluno enviou pro treino: é a **amostra pós-treino gerada
pelo worker com a voz recém-clonada** (`runpod-worker/sample_gen.py`), ~10s falando a
frase fixa "Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza, o
treinamento funcionou muito bem." (ou a variante es/en). Ou seja: o lip-sync tecnicamente
funciona, mas o vídeo sai do avatar falando a frase de teste do treino — nunca o
conteúdo que o aluno queria. Por isso "não está ficando legal".

## Como ela chegou no seletor

`finalize-training.ts` insere a amostra como linha `ready` em `generations` (de
propósito, pro player do histórico — anti-churn). O endpoint `/api/v1/videos/audios`
listava TODA generation ready ≤ 90s, sem distinguir amostra de áudio de verdade. Esse
endpoint alimenta o AudioPicker do Video Clone **e** o do wizard de vídeo.

## Alunos e clones afetados

| Aluno | Clones | Datas |
|---|---|---|
| zecunha@hotmail.com | 1 | 2026-07-17 |
| juliocfmelo@icloud.com | 1 | 2026-07-21 |
| richargam@gmail.com | 3 | 2026-07-21, 2026-08-10 |
| seltonseltonlima@yahoo.com.br | 4 | 2026-07-22, 2026-07-23 |
| zezinho.brambila@gmail.com | 1 | 2026-07-23 |
| contatoelvysmax@gmail.com | 1 | 2026-07-23 |
| marcelocosme1983@gmail.com | 1 | 2026-07-24 |
| deboramaria02@gmail.com | 2 | 2026-07-24 |
| itamar.vanzin@gmail.com | 2 | 2026-07-25, 2026-07-26 |
| maison.bolzan@gmail.com | 1 | 2026-07-26 |
| felipe.vendas10@gmail.com | 1 | 2026-07-27 |
| tiagobogno@outlook.com | 2 | 2026-07-28 |
| miguel.sacramento@gmail.com | 1 | 2026-07-28 |
| flmg.liborio@gmail.com | 1 | 2026-07-28 |
| aneto2@gmail.com | 1 | 2026-07-29 |
| sst.medint@gmail.com | 1 | 2026-07-30 |
| amandacpattini@gmail.com | 1 | 2026-07-31 |
| spcvalentim@hotmail.com | 4 | 2026-08-02, 2026-08-03, 2026-08-06 |
| davidrvg@me.com | 1 | 2026-08-03 |
| jsprojetocasa@gmail.com | 1 | 2026-08-03 |
| 21cortez.c@gmail.com | 1 | 2026-08-03 |
| lucas.m.arrial@gmail.com | 1 | 2026-08-03 |
| fabiane@oliveirafoundation.com | 1 | 2026-08-04 |
| danivito1@hotmail.com | 1 | 2026-08-04 |
| patrickcaceres@gmail.com | 1 | 2026-08-04 |
| anneguimaraesestetica@gmail.com | 1 | 2026-08-05 |
| marcusnogue@gmail.com | 1 | 2026-08-05 |
| weslen_fernandes@icloud.com | 1 | 2026-08-05 |
| mariajulialima854@gmail.com | 3 | 2026-08-06 |
| monalizafita@gmail.com | 1 | 2026-08-06 |
| vinymoras@gmail.com | 2 | 2026-08-07 |
| brunaralmeida88@gmail.com | 1 | 2026-08-08 |
| drajulianapelegrini@gmail.com | 1 | 2026-08-08 |
| scheibelmarcelo2@gmail.com | 1 | 2026-08-09 |
| sidbae@gmail.com | 1 | 2026-08-10 |
| claudiooliveira79@gmail.com | 1 | 2026-08-10 |
| rbclasta@gmail.com | 1 | 2026-08-11 |
| diaslopesalice@gmail.com | 2 | 2026-08-11 |
| impactototalplush@gmail.com | 1 | 2026-08-11 |
| carol@carolcrozeta.com | 1 | 2026-08-11 |
| claudiano.avelino@gmail.com | 1 | 2026-08-12 |
| grupoarena@grupoarenaempresarial.com.br | 1 | 2026-08-12 |
| mstaakjr@gmail.com | 1 | 2026-08-12 |
| acontabilmg@gmail.com | 1 | 2026-08-12 |
| dayane_calixto@yahoo.com.br | 1 | 2026-08-13 |
| daysevieira520@gmail.com | 1 | 2026-08-13 |
| dmaggioni@bol.com.br | 3 | 2026-08-14, 2026-08-18 |
| viniciusbergamo.epm@gmail.com | 2 | 2026-08-15 |
| jujulacoshandmade@gmail.com | 1 | 2026-08-15 |
| mariana.plazevedo@gmail.com | 1 | 2026-08-16 |
| arthur@cordeiroac.adv.br | 1 | 2026-08-16 |
| chaplainfabio@gmail.com | 1 | 2026-08-17 |
| paraguassutans@gmail.com | 1 | 2026-08-17 |
| marcellsenapersonal@gmail.com | 2 | 2026-08-17 |
| rafaelleitemacedo@gmail.com | 1 | 2026-08-17 |
| draraissacampos@gmail.com | 1 | 2026-08-17 |
| dirceu.moura.cruz78@gmail.com | 1 | 2026-08-17 |
| skf72@hotmail.com | 2 | 2026-08-18, 2026-08-19 |
| chefmarcelomintz@hotmail.com | 1 | 2026-08-18 |
| richard.moraes@hc.fm.usp.br | 1 | 2026-08-18 |
| thiagoef01@gmail.com | 1 | 2026-08-18 |
| cecilianeves2045@gmail.com | 1 | 2026-08-18 |
| pestanatiago2008@gmail.com | 1 | 2026-08-19 |
| allysoncruz.nutri@gmail.com | 1 | 2026-08-19 |
| gustavo@easywaymtg.com | 1 | 2026-08-19 |

## IDs completos dos clones

- zecunha@hotmail.com: 82aca06d-a3b8-4df2-819e-1c0c3d0d5d7b
- juliocfmelo@icloud.com: 034913ec-befd-477b-8e09-b9d22dfed029
- richargam@gmail.com: 73eca880-506f-44a4-9011-c6edf378afe3, c0eaa644-d7ae-40e8-9909-a8b601c3c7c7, 401ca9c0-778a-4bb1-96e5-1cd1c81e9a78
- seltonseltonlima@yahoo.com.br: 79d0def2-c6d4-469c-9e36-f8bc6200be8d, 9a321179-5177-417e-96ac-b98eb4be6bfa, d51d8b5e-a236-4719-9b64-1e9daa9c0fdf, 4bf03eaa-04d1-4024-ac44-8520f695a0fd
- zezinho.brambila@gmail.com: 6eb26894-9226-4a14-afb5-a9042d103d9b
- contatoelvysmax@gmail.com: 8ae58f6a-c70f-45cf-b2c6-ddfc68aa95e2
- marcelocosme1983@gmail.com: f1056874-7718-4194-87ea-aa88cff6934b
- deboramaria02@gmail.com: 5c7c281f-3edf-43b9-9976-414116001207, fc07a265-22df-4326-8945-10867f6aef49
- itamar.vanzin@gmail.com: d0eaf374-0cd1-44d9-b3bd-8af06a7ae92d, b9b625d8-00dc-4438-b530-5ea3a7475711
- maison.bolzan@gmail.com: 7a5c1d67-9e07-48bb-a027-106937df9e1a
- felipe.vendas10@gmail.com: 89227e69-becd-4a35-89a0-a69ddb6e8a6a
- tiagobogno@outlook.com: e5cb2281-a144-4d3c-b7ee-6c94938cd60a, 3e3ddccd-5a97-4ac9-8f60-ce08c2034c95
- miguel.sacramento@gmail.com: c12b97fe-bc4f-4742-b74e-d811d935c8bb
- flmg.liborio@gmail.com: c2c808fb-b211-4070-b8eb-47a1588b62c6
- aneto2@gmail.com: e8b86715-ea45-47ff-9577-fe1a0b843f80
- sst.medint@gmail.com: 1dd1195b-b8be-4782-a75f-0097a038aa7c
- amandacpattini@gmail.com: d845c08d-a153-4541-8152-bf68260a9710
- spcvalentim@hotmail.com: e00ab0c2-1f76-479e-ba52-e6df6784648d, 244a8a33-db36-4f3b-b8c0-cc0fb2aeda89, 539b1fbd-5a4f-461b-97ab-c4f49f95df83, dd84e311-4e48-47e1-9195-609dd567c89c
- davidrvg@me.com: e5422976-4f5c-4e50-877f-e7f5bcc37e03
- jsprojetocasa@gmail.com: e80b520d-6b57-4e2a-837d-83b79e312412
- 21cortez.c@gmail.com: 8c6ec9d1-fe68-4c47-bff3-271ca8e1328d
- lucas.m.arrial@gmail.com: 985b1be3-4d00-413f-aaf4-83063002abad
- fabiane@oliveirafoundation.com: 7506189c-e7f2-4f28-b8de-cd41fca8a8a7
- danivito1@hotmail.com: b58dcec7-e197-4ccf-bb34-4afc5b72bb6c
- patrickcaceres@gmail.com: e3492f97-2b9a-4dd4-82e3-347f567a3689
- anneguimaraesestetica@gmail.com: 6917c34a-5652-4565-81b9-f680ce5029e4
- marcusnogue@gmail.com: e91a91cb-9ecf-4238-b76a-7dc3583e3e4c
- weslen_fernandes@icloud.com: 56204970-7241-4e31-8773-4e8b80a94ed3
- mariajulialima854@gmail.com: fcc90ebc-500c-47c5-9507-a3b06e4f3169, 4e58ce57-6117-459a-b203-345a95435997, 21410daa-20d2-4c9a-9127-2dad938b4042
- monalizafita@gmail.com: 36801df7-e3f6-4543-8add-a3abc40fa309
- vinymoras@gmail.com: ea0defe0-8065-41da-b49a-facd6c55f0bf, 3ab8af93-196f-4056-bad1-f8ea5da18689
- brunaralmeida88@gmail.com: ae91321d-a28e-4844-a11b-5fb4562d811c
- drajulianapelegrini@gmail.com: f52392f0-6c7c-4b05-b5d1-54e9750f8642
- scheibelmarcelo2@gmail.com: ce83cbfb-a818-4a0e-accd-aec8221e3288
- sidbae@gmail.com: 2204ec63-c377-4857-85d2-5aa464a87557
- claudiooliveira79@gmail.com: 4ba4a3d5-1f76-4718-9131-fd3631c156f4
- rbclasta@gmail.com: 12157225-94c5-4349-bc5a-b5941a7abc81
- diaslopesalice@gmail.com: 643c1f1a-a2b3-4076-baaa-fd974bcc1ca2, b6f6ed30-60ee-4d4b-ada4-d3af13e6b85f
- impactototalplush@gmail.com: 5a5ace33-57db-4193-90f0-dcd961c5dada
- carol@carolcrozeta.com: a4a3f3e2-fd4a-4618-a4b4-88d1726ed91d
- claudiano.avelino@gmail.com: 3b066a8b-bbc8-4098-8b30-ef38796ec1d5
- grupoarena@grupoarenaempresarial.com.br: ebfd46e8-2f63-4624-bdbf-960fe0b8e4d2
- mstaakjr@gmail.com: a34423ff-0f75-41c7-99c4-51f5f64aec07
- acontabilmg@gmail.com: 575eb954-9bea-4ed3-8082-958471ef40ba
- dayane_calixto@yahoo.com.br: 0d66e376-ce78-4a9b-8884-5e204985ecb4
- daysevieira520@gmail.com: 14df3ed9-00c4-4981-a50b-31dbf3781d1a
- dmaggioni@bol.com.br: cb389a9a-cdf0-451c-a407-0a887f309adf, c423b2fb-ab8c-4c36-a2ca-28e6a0bc9e4f, 79eb8834-14d2-4e78-92c1-9676b23eaf6c
- viniciusbergamo.epm@gmail.com: dfe21c02-56a7-4bba-9718-6ccda095f3e8, fe3e0269-717d-40bd-8673-667941be7cb3
- jujulacoshandmade@gmail.com: 21266794-cc02-4f5a-8eb1-f637195a78ed
- mariana.plazevedo@gmail.com: 9e29b898-e003-4c89-9c02-a0f62436fb57
- arthur@cordeiroac.adv.br: b7aaa2a0-76c1-43cf-9bbf-cd43262a2cc6
- chaplainfabio@gmail.com: a9445d4c-f02c-425c-8e69-436c921a86b1
- paraguassutans@gmail.com: 6340bc5d-9dd1-4536-8a2e-11717eb9ccb6
- marcellsenapersonal@gmail.com: e1c55129-1b49-42c5-a261-f2106bd7aae4, d7f5b040-7a9c-4eba-a306-947d99c1b28c
- rafaelleitemacedo@gmail.com: 6c47c9f7-9070-4c8e-a3c2-bb1751c88627
- draraissacampos@gmail.com: 8a1be58f-96cd-4926-9c68-c4fc83384ce7
- dirceu.moura.cruz78@gmail.com: 0bae653b-63fd-49fd-9242-353015dffc74
- skf72@hotmail.com: 9680e09c-4384-4336-b666-4a8c50ffa297, 7633da5e-0e66-486a-aacc-07007ea62e30
- chefmarcelomintz@hotmail.com: c395b577-3da6-4d53-8c54-17da373be396
- richard.moraes@hc.fm.usp.br: 8b299d83-e795-4420-b708-81918ef15954
- thiagoef01@gmail.com: f66f7b7b-f4c4-4ed1-8a0a-6b3e0b1ca0c2
- cecilianeves2045@gmail.com: 7da71348-0714-476e-b07a-6e5eba9b092a
- pestanatiago2008@gmail.com: 92c58c1d-768e-4db3-9b9e-22f0530e4fb5
- allysoncruz.nutri@gmail.com: 1c54c645-c631-4a91-ae54-f4ce757fe4c2
- gustavo@easywaymtg.com: f1fba950-a015-4c41-a370-dbabad7bf9bf

## Fix aplicado (este PR)

1. `/api/v1/videos/audios`: filtro SQL `.not("audio_path", "like", "%/sample.wav")` —
   a amostra some dos DOIS seletores (Video Clone e wizard de vídeo). Ela continua
   audível no player do histórico da voz (que consulta `generations` direto) — o
   propósito anti-churn fica intacto.
2. `POST /api/v1/video-clone`: trava explícita — se o `generation_id` apontar pra um
   `audio_path` terminando em `/sample.wav`, retorna 400 com mensagem explicando o que
   é a amostra e mandando gerar um áudio de verdade. Pega aba antiga e chamada direta.

Fora do escopo (decisão do Frank/Johnny): o POST do wizard de vídeo tem a mesma exposição
teórica via generation_id; o seletor dele já fica limpo com o item 1.
